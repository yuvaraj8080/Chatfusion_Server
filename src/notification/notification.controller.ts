import { Request, Response } from "express";
import { NotificationModel } from "./notification.model";
import { UserModel } from "../user/user.model";
import { FollowModel } from "../follow/follow.model";
import mongoose from "mongoose";
import { NotificationSettingsModel } from "../setting/alerts&update/notificationSettings.model";
import { getBlockedUserIds } from "../utils/isBlockedBetween";
import fetch from "node-fetch";
import { GoogleAuth } from "google-auth-library";
import { PostModel } from "../post/post.model";
import { SavePostModel } from "../savePost/savepost.model";

// get all notification of user
export const getAllNotificationOfUser = async (req: Request, res: Response) => {
  try {
    const { userId } = (req as any).user;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const allowedTypes = [
      "LIKE",
      "COMMENT",
      "FOLLOW",
      "MENTION",
      "STORY",
      "TAG",
      "POST",
      "SCREENSHOT_TAKEN",
    ];

    const query = {
      receiverId: userId,
      isDeleted: false,
      type: { $in: allowedTypes },
    };

    const [totalNotifications, notifications] = await Promise.all([
      NotificationModel.countDocuments(query),
      NotificationModel.find(query)
        .populate("senderId", "fullName username profilePicture userTier")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    return res.status(200).json({
      success: true,
      message: notifications.length
        ? "Notifications fetched successfully"
        : "No notifications found",
      count: notifications.length,
      totalPages: Math.ceil(totalNotifications / limit),
      currentPage: page,
      result: notifications,
    });
  } catch (error) {
    console.error("Error retrieving notifications:", error);
    return res.status(500).json({
      success: false,
      message: "Error retrieving notifications",
      error: error,
    });
  }
};

// check if there is unread notification for a user
export const checkIfThereIsUnreadNotification = async (
  req: Request,
  res: Response
) => {
  try {
    const { userId } = (req as any).user;

    const isUnread = await NotificationModel.exists({
      receiverId: userId,
      isRead: false,
      isDeleted: false,
    });

    return res.status(200).json({
      success: isUnread ? true : false,
      message: isUnread
        ? "There is unread notification"
        : "No unread notification",
      result: isUnread ? true : false,
    });
  } catch (error) {
    console.error("Error checking if there is unread notification:", error);
    return res.status(500).json({
      success: false,
      message: "Error checking if there is unread notification",
      error: error,
    });
  }
};

// get unread notification count
export const getUnreadNotificationCount = async (
  req: Request,
  res: Response
) => {
  try {
    const { userId } = (req as any).user;

    const unreadCount = await NotificationModel.countDocuments({
      receiverId: userId,
      isRead: false,
      isDeleted: false,
    });

    return res.status(200).json({
      success: unreadCount ? true : false,
      message: unreadCount
        ? "Unread notification count retrieved successfully"
        : "No unread notifications found",
      result: unreadCount ? unreadCount : null,
    });
  } catch (error) {
    console.error("Error retrieving unread notification count:", error);
    return res.status(500).json({
      success: false,
      message: "Error retrieving unread notification count",
      error: error,
    });
  }
};

// mark all notification as read for a user
export const markAllNotificationAsRead = async (
  req: Request,
  res: Response
) => {
  try {
    const { userId } = (req as any).user;

    const updatedNotification = await NotificationModel.updateMany(
      {
        receiverId: userId, // only the user can mark their own notification as read
        isDeleted: false,
      },
      { isRead: true }
    );

    return res.status(200).json({
      success: updatedNotification ? true : false,
      message: updatedNotification
        ? "All notification marked as read successfully"
        : "Failed to mark all notification as read",
      result: updatedNotification ? true : false,
    });
  } catch (error) {
    console.error("Error marking all notification as read:", error);
    return res.status(500).json({
      success: false,
      message: "Error marking all notification as read",
      error: error,
    });
  }
};

// delete notification
export const deleteNotification = async (req: Request, res: Response) => {
  try {
    const { notificationId } = req.params;
    const { userId } = (req as any).user;

    const deletedNotification = await NotificationModel.findOneAndUpdate(
      {
        _id: notificationId,
        receiverId: userId, // only the user can delete their own notification
        isDeleted: false,
      },
      { isDeleted: true },
      { new: true }
    );

    return res.status(200).json({
      success: deletedNotification ? true : false,
      message: deletedNotification
        ? "Notification deleted successfully"
        : "Failed to delete notification",
      result: deletedNotification ? deletedNotification : null,
    });
  } catch (error) {
    console.error("Error deleting notification:", error);
    return res.status(500).json({
      success: false,
      message: "Error deleting notification",
      error: error,
    });
  }
};

// get suggested users to follow
export const getSuggestedUsersToFollow = async (
  req: Request,
  res: Response
) => {
  try {
    const { userId } = (req as any).user;

    const allBlockedUserIds = await getBlockedUserIds(userId);

    // check the account suggestion settings is on in notification settings
    const notificationSettings = await NotificationSettingsModel.findOne({
      userId,
    })
      .select("followingAndFollowersNotifications.accountSuggestions")
      .lean();

    if (
      notificationSettings?.followingAndFollowersNotifications
        ?.accountSuggestions === "off"
    ) {
      return res.status(200).json({
        success: false,
        message: "Account suggestions are off",
        result: null,
      });
    }

    // 1. get the users that I currently following
    const alreadyFollowingUserIds = await FollowModel.distinct(
      "followedUserId",
      {
        userId,
        isFollowing: true,
      }
    );

    // 2. get the users that I am not following and not in the alreadyFollowingUserIds array and not private
    const suggestedUsers = await UserModel.find({
      _id: { $nin: [...alreadyFollowingUserIds, userId, ...allBlockedUserIds] },
      isDeleted: false,
      isPrivate: false,
    })
      .select("fullName username profilePicture userTier")
      .sort({ followersCount: -1 })
      .limit(10);

    return res.status(200).json({
      success: suggestedUsers ? true : false,
      message: suggestedUsers
        ? "Users suggested for you to follow"
        : "No users suggested for you to follow",
      count: suggestedUsers?.length,
      result: suggestedUsers ? suggestedUsers : null,
    });
  } catch (error) {
    console.error("Error user suggested for me to follow:", error);
    return res.status(500).json({
      success: false,
      message: "Error user suggested for me to follow",
      error: error,
    });
  }
};

// get users that you might know
export const getUsersYouMightKnow = async (req: Request, res: Response) => {
  try {
    const { userId } = (req as any).user;

    const allBlockedUserIds = await getBlockedUserIds(userId);

    // 1. get the users that I currently following (1st level followees)
    const myFollowingUserIds = await FollowModel.distinct("followedUserId", {
      userId,
      isFollowing: true,
    });

    // 2. get users that might be mutual followees (2nd level followees)
    const usersYouMightKnow = await FollowModel.aggregate([
      {
        // get the users that my followings are following
        $match: {
          userId: { $in: myFollowingUserIds },
          isFollowing: true,
        },
      },
      {
        // group by followedUserId and count the number of users
        $group: {
          _id: "$followedUserId",
          mutuals: { $addToSet: "$userId" },
          mutualCount: { $sum: 1 },
        },
      },
      {
        // get the users that are not my followings and not me and not blocked
        $match: {
          _id: {
            $nin: [
              ...myFollowingUserIds,
              new mongoose.Types.ObjectId(userId),
              ...allBlockedUserIds,
            ],
          },
        },
      },
      {
        // lookup user details from the users collection
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "user",
        },
      },
      {
        // unwind the user details
        $unwind: "$user",
      },
      {
        // filter out the deleted users
        $match: {
          "user.isDeleted": false,
        },
      },
      {
        // lookup the mutual users details
        $lookup: {
          from: "users",
          localField: "mutuals",
          foreignField: "_id",
          as: "mutualUsers",
        },
      },
      {
        // project the desired fields
        $project: {
          _id: "$user._id",
          username: "$user.username",
          fullName: "$user.fullName",
          profilePicture: "$user.profilePicture",
          userTier: "$user.userTier",
          mutualCount: 1,
          mutualsPreview: {
            $slice: [
              {
                $map: {
                  input: "$mutualUsers",
                  as: "mutual",
                  in: {
                    username: "$$mutual.username",
                    profilePicture: "$$mutual.profilePicture",
                  },
                },
              },
              2,
            ],
          },
        },
      },
      // sort by mutualCount in descending order
      { $sort: { mutualCount: -1 } },
      // limit the results to 10
      { $limit: 10 },
    ]);

    return res.status(200).json({
      success: usersYouMightKnow ? true : false,
      message: usersYouMightKnow
        ? "Users you might know"
        : "No users you might know",
      count: usersYouMightKnow?.length,
      result: usersYouMightKnow ? usersYouMightKnow : null,
    });
  } catch (error) {
    console.error("Error getting users you might know:", error);
    return res.status(500).json({
      success: false,
      message: "Error getting users you might know",
      error: error,
    });
  }
};

// get all follow requests
export const getAllFollowRequests = async (req: Request, res: Response) => {
  try {
    const { userId } = (req as any).user;

    const notifications = await NotificationModel.find({
      receiverId: userId,
      isDeleted: false,
      type: { $in: ["FOLLOW_REQUEST", "FOLLOW_BACK"] },
    })
      .populate("senderId", "fullName username profilePicture userTier")
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      message: notifications.length
        ? "Notifications fetched successfully"
        : "No notifications found",
      count: notifications.length,
      result: notifications,
    });
  } catch (error) {
    console.error("Error retrieving notifications:", error);
    return res.status(500).json({
      success: false,
      message: "Error retrieving notifications",
      error: error,
    });
  }
};

