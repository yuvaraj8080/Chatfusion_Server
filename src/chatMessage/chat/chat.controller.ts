import { Request, Response } from "express";
import { ChatModel } from "./chat.model";
import { MessageModel } from "../message/message.model";
import { SettingsModel } from "../../setting/settings.model";
import { UserModel } from "../../user/user.model";
import { PostModel } from "../../post/post.model";
import { onlineUsers } from "../socket";
import { StoryModel } from "../../stories/stories.model";
import { StoryViewModel } from "../../stories/storyView.model";

// create a chat
export const createChat = async (req: Request, res: Response) => {
  try {
    let { groupName, type, participants } = req.body;
    const { userId } = (req as any).user;

    // add userId to participants array
    participants.push(userId);

    // Format participants array to match the Participant schema
    const formattedParticipants: any = participants.map((id: string) => ({
      userId: id,
      hasSeen: id === userId, // creator has seen the chat
      hasRequestAccepted: id === userId, // creator has accepted the chat
    }));

    // check if chat already exists with these participants
    if (type === "single") {
      const otherUserId = participants[0];

      const chat = await ChatModel.findOne({
        type,
        isDeleted: false,
        participants: {
          $size: 2,
          $all: [
            { $elemMatch: { userId: otherUserId } },
            { $elemMatch: { userId: userId } },
          ],
        },
      });

      if (chat) {
        // if this user and otherUserId deletes this chat then remove its id from deletedBy array
        await ChatModel.findByIdAndUpdate(chat._id, {
          $pull: {
            deletedBy: { userId: { $in: [userId, otherUserId] } },
          },
        });

        return res.status(200).json({
          success: true,
          message: "Chat already exists",
          chat: chat,
        });
      }
    }

    // create a new chat
    const chat = await ChatModel.create({
      type,
      createdBy: userId,
      participants: formattedParticipants,
      groupName,
    });

    return res.status(201).json({
      success: chat ? true : false,
      message: chat ? "Chat created successfully" : "Chat creation failed",
      chat: chat ? chat : null,
    });
  } catch (error) {
    console.error("Create chat error:", error);
    return res.status(500).json({
      success: false,
      message: "Error creating chat",
      error,
    });
  }
};

// get all chats of a user
export const getAllChatsOfUser = async (req: Request, res: Response) => {
  try {
    const { userId } = (req as any).user;
    const lastUpdatedAt = req.query.lastUpdatedAt as string;

    // get pinned chats of the user
    const pinnedChats = await SettingsModel.findOne({
      userId,
    })
      .select("pinnedChats")
      .populate({
        path: "pinnedChats",
        select: "participants",
        populate: {
          path: "participants.userId",
          select: "profilePicture username userTier",
        },
      });

    // add isPinned field to the populated chats
    const extraChats = pinnedChats?.pinnedChats.map((chat: any) => {
      return {
        ...chat.toObject(),
        isPinnedChat: true,
      };
    }) as any;

    const query: any = {
      _id: { $nin: pinnedChats?.pinnedChats },
      "participants.userId": userId,
      "deletedBy.userId": { $ne: userId },
      isDeleted: false,
    };

    // If lastUpdatedAt is present, fetch chats with updatedAt > lastUpdatedAt
    if (lastUpdatedAt) {
      query.updatedAt = { $gt: new Date(lastUpdatedAt) };
    }

    let chats = await ChatModel.find(query)
      .populate({
        path: "participants.userId",
        select: "profilePicture username userTier",
      })
      .sort({ updatedAt: -1 })
      .lean();

    // add pinned chats to the populated chats
    chats = [...extraChats, ...chats];

    const populatedChats = await Promise.all(
      chats.map(async (chat) => {
        const lastMessage = await MessageModel.findOne({
          chatId: chat._id,
          isDeleted: false,
        })
          .sort({ createdAt: -1 })
          .select("content sentBy viewedBy createdAt")
          .lean();

        return { ...chat, lastMessage };
      })
    );

    // check if other user has a story if its single chat
    for (const chat of populatedChats) {
      if (chat.type === "single") {
        const otherUser = chat.participants.find(
          (p) =>
            p.userId !== null && (p.userId as any)._id.toString() !== userId
        );

        if (!otherUser) continue;

        // check if the other user has an active story and not seen by current user
        const storyIds = await StoryModel.distinct("_id", {
          userId: (otherUser.userId as any)._id.toString(),
          isDeleted: false,
          expiresAt: { $gt: new Date() },
          isCloseFriendsOnly: false,
        });

        const viewedStoryCount = await StoryViewModel.countDocuments({
          userId,
          storyId: { $in: storyIds },
        });

        // add hasStory field to the chat
        (chat as any).hasStory =
          storyIds.length > 0 && viewedStoryCount < storyIds.length
            ? true
            : false;
      }
    }

    return res.status(200).json({
      success: true,
      message: "Chats fetched successfully",
      count: populatedChats.length,
      lastUpdatedAt: new Date(),
      chats: populatedChats,
    });
  } catch (error) {
    console.error("Get all chats error:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching chats",
      error,
    });
  }
};

