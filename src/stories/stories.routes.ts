import express from "express";
import {
  createStory,
  deleteStory,
  updateStory,
  viewStory,
  getUserStories,
  getAllViewersOfStory,
  getHomePageStories,
  getUsersWhoLikedStory,
  getStoryById,
  getStoriesWithLocationSticker,
  toggleMuteStory,
  isStoryMutedByUser,
  isStoryLikedByUser,
} from "./stories.controller";
import { toggleTurnOffComments } from "../post/post.controller";

const StoryRoutes = express.Router();

// /api/stories/createStory
StoryRoutes.post("/createStory", createStory);

// /api/stories/deleteStory/:storyId
StoryRoutes.delete("/deleteStory/:storyId", deleteStory);

// /api/stories/updateStory/:storyId
StoryRoutes.patch("/updateStory/:storyId", updateStory);

// /api/stories/viewStory/:storyId
StoryRoutes.post("/viewStory/:storyId", viewStory);

// /api/stories/getUserStories/:userId
StoryRoutes.get("/getUserStories/:userId", getUserStories);

// /api/stories/getAllViewersOfStory/:storyId
StoryRoutes.get("/getAllViewersOfStory/:storyId", getAllViewersOfStory);

// /api/stories/getHomePageStories
StoryRoutes.get("/getHomePageStories", getHomePageStories);

// /api/stories/getUsersWhoLikedStory/:storyId
StoryRoutes.get("/getUsersWhoLikedStory/:storyId", getUsersWhoLikedStory);

// /api/stories/getStoryById/:storyId
StoryRoutes.get("/getStoryById/:storyId", getStoryById);

// /api/stories/getStoriesWithLocationSticker
StoryRoutes.get(
  "/getStoriesWithLocationSticker",
  getStoriesWithLocationSticker
);

// /api/stories/:storyId/toggleTurnOffComments
StoryRoutes.put("/:storyId/toggleTurnOffComments", toggleTurnOffComments);

// /api/stories/toggleMuteStory/:userId
StoryRoutes.put("/toggleMuteStory/:userId", toggleMuteStory);

// /api/stories/isStoryMutedByUser/:userId
StoryRoutes.get("/isStoryMutedByUser/:userId", isStoryMutedByUser);

// /api/stories/isStoryLikedByUser/:storyId
StoryRoutes.get("/isStoryLikedByUser/:storyId", isStoryLikedByUser);

export default StoryRoutes;
