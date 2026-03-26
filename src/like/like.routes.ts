import express from "express";
import {
  likePost,
  unlikePost,
  likeComment,
  unlikeComment,
  unlikeStory,
  likeStory,
} from "./like.controller";

const LikeRoutes = express.Router();

// /api/likes/:postId/likePost
LikeRoutes.post("/:postId/likePost", likePost);

// /api/likes/:postId/unlikePost
LikeRoutes.post("/:postId/unlikePost", unlikePost);

// /api/likes/:commentId/likeComment
LikeRoutes.post("/:commentId/likeComment", likeComment);

// /api/likes/:commentId/unlikeComment
LikeRoutes.post("/:commentId/unlikeComment", unlikeComment);

// /api/likes/:storyId/likeStory
LikeRoutes.post("/:storyId/likeStory", likeStory);

// /api/likes/:storyId/unlikeStory
LikeRoutes.post("/:storyId/unlikeStory", unlikeStory);

export default LikeRoutes;
