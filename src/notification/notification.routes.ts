import { Router } from "express";
import {
  getAllNotificationOfUser,
  getUnreadNotificationCount,
  markAllNotificationAsRead,
  deleteNotification,
  getSuggestedUsersToFollow,
  getUsersYouMightKnow,
  getAllFollowRequests,
  getAllCollaborationRequests,
  acceptCollaborationRequest,
  declineCollaborationRequest,
  checkIfThereIsUnreadNotification,
  getAllCollaborationCollectionRequests,
  acceptCollaborationCollectionRequest,
  declineCollaborationCollectionRequest,
} from "./notification.controller";

const NotificationRoutes = Router();

// /api/notification/getAllNotificationOfUser
NotificationRoutes.get("/getAllNotificationOfUser", getAllNotificationOfUser);

// /api/notification/getUnreadNotificationCount
NotificationRoutes.get(
  "/getUnreadNotificationCount",
  getUnreadNotificationCount
);

// /api/notification/checkIfThereIsUnreadNotification
NotificationRoutes.get(
  "/checkIfThereIsUnreadNotification",
  checkIfThereIsUnreadNotification
);

// /api/notification/markAllNotificationAsRead
NotificationRoutes.put("/markAllNotificationAsRead", markAllNotificationAsRead);

// /api/notification/deleteNotification/:notificationId
NotificationRoutes.delete(
  "/deleteNotification/:notificationId",
  deleteNotification
);

// /api/notification/getSuggestedUsersToFollow
NotificationRoutes.get("/getSuggestedUsersToFollow", getSuggestedUsersToFollow);

// /api/notification/getUsersYouMightKnow
NotificationRoutes.get("/getUsersYouMightKnow", getUsersYouMightKnow);

// /api/notification/getAllFollowRequests
NotificationRoutes.get("/getAllFollowRequests", getAllFollowRequests);

// /api/notification/getAllCollaborationRequests
NotificationRoutes.get(
  "/getAllCollaborationRequests",
  getAllCollaborationRequests
);

// /api/notification/acceptCollaborationRequest/:notificationId
NotificationRoutes.put(
  "/acceptCollaborationRequest/:notificationId",
  acceptCollaborationRequest
);

// /api/notification/declineCollaborationRequest/:notificationId
NotificationRoutes.put(
  "/declineCollaborationRequest/:notificationId",
  declineCollaborationRequest
);

// /api/notification/getAllCollaborationCollectionRequests
NotificationRoutes.get(
  "/getAllCollaborationCollectionRequests",
  getAllCollaborationCollectionRequests
);

// /api/notification/acceptCollaborationCollectionRequest/:notificationId
NotificationRoutes.put(
  "/acceptCollaborationCollectionRequest/:notificationId",
  acceptCollaborationCollectionRequest
);

// /api/notification/declineCollaborationCollectionRequest/:notificationId
NotificationRoutes.put(
  "/declineCollaborationCollectionRequest/:notificationId",
  declineCollaborationCollectionRequest
);

export default NotificationRoutes;
