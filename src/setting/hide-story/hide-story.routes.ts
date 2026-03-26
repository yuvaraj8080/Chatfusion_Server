import { Router } from "express";
import {
  getHideStoryFromList,
  updateHideStoryFromList,
} from "./hide-story.controller";

const HideStoryRoutes = Router();

// /api/setting/hide-story/updateHideStoryFromList
HideStoryRoutes.put("/updateHideStoryFromList", updateHideStoryFromList);

// /api/setting/hide-story/getHideStoryFromList
HideStoryRoutes.get("/getHideStoryFromList", getHideStoryFromList);

export default HideStoryRoutes;
