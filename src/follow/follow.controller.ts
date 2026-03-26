import { Request, Response } from "express";
import { FollowModel } from "./follow.model";
import { UserModel } from "../user/user.model";
import { NotificationModel } from "../notification/notification.model";
import mongoose from "mongoose";
import { NotificationSettingsModel } from "../setting/alerts&update/notificationSettings.model";
import { isBlockedBetween } from "../utils/isBlockedBetween";
import {
  getServerKeyToken,
  sendPushNotification,
} from "../notification/notification.controller";

// follow user
export const followUser = async (req: Request, res: Response) => {
  try {
    const { targetUserId } = req.body;
    const currentUserId = (req as any).user.userId;

    if (currentUserId === targetUserId) {
      return res.status(400).json({
        success: false,
        message: "You cannot follow yourself",
      });
    }

    // 1. Check if the current user is blocked by the target user or the target user is blocked by the current user
    const isBlocked = await isBlockedBetween(currentUserId, targetUserId);
    if (isBlocked) {
      return res.status(400).json({
        success: false,
        message: "You cannot follow this user due to a block relationship",
      });
    }

    // 2. Check if already following
    const existingFollow = await FollowModel.exists({
      userId: currentUserId,
      followedUserId: targetUserId,
      isFollowing: true,
    });

    if (existingFollow) {
      return res.status(400).json({
        success: false,
        message: "User already followed",
      });
    }

    // 3. Get user data and settings
    const [targetUser, currentUser, notificationSettings] = await Promise.all([
      UserModel.findById(targetUserId, "isPrivate fcmToken").lean(),
      UserModel.findById(currentUserId, "username").lean(),
      NotificationSettingsModel.findOne({ userId: targetUserId })
        .select(
          "muteAllNotifications followingAndFollowersNotifications.followRequests"
        )
        .lean(),
    ]);

    // 4. Create follow
    const follow = await FollowModel.create({
      userId: currentUserId,
      followedUserId: targetUserId,
      isFollowing: targetUser?.isPrivate ? false : true,
    });

    // 5. Send notification only if not muted & setting is on
    const canNotify =
      notificationSettings?.followingAndFollowersNotifications
        ?.followRequests === "on";

    // 6. If target user is private -> send follow request notification
    if (targetUser?.isPrivate && canNotify) {
      const notificationDetails = {
        title: "New Follow Request",
        message: `${currentUser?.username} wants to follow you`,
        senderId: currentUserId,
        receiverId: targetUserId,
        type: "FOLLOW_REQUEST",
        targetId: targetUserId,
      };

      const pushNotificationDetails = {
        notification: {
          title: "Genuinest",
          body: `${currentUser?.username} wants to follow you`,
        },
        fcmToken: targetUser?.fcmToken,
        data: { type: "FOLLOW_REQUEST" },
        serverKey: await getServerKeyToken(),
      };

      NotificationModel.create({ ...notificationDetails }).catch(console.error);
      if (targetUser?.fcmToken && !notificationSettings?.muteAllNotifications) {
        sendPushNotification(pushNotificationDetails).catch(console.error);
      }

      return res.status(201).json({
        success: true,
        message: "Follow request sent successfully",
        result: {
          isFollowRequestSent: true,
        },
      });
    }

    // 7. Increment counts of following and followers
    await Promise.all([
      // increment following count of current user
      UserModel.findByIdAndUpdate(currentUserId, {
        $inc: { followingCount: 1 },
      }),
      // increment followers count of target user
      UserModel.findByIdAndUpdate(targetUserId, {
        $inc: { followersCount: 1 },
      }),
    ]);

    // 8. Send notification if allowed
    if (canNotify) {
      const notificationDetails = {
        title: "New Follower",
        message: `${currentUser?.username} started following you`,
        senderId: currentUserId,
        receiverId: targetUserId,
        type: "FOLLOW",
        targetId: targetUserId,
      };

      const pushNotificationDetails = {
        notification: {
          title: "Genuinest",
          body: `${currentUser?.username} started following you`,
        },
        fcmToken: targetUser?.fcmToken,
        data: { type: "FOLLOW" },
        serverKey: await getServerKeyToken(),
      };

      NotificationModel.create({ ...notificationDetails }).catch(console.error);
      if (targetUser?.fcmToken && !notificationSettings?.muteAllNotifications) {
        sendPushNotification(pushNotificationDetails).catch(console.error);
      }
    }

    return res.status(201).json({
      success: follow ? true : false,
      message: follow ? "Followed successfully" : "Failed to follow",
      result: follow ? follow : null,
    });
  } catch (error) {
    console.error("Error following user:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error,
    });
  }
};

