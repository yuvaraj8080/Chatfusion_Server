import { Router } from "express";
import {
  createAndUpdateStoryHighlight,
  getAllStoryHighlights,
  deleteSpecificStoryFromStoryHighlight,
  deleteStoryHighlight,
  getAllStoriesOfUser,
} from "./storyHighlights.controller";

const storyHighlightsRoutes = Router();

// /api/storyHighlights/createAndUpdateStoryHighlight
storyHighlightsRoutes.post(
  "/createAndUpdateStoryHighlight",
  createAndUpdateStoryHighlight
);

// /api/storyHighlights/getAllStoryHighlights/:userId
storyHighlightsRoutes.get(
  "/getAllStoryHighlights/:userId",
  getAllStoryHighlights
);

// /api/storyHighlights/deleteSpecificStoryFromStoryHighlight
storyHighlightsRoutes.post(
  "/deleteSpecificStoryFromStoryHighlight",
  deleteSpecificStoryFromStoryHighlight
);

// /api/storyHighlights/deleteStoryHighlight/:storyHighlightsId
storyHighlightsRoutes.delete(
  "/deleteStoryHighlight/:storyHighlightsId",
  deleteStoryHighlight
);

// /api/storyHighlights/getAllStoriesOfUser
storyHighlightsRoutes.get("/getAllStoriesOfUser", getAllStoriesOfUser);

export default storyHighlightsRoutes;