// delete a chat room
export const deleteChatRoom = async (req: Request, res: Response) => {
  try {
    const { chatId } = req.params;
    const { userId } = (req as any).user;

    const chat = await ChatModel.findOne({
      _id: chatId,
      isDeleted: false,
    });

    if (!chat) {
      return res.status(404).json({
        success: false,
        message: "Chat not found",
      });
    }

    // if chat is a group chat
    if (chat.type === "group") {
      // check if the user is the creator of the chat
      if (chat.createdBy.toString() !== userId) {
        return res.status(403).json({
          success: false,
          message: "You are not authorized to delete this chat",
        });
      }

      // delete all messages in the chat beacause the chat is deleted by the creator
      await MessageModel.updateMany(
        {
          chatId: chat._id,
        },
        {
          isDeleted: true,
        }
      );

      // delete the chat
      chat.isDeleted = true;
      await chat.save();
    } else {
      // if chat is a single chat
      // check if the user is a participant in the chat
      const isParticipant = chat.participants.some(
        (participant) => participant.userId.toString() === userId
      );

      // if the user is not a participant, return an error
      if (!isParticipant) {
        return res.status(403).json({
          success: false,
          message: "You are not a participant in this chat",
        });
      }

      // first remove the user from the deletedBy array if it exists
      await ChatModel.findByIdAndUpdate(chat._id, {
        $pull: {
          deletedBy: { userId },
        },
      });

      await Promise.all([
        // then add the user to the deletedBy array
        ChatModel.findByIdAndUpdate(chat._id, {
          $push: {
            deletedBy: { userId },
          },
        }),

        // remove the chat from the pinned chats of the user
        SettingsModel.updateOne({ userId }, { $pull: { pinnedChats: chatId } }),
      ]);
    }

    return res.status(200).json({
      success: chat ? true : false,
      message: chat ? "Chat deleted successfully" : "Chat deletion failed",
      chat: chat ? chat : null,
    });
  } catch (error) {
    console.error("Delete chat error:", error);
    return res.status(500).json({
      success: false,
      message: "Error deleting chat",
      error: error,
    });
  }
};

// search a chat rooms by participants
export const searchChatRoomByParticipants = async (
  req: Request,
  res: Response
) => {
  try {
    const { participants } = req.body;

    if (!participants) {
      return res.status(400).json({
        success: false,
        message: "Participants are required",
      });
    }

    // search chats where participants are in the participants array
    const chats = await ChatModel.find({
      "participants.userId": { $all: participants },
    }).sort({ updatedAt: -1 });

    // find last message of each chat
    const populatedChats = await Promise.all(
      chats.map(async (chat) => {
        const lastMessage = await MessageModel.findOne({
          chatId: chat._id,
        }).sort({ createdAt: -1 });
        return { ...chat.toObject(), lastMessage };
      })
    );

    return res.status(200).json({
      success: populatedChats ? true : false,
      message: populatedChats ? "Chats found" : "Chats not found",
      count: populatedChats ? populatedChats.length : 0,
      chats: populatedChats ? populatedChats : null,
    });
  } catch (error) {
    console.error("Search chat room by participants error:", error);
    return res.status(500).json({
      success: false,
      message: "Error searching chat room by participants",
      error: error,
    });
  }
};