// unfollow user
export const unfollowUser = async (req: Request, res: Response) => {
  try {
    const { currentUserId, targetUserId } = req.body;

    // upadte isFollowing to false
    const follow = await FollowModel.findOneAndUpdate(
      {
        userId: currentUserId,
        followedUserId: targetUserId,
        isFollowing: true,
      },
      { isFollowing: false }
    );

    if (!follow) {
      return res.status(404).json({
        success: follow ? false : true,
        message: "User not found or already unfollowed",
      });
    }

    await Promise.all([
      // Decrement counts of following in current user
      UserModel.findByIdAndUpdate(currentUserId, {
        $inc: { followingCount: -1 },
      }),

      // Decrement counts of followers in target user
      UserModel.findByIdAndUpdate(targetUserId, {
        $inc: { followersCount: -1 },
      }),
    ]);

    return res.status(200).json({
      success: follow ? true : false,
      message: follow ? "Unfollowed successfully" : "Failed to unfollow",
      result: follow ? follow : null,
    });
  } catch (error) {
    console.error("Error unfollowing user:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error,
    });
  }
};

// get all followers
export const getAllFollowers = async (req: Request, res: Response) => {
  try {
    const userId = req.params.userId;

    // Get all followers for the user
    const followers = await FollowModel.find({
      followedUserId: userId,
      isFollowing: true,
    })
      .populate("userId", "username fullName profilePicture userTier")
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: followers ? true : false,
      message: followers
        ? "Followers fetched successfully"
        : "Failed to fetch followers",
      count: followers ? followers.length : 0,
      result: followers ? followers : null,
    });
  } catch (error) {
    console.error("Error fetching followers:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error,
    });
  }
};

// get all followees
export const getAllFollowees = async (req: Request, res: Response) => {
  try {
    const userId = req.params.userId;

    // Get all following for the user
    const following = await FollowModel.find({
      userId: userId,
      isFollowing: true,
    })
      .populate("followedUserId", "username fullName profilePicture userTier")
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: following ? true : false,
      message: following
        ? "Following fetched successfully"
        : "Failed to fetch following",
      count: following ? following.length : 0,
      result: following ? following : null,
    });
  } catch (error) {
    console.error("Error fetching following:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error,
    });
  }
};

// search users by username or fullName in followees list
export const searchUsersInFolloweesList = async (
  req: Request,
  res: Response
) => {
  try {
    const { text } = req.params;
    const { userId } = (req as any).user;

    if (!text || text.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Search query is required",
      });
    }

    // search users by username or fullName in followees list
    const searchedUsers = await FollowModel.aggregate([
      // 1. match the user id and isFollowing is true
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId),
          isFollowing: true,
        },
      },
      // 2. lookup the user by the followedUserId
      {
        $lookup: {
          from: "users",
          localField: "followedUserId",
          foreignField: "_id",
          as: "user",
        },
      },
      // 3. unwrap the user from the user array
      {
        $unwind: "$user",
      },
      // 4. match the username or fullName with the text
      {
        $match: {
          $or: [
            { "user.username": { $regex: text, $options: "i" } },
            { "user.fullName": { $regex: text, $options: "i" } },
          ],
        },
      },
      // 5. project the user
      {
        $project: {
          "user._id": 1,
          "user.username": 1,
          "user.fullName": 1,
          "user.profilePicture": 1,
        },
      },
      // 6. limit the results
      { $limit: 7 },
    ]);

    // create a new array of users
    const users = searchedUsers.map((user: any) => ({
      _id: user.user._id,
      username: user.user.username,
      fullName: user.user.fullName,
      profilePicture: user.user.profilePicture,
    }));

    return res.status(200).json({
      success: users ? true : false,
      message: users ? "Users fetched successfully" : "No users found",
      count: users ? users.length : 0,
      result: users ? users : null,
    });
  } catch (error) {
    console.error("Error searching users:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error,
    });
  }
};

// search users by username or fullName in followers list
export const searchUsersInFollowersList = async (
  req: Request,
  res: Response
) => {
  try {
    const { text } = req.params;
    const { userId } = (req as any).user;

    if (!text || text.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Search query is required",
      });
    }

    // search users by username or fullName in followers list
    const searchedUsers = await FollowModel.aggregate([
      // 1. match the followedUserId and isFollowing is true
      {
        $match: {
          followedUserId: new mongoose.Types.ObjectId(userId),
          isFollowing: true,
        },
      },
      // 2. lookup the user by the userId
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "user",
        },
      },
      // 3. unwrap the user from the user array
      {
        $unwind: "$user",
      },
      // 4. match the username or fullName with the text
      {
        $match: {
          $or: [
            { "user.username": { $regex: text, $options: "i" } },
            { "user.fullName": { $regex: text, $options: "i" } },
          ],
        },
      },
      // 5. project the user
      {
        $project: {
          "user._id": 1,
          "user.username": 1,
          "user.fullName": 1,
          "user.profilePicture": 1,
        },
      },
      // 6. limit the results
      { $limit: 7 },
    ]);

    // create a new array of users
    const users = searchedUsers.map((user: any) => ({
      _id: user.user._id,
      username: user.user.username,
      fullName: user.user.fullName,
      profilePicture: user.user.profilePicture,
    }));

    return res.status(200).json({
      success: users ? true : false,
      message: users ? "Users fetched successfully" : "No users found",
      count: users ? users.length : 0,
      result: users ? users : null,
    });
  } catch (error) {
    console.error("Error searching users:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error,
    });
  }
};

