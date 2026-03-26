import { PostModel } from "../post/post.model";
import { ShareModel } from "./share.model";
import { Request, Response } from "express";
import mongoose from "mongoose";
import { UserModel } from "../user/user.model";
import { FollowModel } from "../follow/follow.model";
import { ChatModel } from "../chatMessage/chat/chat.model";

// share post by post id
export const sharePost = async (req: Request, res: Response) => {
  try {
    const { postId } = req.params;
    const { caption } = req.body;
    const userId = (req as any).user.userId;

    const share = await ShareModel.create({
      userId,
      postId,
      caption,
    });

    // update post shares count
    await PostModel.findByIdAndUpdate(postId, {
      $inc: { sharesCount: 1 },
    });

    return res.status(201).json({
      success: share ? true : false,
      message: share ? "Post shared successfully" : "Failed to share post",
      result: share ? share : null,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error,
    });
  }
};

// Suggest top 21 users to share with (DM or share story)
export const getSuggestedShareUsers = async (req: Request, res: Response) => {
  try {
    const userId = new mongoose.Types.ObjectId((req as any).user.userId);

    const suggestedUserIds = new Set<string>();

    // 1. Get recent single chat partners
    const recentChats = await ChatModel.find({
      type: "single",
      isDeleted: false,
      participants: { $elemMatch: { userId } },
    })
      .sort({ updatedAt: -1 })
      .limit(21)
      .lean();

    // get the other user id from the chat
    for (const chat of recentChats) {
      const otherUser = chat.participants.find(
        (p: any) => p.userId.toString() !== userId.toString()
      );

      // add the other user id to the set
      if (otherUser) suggestedUserIds.add(otherUser.userId.toString());
    }

    // 2. Add close friends if needed
    if (suggestedUserIds.size < 21) {
      const user = await UserModel.findById(userId)
        .select("closeFriends.userId")
        .lean();
      const closeFriends =
        user?.closeFriends?.map((cf: any) => cf.userId.toString()) || [];

      for (const cfId of closeFriends) {
        if (!suggestedUserIds.has(cfId)) {
          suggestedUserIds.add(cfId);
          if (suggestedUserIds.size >= 21) break;
        }
      }
    }

    // 3. Add followees if still under 10
    if (suggestedUserIds.size < 21) {
      const followees = await FollowModel.find({
        userId,
        isFollowing: true,
      })
        .sort({ createdAt: -1 }) // most recent follows
        .select("followedUserId")
        .lean();

      for (const follow of followees) {
        const fid = follow.followedUserId.toString();
        if (!suggestedUserIds.has(fid)) {
          suggestedUserIds.add(fid);
          if (suggestedUserIds.size >= 21) break;
        }
      }
    }

    // Final user details
    const users = await UserModel.find({
      _id: { $in: Array.from(suggestedUserIds) },
    })
      .select("fullName username profilePicture userTier")
      .lean();

    // Ensure same order as insertion
    const orderedUsers = Array.from(suggestedUserIds)
      .map((id) => users.find((u) => u._id.toString() === id))
      .filter(Boolean);

    return res.status(200).json({
      success: true,
      message: "Suggested users fetched successfully",
      count: orderedUsers.length,
      result: orderedUsers,
    });
  } catch (error) {
    console.error("Error fetching share suggestions:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error,
    });
  }
};
