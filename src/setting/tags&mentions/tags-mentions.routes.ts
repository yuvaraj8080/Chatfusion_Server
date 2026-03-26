import { Router } from "express";

import {
  getTagsAndMentionsSettings,
  toggleManuallyApproveTags,
  updateTagsAndMentionsSettings,
  getPendingTagsPosts,
  approvePendingTagsPosts,
  removeUserFromTaggedPosts,
  hideTaggedPosts,
} from "./tags-mentions.controller";

const TagsMentionsRoutes = Router();

// /api/setting/tags-mentions/getTagsAndMentionsSettings
TagsMentionsRoutes.get(
  "/getTagsAndMentionsSettings",
  getTagsAndMentionsSettings
);

// /api/setting/tags-mentions/updateTagsAndMentionsSettings
TagsMentionsRoutes.patch(
  "/updateTagsAndMentionsSettings",
  updateTagsAndMentionsSettings
);

// /api/setting/tags-mentions/toggleManuallyApproveTags
TagsMentionsRoutes.put("/toggleManuallyApproveTags", toggleManuallyApproveTags);

// /api/setting/tags-mentions/getPendingTagsPosts
TagsMentionsRoutes.get("/getPendingTagsPosts", getPendingTagsPosts);

// /api/setting/tags-mentions/approvePendingTagsPosts
TagsMentionsRoutes.put("/approvePendingTagsPosts", approvePendingTagsPosts);

// /api/setting/tags-mentions/removeUserFromTaggedPosts
TagsMentionsRoutes.put("/removeUserFromTaggedPosts", removeUserFromTaggedPosts);

// /api/setting/tags-mentions/hideTaggedPosts
TagsMentionsRoutes.put("/hideTaggedPosts", hideTaggedPosts);

export default TagsMentionsRoutes;
