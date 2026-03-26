import { Router } from "express";
import {
  replyToComment,
  getRepliesByCommentId,
  deleteComment,
  createComment,
  getAllCommentsByPostId,
  updateComment,
  getAllCommentsByStoryId,
  isCommentLikedByUser,
} from "./comment.controller";

const CommentRoutes = Router();

// /api/comments/createPostComment/:postId
CommentRoutes.post("/createPostComment/:postId", createComment);

// /api/comments/createStoryComment/:storyId
CommentRoutes.post("/createStoryComment/:storyId", createComment);

// /api/comments/:commentId/replyComment
CommentRoutes.post("/:commentId/replyComment", replyToComment);

// /api/comments/:commentId/getRepliesByCommentId
CommentRoutes.get("/:commentId/getRepliesByCommentId", getRepliesByCommentId);

// /api/comments/getAllCommentsByPostId/:postId
CommentRoutes.get("/getAllCommentsByPostId/:postId", getAllCommentsByPostId);

// /api/comments/getAllCommentsByStoryId/:storyId
CommentRoutes.get("/getAllCommentsByStoryId/:storyId", getAllCommentsByStoryId);

// /api/comments/:commentId/deleteComment
CommentRoutes.delete("/:commentId/deleteComment", deleteComment);

// /api/comments/:commentId/updateComment
CommentRoutes.patch("/:commentId/updateComment", updateComment);

// /api/comments/:commentId/isCommentLikedByUser
CommentRoutes.get("/:commentId/isCommentLikedByUser", isCommentLikedByUser);

export default CommentRoutes;