// get all collaboration requests
export const getAllCollaborationRequests = async (
  req: Request,
  res: Response
) => {
  try {
    const { userId } = (req as any).user;

    const notifications = await NotificationModel.find({
      receiverId: userId,
      isDeleted: false,
      type: "COLLABORATION_REQUEST",
    })
      .populate("senderId", "fullName username profilePicture userTier")
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      message: notifications.length
        ? "Notifications fetched successfully"
        : "No notifications found",
      count: notifications.length,
      result: notifications,
    });
  } catch (error) {
    console.error("Error retrieving notifications:", error);
    return res.status(500).json({
      success: false,
      message: "Error retrieving notifications",
      error: error,
    });
  }
};

// accept collaboration request
export const acceptCollaborationRequest = async (
  req: Request,
  res: Response
) => {
  try {
    const { userId } = (req as any).user;
    const { notificationId } = req.params;

    // get the notification
    const notification = await NotificationModel.findById(
      notificationId
    ).lean();

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    await Promise.all([
      // put this userId in the collaboration users of that post
      PostModel.findByIdAndUpdate(notification.targetId, {
        $addToSet: { collaborators: userId },
      }),

      // delete the notification
      NotificationModel.findByIdAndUpdate(notificationId, {
        isDeleted: true,
      }),
    ]);

    // 5. Create collaboration notification
    const [currentUser, targetUserNotificationSettings, targetUser] =
      await Promise.all([
        UserModel.findById(userId, "username").lean(),
        NotificationSettingsModel.findOne({
          userId: notification.senderId,
        })
          .select("muteAllNotifications")
          .lean(),
        UserModel.findById(notification.senderId, "fcmToken").lean(),
      ]);

    const pushNotificationDetails = {
      notification: {
        title: "Genuinest",
        body: `${currentUser?.username} accepted your collaboration request`,
      },
      fcmToken: targetUser?.fcmToken,
      data: { type: "COLLABORATION_REQUEST" },
      serverKey: await getServerKeyToken(),
    };

    if (
      targetUser?.fcmToken &&
      !targetUserNotificationSettings?.muteAllNotifications
    ) {
      sendPushNotification(pushNotificationDetails).catch(console.error);
    }

    return res.status(200).json({
      success: true,
      message: "Collaboration request accepted",
    });
  } catch (error) {
    console.error("Error accepting collaboration request:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error,
    });
  }
};

