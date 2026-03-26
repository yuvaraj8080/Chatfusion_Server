import { Request, Response } from "express";
import { ReportModel } from "./report.model";

// report a post or story or profile
export const report = async (req: Request, res: Response) => {
  try {
    const { postId, storyId, profileId, content } = req.body;
    const userId = (req as any).user.userId;

    if ((!postId && !storyId && !profileId) || !content) {
      return res.status(400).json({
        success: false,
        message:
          "Post ID or story ID or profile ID is required and content is required",
      });
    }

    const report = await ReportModel.create({
      userId,
      postId,
      storyId,
      profileId,
      content,
    });

    return res.status(200).json({
      success: report ? true : false,
      message: `${
        postId ? "Post" : storyId ? "Story" : "Profile"
      } reported successfully`,
      result: report ? report : null,
    });
  } catch (error) {
    console.error(`Error reporting post or story or profile: ${error}`);
    return res.status(500).json({
      success: false,
      message: `Error reporting post or story or profile`,
    });
  }
};