// accept a chat request
export const acceptChatRequest = async (req: Request, res: Response) => {
  try {
    const { chatId } = req.params;
    const { userId } = (req as any).user;

    const chat = await ChatModel.findOneAndUpdate(
      { _id: chatId, "participants.userId": userId },
      {
        $set: {
          "participants.$.hasRequestAccepted": true,
          "participants.$.hasSeen": true,
        },
      },
      { new: true }
    );

    return res.status(200).json({
      success: chat ? true : false,
      message: chat
        ? "Chat request accepted successfully"
        : "Chat request not found",
      chat: chat ? chat : null,
    });
  } catch (error) {
    console.error("Accept chat request error:", error);
    return res.status(500).json({
      success: false,
      message: "Error accepting chat request",
      error: error,
    });
  }
};

// delete a chat request
export const deleteChatRequest = async (req: Request, res: Response) => {
  try {
    const { chatId } = req.params;
    const { userId } = (req as any).user;

    const chat = await ChatModel.findOneAndUpdate(
      { _id: chatId },
      {
        $pull: {
          participants: { userId: userId },
        },
      },
      { new: true }
    );

    if (chat?.participants.length === 1 && chat?.type === "single") {
      chat.isDeleted = true;
      await chat.save();
    }

    return res.status(200).json({
      success: chat ? true : false,
      message: chat
        ? "Chat request deleted successfully"
        : "Chat request not found",
      chat: chat ? chat : null,
    });
  } catch (error) {
    console.error("Delete chat request error:", error);
    return res.status(500).json({
      success: false,
      message: "Error deleting chat request",
      error: error,
    });
  }
};

// add users to a group chat
export const addUsersToGroupChat = async (req: Request, res: Response) => {
  try {
    const { chatId } = req.params;
    const { participants } = req.body;
    const { userId } = (req as any).user;

    const chat = await ChatModel.findOne({
      _id: chatId,
      type: "group",
      createdBy: userId,
    })
      .select("createdBy")
      .lean();

    if (!chat) {
      return res.status(404).json({
        success: false,
        message: "Chat not found or you are not the creator of this group chat",
      });
    }

    const formattedParticipants = participants.map((id: string) => ({
      userId: id,
      hasRequestAccepted: false,
      hasSeen: false,
    }));

    const updatedChat = await ChatModel.findByIdAndUpdate(
      chatId,
      {
        $push: {
          participants: { $each: formattedParticipants },
        },
      },
      { new: true }
    );

    return res.status(200).json({
      success: true,
      message: "Users added to group chat successfully",
      result: updatedChat,
    });
  } catch (error) {
    console.error("Add users to group chat error:", error);
    return res.status(500).json({
      success: false,
      message: "Error adding users to group chat",
      error: error,
    });
  }
};

// remove user from a group chat
export const removeUserFromGroupChat = async (req: Request, res: Response) => {
  try {
    const { chatId, participantId } = req.body;
    const { userId } = (req as any).user;

    const chat = await ChatModel.findOne({
      _id: chatId,
      type: "group",
      createdBy: userId,
    })
      .select("createdBy")
      .lean();

    if (!chat) {
      return res.status(404).json({
        success: false,
        message: "Chat not found or you are not the creator of this group chat",
      });
    }

    const updatedChat = await ChatModel.findByIdAndUpdate(
      chatId,
      {
        $pull: {
          participants: { userId: participantId },
        },
      },
      { new: true }
    );

    return res.status(200).json({
      success: true,
      message: "User removed from group chat successfully",
      result: updatedChat,
    });
  } catch (error) {
    console.error("Remove user from group chat error:", error);
    return res.status(500).json({
      success: false,
      message: "Error removing user from group chat",
      error: error,
    });
  }
};