// decline collaboration request
export const declineCollaborationRequest = async (
  req: Request,
  res: Response
) => {
  try {
    const { notificationId } = req.params;

    // 1. Delete collaboration request notification
    await NotificationModel.findByIdAndUpdate(notificationId, {
      isDeleted: true,
    });

    return res.status(200).json({
      success: true,
      message: "Collaboration request declined",
    });
  } catch (error) {
    console.error("Error declining collaboration request:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error,
    });
  }
};

// get all collaboration collection requests
export const getAllCollaborationCollectionRequests = async (
  req: Request,
  res: Response
) => {
  try {
    const { userId } = (req as any).user;

    const notifications = await NotificationModel.find({
      receiverId: userId,
      isDeleted: false,
      type: "COLLABORATION_COLLECTION_REQUEST",
    })
      .populate("senderId", "fullName username profilePicture userTier")
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      message: notifications.length
        ? "Notifications fetched successfully"
        : "No notifications found",
      count: notifications.length,
      result: notifications,
    });
  } catch (error) {
    console.error("Error retrieving notifications:", error);
    return res.status(500).json({
      success: false,
      message: "Error retrieving notifications",
      error: error,
    });
  }
};

// accept collaboration collection request
export const acceptCollaborationCollectionRequest = async (
  req: Request,
  res: Response
) => {
  try {
    const { userId } = (req as any).user;
    const { notificationId } = req.params;

    // get the notification
    const notification = await NotificationModel.findById(
      notificationId
    ).lean();

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    await Promise.all([
      // put this userId in the collaboration users of that collection
      SavePostModel.findByIdAndUpdate(notification.targetId, {
        $addToSet: { collaborators: userId },
      }),

      // delete the notification
      NotificationModel.findByIdAndUpdate(notificationId, {
        isDeleted: true,
      }),
    ]);

    // 5. Create collaboration collection notification
    const [currentUser, targetUserNotificationSettings, targetUser] =
      await Promise.all([
        UserModel.findById(userId, "username").lean(),
        NotificationSettingsModel.findOne({
          userId: notification.senderId,
        })
          .select("muteAllNotifications")
          .lean(),
        UserModel.findById(notification.senderId, "fcmToken").lean(),
      ]);

    const pushNotificationDetails = {
      notification: {
        title: "Genuinest",
        body: `${currentUser?.username} accepted your collaboration collection request`,
      },
      fcmToken: targetUser?.fcmToken,
      data: { type: "COLLABORATION_COLLECTION_REQUEST" },
      serverKey: await getServerKeyToken(),
    };

    if (
      targetUser?.fcmToken &&
      !targetUserNotificationSettings?.muteAllNotifications
    ) {
      sendPushNotification(pushNotificationDetails).catch(console.error);
    }

    return res.status(200).json({
      success: true,
      message: "Collaboration collection request accepted",
    });
  } catch (error) {
    console.error("Error accepting collaboration collection request:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error,
    });
  }
};

