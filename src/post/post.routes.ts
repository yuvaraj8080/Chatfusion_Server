import express from "express";

const PostRoutes = express.Router();

import {
  createPost,
  getUserFeed,
  updatePost,
  deletePost,
  getPostById,
  getAllPostsByUserId,
  getAllTaggedPostsByUserId,
  getUsersWhoLikedPost,
  viewPost,
  getPostsByLocation,
  getMentionedUsers,
  getAllTapes,
  getPostsByHashtagId,
  getAllImagePosts,
  toggleHideLikesCount,
  toggleTurnOffComments,
  toggleHideSharesCount,
  updateAdjustPreview,
  pinPostOnProfilePage,
  unpinPostFromProfilePage,
  getAllTapesByUserId,
  isPostAlreadySaved,
  isPostLikedByUser,
  isPostPinnedOnProfilePage,
} from "./post.controller";

// /api/posts/createPost
PostRoutes.post("/createPost", createPost);

// /api/posts/getUserFeed
PostRoutes.get("/getUserFeed", getUserFeed);

// /api/posts/:postId/updatePost
PostRoutes.patch("/:postId/updatePost", updatePost);

// /api/posts/:postId/deletePost
PostRoutes.delete("/:postId/deletePost", deletePost);

// /api/posts/:postId/getPostById
PostRoutes.get("/:postId/getPostById", getPostById);

// /api/posts/getAllPostsByUserId/:userId
PostRoutes.get("/getAllPostsByUserId/:userId", getAllPostsByUserId);

// /api/posts/getAllTaggedPostsByUserId/:userId
PostRoutes.get("/getAllTaggedPostsByUserId/:userId", getAllTaggedPostsByUserId);

// /api/posts/:postId/getUsersWhoLikedPost
PostRoutes.get("/:postId/getUsersWhoLikedPost", getUsersWhoLikedPost);

// /api/posts/:postId/viewPost
PostRoutes.post("/:postId/viewPost", viewPost);

// /api/posts/getPostsByLocation/:distance
PostRoutes.get("/getPostsByLocation/:distance", getPostsByLocation);

// /api/posts/:postId/getMentionedUsers
PostRoutes.get("/:postId/getMentionedUsers", getMentionedUsers);

// /api/posts/getAllTapes
PostRoutes.get("/getAllTapes", getAllTapes);

// /api/posts/getAllTapesByUserId/:userId
PostRoutes.get("/getAllTapesByUserId/:userId", getAllTapesByUserId);

// /api/posts/getAllImagePosts
PostRoutes.get("/getAllImagePosts", getAllImagePosts);

// /api/posts/getPostsByHashtagId/:hashtagId
PostRoutes.get("/getPostsByHashtagId/:hashtagId", getPostsByHashtagId);

// /api/posts/:postId/toggleHideLikesCount
PostRoutes.put("/:postId/toggleHideLikesCount", toggleHideLikesCount);

// /api/posts/:postId/toggleTurnOffComments
PostRoutes.put("/:postId/toggleTurnOffComments", toggleTurnOffComments);

// /api/posts/:postId/toggleHideSharesCount
PostRoutes.put("/:postId/toggleHideSharesCount", toggleHideSharesCount);

// /api/posts/:postId/updateAdjustPreview
PostRoutes.put("/:postId/updateAdjustPreview", updateAdjustPreview);

// /api/posts/:postId/pinPostOnProfilePage
PostRoutes.put("/:postId/pinPostOnProfilePage", pinPostOnProfilePage);

// /api/posts/:postId/unpinPostFromProfilePage
PostRoutes.put("/:postId/unpinPostFromProfilePage", unpinPostFromProfilePage);

// /api/posts/:postId/isPostLikedByUser
PostRoutes.get("/:postId/isPostLikedByUser", isPostLikedByUser);

// /api/posts/:postId/isPostAlreadySaved
PostRoutes.get("/:postId/isPostAlreadySaved", isPostAlreadySaved);

// /api/posts/:postId/isPostPinnedOnProfilePage
PostRoutes.get("/:postId/isPostPinnedOnProfilePage", isPostPinnedOnProfilePage);

export default PostRoutes;
