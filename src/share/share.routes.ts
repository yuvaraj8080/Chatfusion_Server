import { Router } from "express";
import { sharePost, getSuggestedShareUsers } from "./share.controller";

const ShareRoutes = Router();

// /api/shares/sharePost/:postId
ShareRoutes.post("/sharePost/:postId", sharePost);

// /api/shares/getSuggestedShareUsers
ShareRoutes.get("/getSuggestedShareUsers", getSuggestedShareUsers);

export default ShareRoutes;
