import { Request, Response } from "express";
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  PutObjectAclCommand
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  MediaConvertClient,
  CreateJobCommand,
  GetJobCommand
} from "@aws-sdk/client-mediaconvert";
import { v4 as uuid } from "uuid";

// Configure S3 Client
const s3Client = new S3Client({
  credentials: {
    accessKeyId: process.env.AWS_ACCSS_KEY || "",
    secretAccessKey: process.env.AWS_SECRET_KEY || "",
  },
  region: process.env.REGION || "ap-south-1",
});

// Configure MediaConvert Client
const mediaconvertClient = new MediaConvertClient({
  credentials: {
    accessKeyId: process.env.AWS_ACCSS_KEY || "",
    secretAccessKey: process.env.AWS_SECRET_KEY || "",
  },
  region: process.env.REGION || "ap-south-1",
  endpoint: process.env.AWS_MEDIACONVERT_ENDPOINT,
});

// generate s3 signed url
export const generateS3SignedUrl = async (
  fileName: string,
  contentType: string
) => {
  const command = new PutObjectCommand({
    Bucket: process.env.BUCKETNAME,
    Key: fileName,
    ContentType: contentType,
  });

  try {
    // Expires in 5 minutes (300 seconds)
    return await getSignedUrl(s3Client, command, { expiresIn: 300 });
  } catch (error) {
    console.log(error.message);
    throw error;
  }
};

// get aws signed url for single file
export const getAwsSignedUrl = async (req: Request, res: Response) => {
  try {
    const { fileName } = req.params;
    const presignedUrl = await generateS3SignedUrl(
      fileName,
      "application/octet-stream"
    );

    return res.status(200).send({
      success: true,
      result: presignedUrl,
    });
  } catch (error) {
    return res.status(500).send({
      success: false,
      error: error.message,
    });
  }
};

// get multiple aws signed urls for multiple files
export const getMultipleAwsSignedUrls = async (req: Request, res: Response) => {
  try {
    const files = req.body.files;

    if (!Array.isArray(files)) {
      return res.status(400).send({
        success: false,
        error: "Files array is required",
      });
    }

    const signedUrls = await Promise.all(
      files.map((file: any) =>
        generateS3SignedUrl(
          file.fileName,
          file.contentType || "application/octet-stream"
        )
      )
    );

    return res.status(200).send({
      success: true,
      result: signedUrls.map((url, index) => ({
        fileName: files[index].fileName,
        signedUrl: url,
      })),
    });
  } catch (error) {
    return res.status(500).send({
      success: false,
      error: error.message,
    });
  }
};

// Helper: Wait until job finishes
async function waitForJobCompletion(jobId: string) {
  let status;
  let job;
  do {
    await new Promise((r) => setTimeout(r, 5000));

    const command = new GetJobCommand({ Id: jobId });
    const jobData = await mediaconvertClient.send(command);
    job = jobData.Job;
    status = job?.Status;

  } while (status === "SUBMITTED" || status === "PROGRESSING");

  return job;
}

// Convert MM:SS to HH:MM:SS:00 format
const toTimecode = (time: string) => {
  const [minutes, seconds] = time.split(":").map(Number);
  return `00:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(
    2,
    "0"
  )}:00`;
};

export const trimVideoAndWait = async (req: Request, res: Response) => {
  try {
    const { videoUrl, startTime, endTime } = req.body;

    if (!videoUrl || !startTime || !endTime) {
      return res.status(400).json({
        success: false,
        message: "videoUrl, startTime, endTime are required",
      });
    }

    const startCode = toTimecode(startTime);
    const endCode = toTimecode(endTime);

    const inputKey = decodeURIComponent(
      videoUrl.replace(
        `https://${process.env.BUCKETNAME}.s3.${process.env.REGION}.amazonaws.com/`,
        ""
      )
    );

    const dir = inputKey.substring(0, inputKey.lastIndexOf("/") + 1);
    const baseName = inputKey.split("/").pop()?.split(".")[0] || "video";
    const uniqueId = uuid();
    const outputKey = `${dir}${baseName}_trimmed_${uniqueId}.mp4`;

    const params: any = {
      Role: process.env.AWS_MEDIACONVERT_ROLE,
      Settings: {
        TimecodeConfig: { Source: "ZEROBASED" as const },
        Inputs: [
          {
            FileInput: `s3://${process.env.BUCKETNAME}/${inputKey}`,
            TimecodeSource: "ZEROBASED" as const,
            InputClippings: [
              { StartTimecode: startCode, EndTimecode: endCode },
            ],
            VideoSelector: { ColorSpace: "FOLLOW" as const },
            AudioSelectors: {
              "Audio Selector 1": { DefaultSelection: "DEFAULT" as const },
            },
          },
        ],
        OutputGroups: [
          {
            Name: "File Group",
            OutputGroupSettings: {
              Type: "FILE_GROUP_SETTINGS",
              FileGroupSettings: {
                Destination: `s3://${process.env.BUCKETNAME}/${dir}`,
              },
            },
            Outputs: [
              {
                ContainerSettings: {
                  Container: "MP4",
                  Mp4Settings: { MoovPlacement: "PROGRESSIVE_DOWNLOAD" as const },
                },
                VideoDescription: {
                  Width: 1280,
                  Height: 720,
                  CodecSettings: {
                    Codec: "H_264",
                    H264Settings: {
                      RateControlMode: "QVBR" as const,
                      SceneChangeDetect: "TRANSITION_DETECTION" as const,
                      FramerateControl: "INITIALIZE_FROM_SOURCE" as const,
                      MaxBitrate: 5000000,
                      QvbrSettings: { QvbrQualityLevel: 8 },
                    },
                  },
                },
                AudioDescriptions: [
                  {
                    AudioSourceName: "Audio Selector 1",
                    CodecSettings: {
                      Codec: "AAC",
                      AacSettings: {
                        Bitrate: 96000,
                        CodingMode: "CODING_MODE_2_0" as const,
                        SampleRate: 48000,
                      },
                    },
                  },
                ],
                NameModifier: `_trimmed_${uniqueId}`,
              },
            ],
          },
        ],
      },
    };

    const command = new CreateJobCommand(params);
    const jobData = await mediaconvertClient.send(command);
    const jobId = jobData.Job?.Id;

    if (!jobId)
      return res
        .status(500)
        .json({ success: false, message: "Failed to create MediaConvert job" });

    const finalJob = await waitForJobCompletion(jobId);

    if (finalJob?.Status !== "COMPLETE") {
      return res.status(500).json({
        success: false,
        message: "Video trimming failed",
        details: finalJob,
      });
    }

    // Trimming completed, output file is already in S3
    // We remove the explicit ACL command as it's blocked by default bucket settings.

    // Delete original file
    await s3Client.send(new DeleteObjectCommand({
      Bucket: process.env.BUCKETNAME!,
      Key: inputKey,
    }));

    return res.json({
      success: true,
      message: "Video trimmed successfully",
      result: `https://${process.env.BUCKETNAME}.s3.${process.env.REGION}.amazonaws.com/${outputKey}`,
    });
  } catch (error) {
    console.error("Error trimming video:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
};