// accept follow request
export const acceptFollowRequest = async (req: Request, res: Response) => {
  try {
    const currentUserId = (req as any).user.userId;
    const { targetUserId } = req.body;

    // 1. Check if already following
    const existingFollow = await FollowModel.exists({
      userId: targetUserId,
      followedUserId: currentUserId,
      isFollowing: true,
    });

    if (existingFollow) {
      return res.status(400).json({
        success: false,
        message: "User already followed",
      });
    }

    // 2. update isFollowing to true
    const follow = await FollowModel.findOneAndUpdate(
      {
        userId: targetUserId,
        followedUserId: currentUserId,
        isFollowing: false,
      },
      { isFollowing: true },
      { new: true }
    );

    // 3. Increment counts
    await Promise.all([
      // increment followers count of current user
      UserModel.findByIdAndUpdate(currentUserId, {
        $inc: { followersCount: 1 },
      }),
      // increment following count of target user
      UserModel.findByIdAndUpdate(targetUserId, {
        $inc: { followingCount: 1 },
      }),
    ]);

    // 4. Delete follow request notification
    await NotificationModel.findOneAndUpdate(
      {
        senderId: targetUserId,
        receiverId: currentUserId,
        type: "FOLLOW_REQUEST",
      },
      { isDeleted: true }
    );

    // 5. Create follow notification
    const [currentUser, targetUserNotificationSettings, targetUser] =
      await Promise.all([
        UserModel.findById(currentUserId, "username"),
        NotificationSettingsModel.findOne({ userId: targetUserId }).select(
          "muteAllNotifications followingAndFollowersNotifications.acceptedFollowRequests"
        ),
        UserModel.findById(targetUserId, "fcmToken"),
      ]);

    if (
      targetUserNotificationSettings?.followingAndFollowersNotifications
        ?.acceptedFollowRequests === "on"
    ) {
      const notificationDetails = {
        title: "Follow Request Accepted",
        message: `${currentUser?.username} accepted your follow request`,
        senderId: currentUserId,
        receiverId: targetUserId,
        type: "FOLLOW",
        targetId: follow?._id?.toString(),
      };

      const pushNotificationDetails = {
        notification: {
          title: "Genuinest",
          body: `${currentUser?.username} accepted your follow request`,
        },
        fcmToken: targetUser?.fcmToken,
        data: { type: "FOLLOW" },
        serverKey: await getServerKeyToken(),
      };

      NotificationModel.create({ ...notificationDetails }).catch(console.error);
      if (
        targetUser?.fcmToken &&
        !targetUserNotificationSettings?.muteAllNotifications
      ) {
        sendPushNotification(pushNotificationDetails).catch(console.error);
      }
    }

    // step 6. check that the current user follows the target user
    const isFollowing = await FollowModel.exists({
      userId: currentUserId,
      followedUserId: targetUserId,
      isFollowing: true,
    });

    // if not already create a follow back request
    if (!isFollowing) {
      await NotificationModel.create({
        title: "Follow Back",
        message: `want to follow back ${targetUser?.username}?`,
        senderId: targetUserId,
        receiverId: currentUserId,
        type: "FOLLOW_BACK",
        targetId: targetUserId,
      });
    }

    return res.status(201).json({
      success: follow ? true : false,
      message: follow ? "Followed successfully" : "Failed to follow",
      result: follow ? follow : null,
    });
  } catch (error) {
    console.error("Error accepting follow request:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error,
    });
  }
};

// decline follow request
export const declineFollowRequest = async (req: Request, res: Response) => {
  try {
    const currentUserId = (req as any).user.userId;
    const { targetUserId } = req.body;

    // 1. Delete follow request notification
    await NotificationModel.findOneAndUpdate(
      {
        senderId: targetUserId,
        receiverId: currentUserId,
        type: "FOLLOW_REQUEST",
      },
      { isDeleted: true }
    );

    return res.status(200).json({
      success: true,
      message: "Follow request declined",
    });
  } catch (error) {
    console.error("Error declining follow request:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error,
    });
  }
};

// decline follow back request
export const declineFollowBackRequest = async (req: Request, res: Response) => {
  try {
    const currentUserId = (req as any).user.userId;
    const { targetUserId } = req.body;

    // 1. Delete follow back request notification
    await NotificationModel.findOneAndUpdate(
      {
        senderId: targetUserId,
        receiverId: currentUserId,
        type: "FOLLOW_BACK",
      },
      { isDeleted: true }
    );

    return res.status(200).json({
      success: true,
      message: "Follow back request declined",
    });
  } catch (error) {
    console.error("Error declining follow back request:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error,
    });
  }
};

// is follow request already sent
export const isFollowRequestAlreadySent = async (
  req: Request,
  res: Response
) => {
  try {
    const currentUserId = (req as any).user.userId;
    const targetUserId = req.params.targetUserId;

    const followRequest = await NotificationModel.exists({
      senderId: currentUserId,
      receiverId: targetUserId,
      type: "FOLLOW_REQUEST",
      isDeleted: false,
    });

    return res.status(200).json({
      success: followRequest ? true : false,
      message: followRequest
        ? "Follow request already sent"
        : "Follow request not sent",
    });
  } catch (error) {
    console.error("Error checking follow request:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error,
    });
  }
};
