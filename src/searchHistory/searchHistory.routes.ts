import { Router } from "express";
import {
  searchUsers,
  saveSearch,
  getSearchHistory,
  deleteSearchItem,
  clearSearchHistory,
  searchPostsByCaption,
  searchPlacesByLocation,
  searchHashtags,
  searchTapesByCaption,
  getPostsByLocationCoordinates,
  getRelatedPosts,
  getSearchFeedPosts,
  getSuggestedPosts,
  searchAllSuggestions,
} from "./searchHistory.controller";

const searchHistoryRoutes = Router();

// /api/search/save
searchHistoryRoutes.post("/save", saveSearch);

// /api/search/history
searchHistoryRoutes.get("/history", getSearchHistory);

// /api/search/delete/:searchedUserId
searchHistoryRoutes.delete("/delete/:searchedUserId", deleteSearchItem);

// /api/search/clear
searchHistoryRoutes.delete("/clear", clearSearchHistory);

// /api/search/posts/:text
searchHistoryRoutes.get("/posts/caption/:text", searchPostsByCaption);

// /api/search/places/:text
searchHistoryRoutes.get("/places/:text", searchPlacesByLocation);

// /api/search/hashtags/:text
searchHistoryRoutes.get("/hashtags/:text", searchHashtags);

// /api/search/tapes/:text
searchHistoryRoutes.get("/tapes/:text", searchTapesByCaption);

// /api/search/getPostsByLocationCoordinates
searchHistoryRoutes.get(
  "/getPostsByLocationCoordinates",
  getPostsByLocationCoordinates
);

// /api/search/relatedPosts/:postId
searchHistoryRoutes.get("/relatedPosts/:postId", getRelatedPosts);

// /api/search/suggestedPosts
searchHistoryRoutes.get("/suggestedPosts", getSuggestedPosts);

// /api/search/searchFeedPosts
searchHistoryRoutes.get("/searchFeedPosts", getSearchFeedPosts);

// /api/search/searchAllSuggestions/:text
searchHistoryRoutes.get("/searchAllSuggestions/:text", searchAllSuggestions);

// /api/search/:text
searchHistoryRoutes.get("/:text", searchUsers);

export default searchHistoryRoutes;
