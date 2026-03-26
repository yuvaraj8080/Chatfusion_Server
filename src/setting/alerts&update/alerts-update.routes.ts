import { Router } from "express";
import {
  getMuteAllNotificationsStatus,
  toggleMuteAllNotifications,
  getPostNotificationSettings,
  updatePostNotificationSettings,
  getStoryNotificationSettings,
  updateStoryNotificationSettings,
  toggleCanShareWhoAreMentionedInStory,
  toggleCanShareStoriesInMessage,
  getFollowingAndFollowersNotificationSettings,
  updateFollowingAndFollowersNotificationSettings,
  getMessageNotificationSettings,
  updateMessageNotificationSettings,
} from "./alerts-update.controller";

const alertsUpdateRoutes = Router();

// /api/setting/alerts-update/get-mute-all-notifications-status
alertsUpdateRoutes.get(
  "/get-mute-all-notifications-status",
  getMuteAllNotificationsStatus
);

// /api/setting/alerts-update/toggle-mute-all-notifications
alertsUpdateRoutes.put(
  "/toggle-mute-all-notifications",
  toggleMuteAllNotifications
);

// /api/setting/alerts-update/get-post-notification-settings
alertsUpdateRoutes.get(
  "/get-post-notification-settings",
  getPostNotificationSettings
);

// /api/setting/alerts-update/update-post-notification-settings
alertsUpdateRoutes.put(
  "/update-post-notification-settings",
  updatePostNotificationSettings
);

// /api/setting/alerts-update/get-story-notification-settings
alertsUpdateRoutes.get(
  "/get-story-notification-settings",
  getStoryNotificationSettings
);

// /api/setting/alerts-update/update-story-notification-settings
alertsUpdateRoutes.put(
  "/update-story-notification-settings",
  updateStoryNotificationSettings
);

// /api/setting/alerts-update/toggle-can-share-who-are-mentioned-in-story
alertsUpdateRoutes.put(
  "/toggle-can-share-who-are-mentioned-in-story",
  toggleCanShareWhoAreMentionedInStory
);

// /api/setting/alerts-update/toggle-can-share-stories-in-message
alertsUpdateRoutes.put(
  "/toggle-can-share-stories-in-message",
  toggleCanShareStoriesInMessage
);

// /api/setting/alerts-update/get-following-and-followers-notification-settings
alertsUpdateRoutes.get(
  "/get-following-and-followers-notification-settings",
  getFollowingAndFollowersNotificationSettings
);

// /api/setting/alerts-update/update-following-and-followers-notification-settings
alertsUpdateRoutes.put(
  "/update-following-and-followers-notification-settings",
  updateFollowingAndFollowersNotificationSettings
);

// /api/setting/alerts-update/get-message-notification-settings
alertsUpdateRoutes.get(
  "/get-message-notification-settings",
  getMessageNotificationSettings
);

// /api/setting/alerts-update/update-message-notification-settings
alertsUpdateRoutes.put(
  "/update-message-notification-settings",
  updateMessageNotificationSettings
);

export default alertsUpdateRoutes;