// clear chat messages
export const clearChatMessages = async (req: Request, res: Response) => {
  try {
    const { chatId } = req.params;
    const { userId } = (req as any).user;

    const chat = await ChatModel.findById(chatId).select("participants").lean();

    if (!chat) {
      return res.status(404).json({
        success: false,
        message: "Chat not found",
      });
    }

    // check if the user is a participant in the chat
    const isParticipant = chat.participants.some(
      (participant) =>
        participant.userId.toString() === userId &&
        participant.hasRequestAccepted
    );

    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to clear chat messages",
      });
    }

    // clear chat messages
    await MessageModel.updateMany(
      { chatId },
      {
        $pull: {
          deletedBy: { userId },
        },
      }
    );

    await MessageModel.updateMany(
      { chatId },
      {
        $push: {
          deletedBy: { userId },
        },
      }
    );

    return res.status(200).json({
      success: true,
      message: "Chat messages cleared successfully",
    });
  } catch (error) {
    console.error("Clear chat messages error:", error);
    return res.status(500).json({
      success: false,
      message: "Error clearing chat messages",
      error: error,
    });
  }
};

// get a chat with chatId
export const getAChat = async (req: Request, res: Response) => {
  try {
    const { chatId } = req.params;
    const { userId } = (req as any).user;

    const chat = await ChatModel.findById(chatId)
      .populate({
        path: "participants.userId",
        select: "profilePicture username",
      })
      .lean();

    if (!chat) {
      return res.status(404).json({
        success: false,
        message: "Chat not found",
      });
    }

    // check if the user is a participant in the chat
    const isParticipant = chat.participants.some(
      (participant) => (participant.userId as any)._id.toString() === userId
    );

    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to get this chat",
      });
    }

    // check if the chat is pinned
    const isPinned = await SettingsModel.exists({
      userId,
      pinnedChats: chatId,
    });

    if (isPinned) {
      (chat as any).isPinnedChat = true;
    }

    return res.status(200).json({
      success: true,
      message: "Chat fetched successfully",
      result: chat,
    });
  } catch (error) {
    console.error("Get chat with chatId error:", error);
    return res.status(500).json({
      success: false,
      message: "Error getting chat with chatId",
      error: error,
    });
  }
};

// pin a chat
export const pinChat = async (req: Request, res: Response) => {
  try {
    const { chatId } = req.params;
    const userId = (req as any).user.userId;

    const settings: any = await SettingsModel.findOne({
      userId,
    }).select("pinnedChats");

    // remove last chat if pinned chats count is 3
    if (settings?.pinnedChats?.length >= 3) {
      settings.pinnedChats.pop();
    }

    settings.pinnedChats.push(chatId);
    await settings.save();

    return res.status(200).json({
      success: true,
      message: "Chat pinned successfully",
      result: {
        pinnedChats: settings.pinnedChats,
      },
    });
  } catch (error) {
    console.log("Error in pinChat", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error,
    });
  }
};

// unpin a chat
export const unpinChat = async (req: Request, res: Response) => {
  try {
    const { chatId } = req.params;
    const userId = (req as any).user.userId;

    const settings = await SettingsModel.findOneAndUpdate(
      { userId },
      { $pull: { pinnedChats: chatId } },
      { new: true }
    ).select("pinnedChats");

    return res.status(200).json({
      success: true,
      message: "Chat unpinned successfully",
      result: {
        pinnedChats: settings?.pinnedChats,
      },
    });
  } catch (error) {
    console.log("Error in unpinChat", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error,
    });
  }
};

