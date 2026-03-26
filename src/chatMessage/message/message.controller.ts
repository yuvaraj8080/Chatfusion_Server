import { Request, Response } from "express";
import { MessageModel } from "./message.model";
import { ChatModel } from "../chat/chat.model";
import mongoose from "mongoose";

// create new message
export const createNewMessage = async (req: Request, res: Response) => {
  try {
    const { receiverId, chatId, content, replyTo, mentionedUserIds } = req.body;
    const sentBy = (req as any).user.userId;

    if ((!receiverId && !chatId) || !content) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
      });
    }

    // Find or create chat room
    const chatRoom = await findOrCreateChatRoom(sentBy, receiverId, chatId);

    // create an object array of mentioned users
    const mentionedUsersArray = mentionedUserIds
      ? mentionedUserIds.map((id: string) => ({ userId: id }))
      : [];

    // create new message
    const newMessage = await MessageModel.create({
      sentBy,
      chatId: chatRoom._id,
      content,
      replyTo,
      mentionedUsers: mentionedUsersArray,
    });

    // populate message with required fields
    const populatedMsg = await MessageModel.findById(newMessage._id).populate([
      { path: "sentBy", select: "username profilePicture" },
      { path: "content.storyId" },
      { path: "content.snapId" },
      { path: "content.postId" },
      { path: "content.userProfileId", select: "username profilePicture" },
    ]);

    // emit socket event
    const io = req.app.get("io");
    emitNewMessage(io, chatRoom, populatedMsg);

    return res.status(201).json({
      success: populatedMsg ? true : false,
      message: populatedMsg
        ? "Message sent successfully"
        : "Failed to send message",
      result: populatedMsg ? populatedMsg : null,
    });
  } catch (error) {
    console.error("createNewMessage error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to send message",
      error: error,
    });
  }
};

// find or create chat room
const findOrCreateChatRoom = async (
  sentBy: string,
  receiverId: string,
  chatId: string | null
) => {
  if (chatId) {
    const existingChat = await ChatModel.findById(chatId);

    if (!existingChat) {
      throw new Error("Chat room not found");
    }

    return existingChat;
  }

  // Find or create one-to-one chat
  let chatRoom = await ChatModel.findOne({
    type: "single",
    participants: {
      $all: [
        new mongoose.Types.ObjectId(sentBy),
        new mongoose.Types.ObjectId(receiverId),
      ],
      $size: 2,
    },
  });

  if (!chatRoom) {
    chatRoom = await ChatModel.create({
      type: "single",
      createdBy: sentBy,
      participants: [
        { userId: sentBy, hasSeen: true },
        { userId: receiverId, hasSeen: false },
      ],
    });
  }

  return chatRoom;
};

// emit new message to the chat using chatRoom id
const emitNewMessage = (io: any, chatRoom: any, populatedMsg: any) => {
  if (io && chatRoom.participants?.length) {
    io.to(chatRoom._id.toString()).emit("new-message", populatedMsg);
  }
};

// mark messages as viewed
export const markMessagesAsViewed = async (req: Request, res: Response) => {
  try {
    const { chatId } = req.body;
    const userId = (req as any).user.userId;

    if (!chatId) {
      return res.status(400).json({
        success: false,
        message: "ChatId is required",
      });
    }

    // Update messages and chat in parallel
    await Promise.all([
      // Update unviewed messages
      MessageModel.updateMany(
        {
          chatId,
          sentBy: { $ne: userId },
          "viewedBy.userId": { $ne: userId },
          isViewed: false,
        },
        {
          $push: { viewedBy: { userId } },
          $set: { isViewed: true },
        }
      ),

      // Update chat participant's seen status
      ChatModel.updateOne(
        { _id: chatId, "participants.userId": userId },
        { $set: { "participants.$.hasSeen": true } }
      ),
    ]);

    return res.status(200).json({
      success: true,
      message: "Messages marked as viewed",
    });
  } catch (error) {
    console.error("markMessagesAsViewed error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to mark messages as viewed",
      error: error,
    });
  }
};

// get all messages of a chat
export const getAllMessagesOfChat = async (req: Request, res: Response) => {
  try {
    const { chatId } = req.params;
    const { userId } = (req as any).user;

    // check if the current user is participant of this chat or not
    const isParticipant = await ChatModel.exists({
      _id: chatId,
      isDeleted: false,
      "participants.userId": userId,
    });

    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to get this chat",
      });
    }

    // Step 1: Find any message that contains the user's deletedAt
    const messageWithDeletedAt = await MessageModel.findOne({
      chatId,
      "deletedBy.userId": userId,
    }).select("deletedBy");

    let deletedAt: Date | null = null;

    if (messageWithDeletedAt) {
      const entry = messageWithDeletedAt.deletedBy.find(
        (d: any) => d.userId.toString() === userId
      );

      if (entry) {
        deletedAt = entry.deletedAt;
      }
    }

    // Step 2: Build the message filter
    const filter: any = {
      chatId,
      isDeleted: false,
    };

    if (deletedAt) {
      filter.createdAt = { $gt: deletedAt };
    }

    // Step 3: Fetch messages
    const messages = await MessageModel.find(filter)
      .populate([
        { path: "sentBy", select: "username profilePicture userTier" },
        { path: "content.storyId" },
        { path: "content.snapId" },
        {
          path: "content.postId",
          populate: [
            {
              path: "userId",
              select: "username fullName profilePicture userTier",
            },
            { path: "hashtags.tagId", select: "name" },
          ],
        },
        {
          path: "content.userProfileId",
          select: "username profilePicture userTier",
        },
      ])
      .lean();

    return res.status(200).json({
      success: true,
      message: "Messages fetched successfully",
      count: messages.length,
      result: messages,
    });
  } catch (error) {
    console.error("getAllMessagesOfChat error:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching messages",
      error,
    });
  }
};

// delete a message
export const deleteMessage = async (req: Request, res: Response) => {
  try {
    const { messageId } = req.params;
    const userId = (req as any).user.userId;

    const message = await MessageModel.findOneAndUpdate(
      { _id: messageId, isDeleted: false, sentBy: userId },
      { isDeleted: true },
      { new: true }
    );

    return res.status(200).json({
      success: message ? true : false,
      message: message
        ? "Message deleted successfully"
        : "Failed to delete message",
    });
  } catch (error) {
    console.error("deleteMessage error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete message",
      error: error,
    });
  }
};
