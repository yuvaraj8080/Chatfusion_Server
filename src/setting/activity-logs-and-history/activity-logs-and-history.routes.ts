import { Router } from "express";
import {
  getLikedPostsByUser,
  getCommentsByUser,
  getPostsWhereUserIsTagged,
  getExpiredStoriesOfUser,
  getRecentlyDeletedStoriesOfUser,
  getInterestedPostsOfUser,
  getNotInterestedPostsOfUser,
  addPostToInterestedPosts,
  addPostToNotInterestedPosts,
  removePostsFromInterestedPosts,
  removePostsFromNotInterestedPosts,
  unlikeMultiplePosts,
} from "./activity-logs-and-history.controller";

const ActivityLogsAndHistoryRoutes = Router();

// /api/setting/activity-logs-and-history/getLikedPostsByUser
ActivityLogsAndHistoryRoutes.get("/getLikedPostsByUser", getLikedPostsByUser);

// /api/setting/activity-logs-and-history/getCommentsByUser
ActivityLogsAndHistoryRoutes.get("/getCommentsByUser", getCommentsByUser);

// /api/setting/activity-logs-and-history/getPostsWhereUserIsTagged
ActivityLogsAndHistoryRoutes.get(
  "/getPostsWhereUserIsTagged",
  getPostsWhereUserIsTagged
);

// /api/setting/activity-logs-and-history/getExpiredStoriesOfUser
ActivityLogsAndHistoryRoutes.get(
  "/getExpiredStoriesOfUser",
  getExpiredStoriesOfUser
);

// /api/setting/activity-logs-and-history/getRecentlyDeletedStoriesOfUser
ActivityLogsAndHistoryRoutes.get(
  "/getRecentlyDeletedStoriesOfUser",
  getRecentlyDeletedStoriesOfUser
);

// /api/setting/activity-logs-and-history/getInterestedPostsOfUser
ActivityLogsAndHistoryRoutes.get(
  "/getInterestedPostsOfUser",
  getInterestedPostsOfUser
);

// /api/setting/activity-logs-and-history/getNotInterestedPostsOfUser
ActivityLogsAndHistoryRoutes.get(
  "/getNotInterestedPostsOfUser",
  getNotInterestedPostsOfUser
);

// /api/setting/activity-logs-and-history/addPostToInterestedPosts
ActivityLogsAndHistoryRoutes.put(
  "/addPostToInterestedPosts",
  addPostToInterestedPosts
);

// /api/setting/activity-logs-and-history/addPostToNotInterestedPosts
ActivityLogsAndHistoryRoutes.put(
  "/addPostToNotInterestedPosts",
  addPostToNotInterestedPosts
);

// /api/setting/activity-logs-and-history/removePostsFromInterestedPosts
ActivityLogsAndHistoryRoutes.put(
  "/removePostsFromInterestedPosts",
  removePostsFromInterestedPosts
);

// /api/setting/activity-logs-and-history/removePostsFromNotInterestedPosts
ActivityLogsAndHistoryRoutes.put(
  "/removePostsFromNotInterestedPosts",
  removePostsFromNotInterestedPosts
);

// /api/setting/activity-logs-and-history/unlikeMultiplePosts
ActivityLogsAndHistoryRoutes.put("/unlikeMultiplePosts", unlikeMultiplePosts);

export default ActivityLogsAndHistoryRoutes;