// get chat profile data
export const getChatProfileData = async (req: Request, res: Response) => {
  try {
    const { userId, chatId } = req.body;
    const currentUserId = (req as any).user.userId;

    // check if chat is a group chat
    const isGroupChat = await ChatModel.exists({
      _id: chatId,
      type: "group",
    });

    // if chat is group chat then return isMuted field
    if (isGroupChat) {
      const isMuted = await SettingsModel.exists({
        userId: currentUserId,
        mutedChats: chatId,
      });

      return res.status(200).json({
        success: true,
        message: "User profile data fetched successfully",
        result: {
          isMuted: isMuted ? true : false,
        },
      });
    }

    if (!userId || !chatId) {
      return res.status(400).json({
        success: false,
        message: "Missing user ID or chat ID",
      });
    }

    // get user data
    const userData = await UserModel.findById(userId)
      .select("username fullName profilePicture userTier followersCount")
      .lean();

    if (!userData) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const [postsCount, chat, isMuted, storyIds, commonGroupChats] =
      await Promise.all([
        // get posts count of the user
        PostModel.countDocuments({ userId }),

        // get snap streak count of the user with current user
        ChatModel.findById(chatId).select("snapStreak").lean(),

        // check if this chat is muted by the current user
        SettingsModel.exists({
          userId: currentUserId,
          mutedChats: chatId,
        }),

        // get all story ids of the user
        StoryModel.distinct("_id", {
          userId,
          isDeleted: false,
          expiresAt: { $gt: new Date() },
          isCloseFriendsOnly: false,
        }),

        // get all common group chats name of the user and current user
        ChatModel.find({
          type: "group",
          isDeleted: false,
          "deletedBy.userId": { $nin: [userId, currentUserId] },
          participants: {
            $all: [
              { $elemMatch: { userId: userId } },
              { $elemMatch: { userId: currentUserId } },
            ],
          },
        })
          .distinct("groupName")
          .lean(),
      ]);

    // count the number of stories seen by the current user
    const viewedStoryCount = await StoryViewModel.countDocuments({
      userId: currentUserId,
      storyId: { $in: storyIds },
    });

    return res.status(200).json({
      success: true,
      message: "User profile data fetched successfully",
      result: {
        ...userData,
        postsCount,
        snapStreakCount: chat?.snapStreak || 0,
        isOnline: onlineUsers.get(userId) ? true : false,
        isMuted: isMuted ? true : false,
        hasStory:
          storyIds.length > 0 && viewedStoryCount < storyIds.length
            ? true
            : false,
        commonGroupChats,
      },
    });
  } catch (error) {
    console.log("Error in getUserProfileData", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error,
    });
  }
};

// toggle mute/unmute a chat
export const toggleMuteChat = async (req: Request, res: Response) => {
  try {
    const { chatId } = req.params;
    const currentUserId = (req as any).user.userId;

    if (!chatId) {
      return res.status(400).json({
        success: false,
        message: "Chat ID is required",
      });
    }

    // check if this chat is muted by the current user
    const isChatAlreadyMutedByCurrentUser = await SettingsModel.exists({
      userId: currentUserId,
      mutedChats: chatId,
    });

    if (isChatAlreadyMutedByCurrentUser) {
      await SettingsModel.findOneAndUpdate(
        { userId: currentUserId },
        {
          $pull: { mutedChats: chatId },
        }
      );
    } else {
      await SettingsModel.findOneAndUpdate(
        { userId: currentUserId },
        {
          $addToSet: { mutedChats: chatId },
        }
      );
    }

    return res.status(200).json({
      success: true,
      message: isChatAlreadyMutedByCurrentUser
        ? "Chat unmuted successfully"
        : "Chat muted successfully",
      result: {
        isMuted: !isChatAlreadyMutedByCurrentUser,
      },
    });
  } catch (error) {
    console.error("Error muting chat:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error,
    });
  }
};

// leave a group chat
export const leaveGroupChat = async (req: Request, res: Response) => {
  try {
    const { chatId } = req.params;
    const { userId } = (req as any).user;

    const chat = await ChatModel.findOne({
      _id: chatId,
      type: "group",
    })
      .select("participants")
      .lean();

    if (!chat) {
      return res.status(404).json({
        success: false,
        message: "Chat not found",
      });
    }

    // check if the user is a participant in the chat and has accepted the request
    const isParticipant = chat.participants.some(
      (participant) =>
        participant.userId.toString() === userId &&
        participant.hasRequestAccepted
    );

    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        message: "You are not a participant in this chat",
      });
    }

    // remove the user from the deletedBy array if it exists
    await ChatModel.findByIdAndUpdate(chatId, {
      $pull: { deletedBy: { userId } },
    });

    await Promise.all([
      // then add the user to the deletedBy array
      ChatModel.findByIdAndUpdate(chatId, {
        $push: { deletedBy: { userId } },
      }),

      // remove the user from the participants array
      ChatModel.findByIdAndUpdate(chatId, {
        $pull: { participants: { userId } },
      }),
    ]);

    return res.status(200).json({
      success: true,
      message: "You have left the chat",
    });
  } catch (error) {
    console.error("Error leaving group chat:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error,
    });
  }
};
