import { Router } from "express";
import {
  makeArchived,
  makeUnarchived,
  getArchivedPosts,
  getArchivedStories,
} from "./archive.controller";

const ArchiveRoutes = Router();

// /api/setting/archive/makePostArchived/:postId
ArchiveRoutes.put("/makePostArchived/:postId", makeArchived);

// /api/setting/archive/makeStoryArchived/:storyId
ArchiveRoutes.put("/makeStoryArchived/:storyId", makeArchived);

// /api/setting/archive/makePostUnarchived/:postId
ArchiveRoutes.put("/makePostUnarchived/:postId", makeUnarchived);

// /api/setting/archive/makeStoryUnarchived/:storyId
ArchiveRoutes.put("/makeStoryUnarchived/:storyId", makeUnarchived);

// /api/setting/archive/getArchivedPosts
ArchiveRoutes.get("/getArchivedPosts", getArchivedPosts);

// /api/setting/archive/getArchivedStories
ArchiveRoutes.get("/getArchivedStories", getArchivedStories);

export default ArchiveRoutes;