// decline collaboration collection request
export const declineCollaborationCollectionRequest = async (
  req: Request,
  res: Response
) => {
  try {
    const { notificationId } = req.params;

    // 1. Delete collaboration request notification
    await NotificationModel.findByIdAndUpdate(notificationId, {
      isDeleted: true,
    });

    return res.status(200).json({
      success: true,
      message: "Collaboration collection request declined",
    });
  } catch (error) {
    console.error("Error declining collaboration collection request:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error,
    });
  }
};

// send push notification
export const sendPushNotification = async (notificationDetails: any) => {
  try {
    const notification_body = {
      message: {
        token: notificationDetails.fcmToken,
        notification: notificationDetails.notification,
        data: notificationDetails.data,
      },
    };

    const response = await fetch(
      "https://fcm.googleapis.com/v1/projects/genuinest-f6166/messages:send",
      {
        method: "POST",
        headers: {
          Authorization: "Bearer " + notificationDetails.serverKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(notification_body),
      }
    );

    const responseBody = await response.json();

    if (response.ok) {
      // console.log("Notification sent successfully:", responseBody);
      return true;
    } else {
      // console.error("Failed to send notification:", responseBody);
      return false;
    }
  } catch (error) {
    console.error("Error sending notification:", error);
    return false;
  }
};

// get server key token
export const getServerKeyToken = async () => {
  const scopes = [
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/firebase.database",
    "https://www.googleapis.com/auth/firebase.messaging",
  ];

  const serviceAccount = {
    type: "service_account",
    project_id: "genuinest-f6166",
    private_key_id: "9301b566206b4ee8f78054013557b89c3e63e957",
    private_key:
      "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDDtBuBeP+lvpqk\n2QfpedxTt6XTjPLVbWy13xOxwmnAIp+moKEl/+Tfy7Dx89gVQ2amoWfwTmXm9PG1\njhLjorZiMcRBIVPLKa9FfsiMlebN++hmSOcAFAvRVDhCdVA41uZ+gh0rLCJlr1l4\n3t95ewLphnlF4UP9h8AJ1iR2rMdLNJc55YJ/uBxaUiEhd8ZVEkkafDkBIz7Ewo0+\n1Lg3ekHhLJoBvw4tplpgDG5P3zigedUco5+IYdaFhKaepv4hfx3GsF5A8TYcUmbu\n2FLfA+l9FUkTwv/GppLXqq0XfnVDFnztCqeTHjaMJGdPyoXQUPjg7ZKTdq5grHrs\n5u+sz3BzAgMBAAECggEABH+m5DaGVeaIQoLUqjrJZElD8BV83Yga6CFdIAhyit6g\n4eEuYyO7PKO/iQhMbsyyVuE99OmwcPsvdTdzWrU6UQ6IzuB3vyNRqpzL+mNVv2Vr\nhbJmUPuk++ZeNrTgp7XU7ZKLHhtxHPpHab5hz7aSrhCPyBnyCKlusiswgmPdXu6n\nv27eSIJ3e9ZIJgsnXq/6uaalGfBCgS9vzMM1tTW4v/NKRiP9bMuhfPjRJkk+nIzi\ng9hunUuUsg2M6c/BpTKKfVdMuHFgdxXkioSKfoFpuhTyc0LU9uWDUpyk7kfTE18+\nukzbNJpS+kWTwTz2Xtg1I/xlkbWg6JPRmdmZaBP6hQKBgQDrmmQOhdF8y307RKzW\nLAdW4GWcglImABYnvdmuON66R4qAqi6o5D9UqZn3I2g72t3Bt/irZLMAP35FbEUG\n9Wbykys74sF81GBNkxaFnnEODBrkbmjuHLE/55kG5FZwofejisO+DASvsBlQcqQo\nZIJB3efGr5AQDrZMU+jDdJH+PwKBgQDUpW76lOt3qFxrdRV3nyuAsPoFKIQLA2M+\neJFDMJQ6wyyjl5U6PvE2YVhcTqOGykiLPWxBlscNu6jsemd+3pMU4B69pJsipOv1\nxfMUXDP/IKgOdLQtv6DU1Ak6/JC4NlmLCdBihmo64mgJYsNcsHIwu+aFGKFvzyli\nvNBq+pMozQKBgEzvkMbxSfRfmth015/kpszm4CeYouzH0HRP2bq71XetDvxvFmeO\niWPDMoTyqgIJuaqdwfVuH8nv8fMHpQ7dqi2Cg3a92IND8uLCKnOdxrtYlpuLtnYz\nJmqA3YbTn6qOKYjdMohn8kvQzKNpnFOYZrTNmvdVs0ybEUqhh/vzoA0PAoGAG4Ij\nLytgoqQXAJeu5UCkAgvi7BPnsP0JM6WpNQXtxwREnA0Z8uT9k0lYguhxYxh79fdG\nL93vdilWmvDivpjQchzkHShUIVEwbSTkYzfiShjRZL1YKarmhWHAp+7QUeRGBSSJ\n3pUA3Qk46C3sk+sHeqJ0Gber+qjT87/1PkGYE+kCgYEAz4EUolN5blUUDj4cH+lA\ngMamiUnrGsgkOU+OSRxqEd1t2QFwsU8l4zr/nDXcvGmUGB8cGS3IteGtowT/t0to\ndtu1DbZKoCk8qS3erev+IVa1wdsHUlGxjQz6O7XIFkFk/D/9TDdzPDkRZGTSWDuI\n9bPiU9X/3Zfu/pRrgGKgFY0=\n-----END PRIVATE KEY-----\n",
    client_email:
      "firebase-adminsdk-fbsvc@genuinest-f6166.iam.gserviceaccount.com",
    client_id: "103976002514753334211",
    auth_uri: "https://accounts.google.com/o/oauth2/auth",
    token_uri: "https://oauth2.googleapis.com/token",
    auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
    client_x509_cert_url:
      "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40genuinest-f6166.iam.gserviceaccount.com",
    universe_domain: "googleapis.com",
  };

  const auth = new GoogleAuth({
    credentials: serviceAccount,
    scopes: scopes,
  });

  try {
    const client = await auth.getClient();
    const accessToken = await client.getAccessToken();
    return accessToken.token;
  } catch (error) {
    console.error("Error fetching access token:", error);
    throw error;
  }
};
