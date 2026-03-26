import { Router } from "express";

import activityLogsAndHistoryRoutes from "./activity-logs-and-history/activity-logs-and-history.routes";
import editProfileDetailsRouter from "./edit-profile-details/edit-profile-details.routes";
import CloseFriendRoutes from "./closeFriends/closeFriends.routes";
import TagsMentionsRoutes from "./tags&mentions/tags-mentions.routes";
import alertsUpdateRoutes from "./alerts&update/alerts-update.routes";
import HideStoryRoutes from "./hide-story/hide-story.routes";
import publicAndPostVisibilityRoutes from "./public&postVisibility/public-and-postVisibility.routes";
import TimeSpentRoutes from "./time-spent/time-spent.routes";
import ArchiveRoutes from "./archive/archive.routes";

const SettingRoutes = Router();

// /api/setting/activity-logs-and-history
SettingRoutes.use("/activity-logs-and-history", activityLogsAndHistoryRoutes);

// /api/setting/edit-profile-details
SettingRoutes.use("/edit-profile-details", editProfileDetailsRouter);

// /api/setting/closeFriends
SettingRoutes.use("/closeFriends", CloseFriendRoutes);

// /api/setting/tags-mentions
SettingRoutes.use("/tags-mentions", TagsMentionsRoutes);

// /api/setting/alerts-update
SettingRoutes.use("/alerts-update", alertsUpdateRoutes);

// /api/setting/hide-story
SettingRoutes.use("/hide-story", HideStoryRoutes);

// /api/setting/public-and-postVisibility
SettingRoutes.use("/public-and-postVisibility", publicAndPostVisibilityRoutes);

// /api/setting/time-spent
SettingRoutes.use("/time-spent", TimeSpentRoutes);

// /api/setting/archive
SettingRoutes.use("/archive", ArchiveRoutes);

export default SettingRoutes;
