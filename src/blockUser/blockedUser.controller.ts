import { Request, Response } from "express";
import { BlockedUserModel } from "./blockedUser.model";
import axios from "axios";
import { ChatModel } from "../chatMessage/chat/chat.model";
import { UserModel } from "../user/user.model";
import { PostModel } from "../post/post.model";

// block user
export const blockUser = async (req: Request, res: Response) => {
  try {
    const { blockedUserId } = req.body;
    const { userId } = (req as any).user;

    // Check if blocked user is the same as the current user
    if (userId === blockedUserId) {
      return res.status(400).json({
        success: false,
        message: "You cannot block yourself.",
      });
    }

    // Check if already blocked
    const alreadyBlocked = await BlockedUserModel.exists({
      userId,
      "blockedUserIds.userId": blockedUserId,
    });

    if (alreadyBlocked) {
      return res.status(400).json({
        success: false,
        message: "User already blocked",
      });
    }

    // Push new blocked user
    const blockedUser = await BlockedUserModel.findOneAndUpdate(
      { userId },
      {
        $push: {
          blockedUserIds: { userId: blockedUserId },
        },
      },
      { new: true, upsert: true }
    );

    try {
      await Promise.all([
        // 1. remove each others from close friends
        UserModel.updateMany(
          { _id: { $in: [userId, blockedUserId] } },
          {
            $pull: {
              closeFriends: { userId: { $in: [userId, blockedUserId] } },
            },
          }
        ),

        // 2. delete single chat between blocked user and current user
        ChatModel.updateOne(
          {
            type: "single",
            isDeleted: false,
            "participants.userId": { $all: [userId, blockedUserId] },
          },
          { isDeleted: true }
        ),

        // 3. remove each others from their collabration posts and tagged posts
        PostModel.updateMany(
          {
            userId: { $in: [userId, blockedUserId] },
            "taggedUsers.userId": { $in: [userId, blockedUserId] },
          },
          {
            $pull: {
              taggedUsers: { userId: { $in: [userId, blockedUserId] } },
              collaborators: { $in: [userId, blockedUserId] },
            },
          }
        ),

        // 4. unfollow blocked user by current user
        axios.post(
          `${process.env.BACKEND_URL}/api/follow/unfollowUser`,
          {
            targetUserId: blockedUserId,
            currentUserId: userId,
          },
          {
            headers: {
              Authorization: req.headers.authorization,
            },
          }
        ),

        // 5. unfollow current user by blocked user
        axios.post(
          `${process.env.BACKEND_URL}/api/follow/unfollowUser`,
          {
            targetUserId: userId,
            currentUserId: blockedUserId,
          },
          {
            headers: {
              Authorization: req.headers.authorization,
            },
          }
        ),
      ]);
    } catch (error) {
      // this means user not following each other
      return res.status(200).json({
        success: true,
        message: "User blocked successfully",
        result: blockedUser ? blockedUser : null,
      });
    }

    return res.status(200).json({
      success: blockedUser ? true : false,
      message: blockedUser
        ? "User blocked successfully"
        : "Failed to block user",
      result: blockedUser ? blockedUser : null,
    });
  } catch (error) {
    console.log("Error blocking user", error);
    return res.status(500).json({
      message: "Error blocking user",
      error: error,
    });
  }
};

// unblock users
export const unblockUsers = async (req: Request, res: Response) => {
  try {
    const { blockedUserIds } = req.body;
    const { userId } = (req as any).user;

    const updatedBlockedUser = await BlockedUserModel.findOneAndUpdate(
      { userId },
      { $pull: { blockedUserIds: { userId: { $in: blockedUserIds } } } },
      { new: true }
    );

    // restore single chats between blocked users and current user
    await Promise.all(
      blockedUserIds.map((blockedId: string) =>
        ChatModel.updateOne(
          {
            type: "single",
            isDeleted: true,
            "participants.userId": { $all: [userId, blockedId] },
          },
          { isDeleted: false }
        )
      )
    );

    return res.status(200).json({
      success: updatedBlockedUser ? true : false,
      message: updatedBlockedUser
        ? "Users unblocked successfully"
        : "Failed to unblock users",
      result: updatedBlockedUser ? updatedBlockedUser : null,
    });
  } catch (error) {
    console.log("Error unblocking users", error);
    return res.status(500).json({
      message: "Error unblocking users",
      error: error,
    });
  }
};

// get all blocked users
export const getAllBlockedUsers = async (req: Request, res: Response) => {
  try {
    const { userId } = (req as any).user;

    const blockedUsers = await BlockedUserModel.findOne({ userId }).populate(
      "blockedUserIds.userId",
      "username fullName profilePicture userTier"
    );

    return res.status(200).json({
      success: blockedUsers?.blockedUserIds ? true : false,
      message: blockedUsers?.blockedUserIds
        ? "Blocked users fetched successfully"
        : "Failed to fetch blocked users",
      totalBlockedUsers: blockedUsers?.blockedUserIds?.length ?? 0,
      result: blockedUsers?.blockedUserIds ? blockedUsers.blockedUserIds : null,
    });
  } catch (error) {
    console.log("Error fetching blocked users", error);
    return res.status(500).json({
      message: "Error fetching blocked users",
      error: error,
    });
  }
};
