import express from "express";
import {
  getAwsSignedUrl,
  getMultipleAwsSignedUrls,
  trimVideoAndWait,
} from "./fileUpload.controller";
import { verifyAccessToken } from "../utils/generic/auth/auth.middleware";

const FileUploadRoutes = express.Router();

// /api/fileUpload/getSignedUrl/:fileName
FileUploadRoutes.post("/getSignedUrl/:fileName", getAwsSignedUrl);

// /api/fileUpload/getMultipleSignedUrls
FileUploadRoutes.post("/getMultipleSignedUrls", getMultipleAwsSignedUrls);

// /api/fileUpload/trim-video
FileUploadRoutes.post("/trim-video", verifyAccessToken, trimVideoAndWait);

export default FileUploadRoutes;
