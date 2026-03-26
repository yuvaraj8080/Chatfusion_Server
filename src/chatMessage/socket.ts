import { Server, Socket } from "socket.io";
import { MessageModel } from "./message/message.model";
import { Server as HttpServer } from "http";
import jwt from "jsonwebtoken";
import { ChatModel } from "./chat/chat.model";
import { UserModel } from "../user/user.model";
import { FollowModel } from "../follow/follow.model";
import { NotificationSettingsModel } from "../setting/alerts&update/notificationSettings.model";
import {
  getServerKeyToken,
  sendPushNotification,
} from "../notification/notification.controller";
import { SettingsModel } from "../setting/settings.model";
import { NotificationModel } from "../notification/notification.model";
import { StoryViewModel } from "../stories/storyView.model";

// Map of userId -> Set of socket IDs
export const onlineUsers: Map<string, Set<string>> = new Map();

export const initSocketServer = (server: HttpServer) => {
  const io = new Server(server, {
    cors: {
      origin: "*",
    },
  });

  const getMessageBodyText = (content: any): string => {
    if (!content || !content.type) {
      return "New message";
    }
    switch (content.type) {
      case "text":
        return content.text || "New text message";
      case "audio":
        return "Sent an audio message";
      default:
        return `sent a ${content.type}`;
    }
  };

  // Authenticate each socket connection
  io.use((socket, next) => {
    const token = socket.handshake.headers.access_token;

    if (!token || Array.isArray(token)) {
      return next(new Error("Invalid token format"));
    }

    try {
      const payload = jwt.verify(
        token,
        process.env.ACCESS_TOKEN_SECRET as string
      );
      socket.data.user = payload;
      // console.log("✅ Socket authenticated:", socket.data.user);
      next();
    } catch (error) {
      // console.error("❌ Socket authentication error:", error);
      next(new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket: Socket) => {
    const userId = socket.data.user.userId;

    // Add user and socket ID to onlineUsers map
    if (!onlineUsers.has(userId)) {
      onlineUsers.set(userId, new Set());
    }

    // Add socket ID to user's set
    onlineUsers.get(userId)!.add(socket.id);

    // console.log(`🔗 User ${userId} connected with socket ${socket.id}`);

    // Join a chat room
    socket.on("join-chat", (chatId: string) => {
      socket.join(chatId);
      // console.log(`👥 User ${userId} joined conversation ${chatId}`);

      // emit user joined to all participants
      socket.to(chatId).emit("user-joined", { userId, chatId });
    });

    // Send a message
    socket.on("send-message", async (payload: any) => {
      try {
        const {
          receiverId,
          chatId,
          content,
          replyTo,
          mentionedUserIds = [],
          tempId,
          viewType,
          viewLimit,
          timerDuration,
          isOneTimeViewMessage,
        } = payload.data;

        const sentBy = socket.data.user.userId;

        if ((!receiverId && !chatId) || !content) {
          return socket.emit("error", {
            success: false,
            message: "Invalid data",
          });
        }

        if (viewType === "counter" && (viewLimit < 1 || viewLimit > 10)) {
          return socket.emit("error", {
            success: false,
            message: "View limit must be between 1 and 10",
          });
        }

        const mentionedUsersArray = mentionedUserIds.map((id: string) => ({
          userId: id,
        }));

        const newMessage = await MessageModel.create({
          receiver: receiverId,
          sentBy,
          chatId,
          content,
          replyTo,
          mentionedUsers: mentionedUsersArray,
          viewType,
          viewLimit,
          timerDuration,
          isOneTimeViewMessage,
          viewedBy: [{ userId: sentBy }],
        });

        const populatedMsg = await MessageModel.findById(
          newMessage._id
        ).populate([
          { path: "sentBy", select: "username profilePicture" },
          { path: "content.storyId" },
          { path: "content.snapId" },
          {
            path: "content.postId",
            populate: [
              {
                path: "userId",
                select: "username fullName profilePicture",
              },
              {
                path: "hashtags.tagId",
                select: "name",
              },
            ],
          },
          { path: "content.userProfileId", select: "username profilePicture" },
        ]);

        // get chat
        const chat = await ChatModel.findById(chatId);
        if (!chat) {
          return socket.emit("error", {
            success: false,
            message: "Chat not found",
          });
        }

        const isGroup = chat.type === "group";
        const senderUser = await UserModel.findById(sentBy, "username");

        for (const participant of chat.participants) {
          if (participant.userId.toString() === sentBy.toString()) {
            continue; // Skip sender
          }

          const participantId = participant.userId.toString();
          const us = await UserModel.findById(receiverId);

          // check if participant is online
          const isOnline = onlineUsers.has(participantId);

          // check if this chat muted by the participant
          const isChatMutedByParticipant = await SettingsModel.exists({
            userId: participantId,
            mutedChats: chatId,
          });

          if (isChatMutedByParticipant) {
            continue;
          }

          if (isOnline) {
            const socketIds = onlineUsers.get(participantId);

            socketIds?.forEach((sockId) => {
              const sock = io.sockets.sockets.get(sockId);
              sock?.emit("notification", {
                type: "new-message",
                data: populatedMsg,
              });
            });
          } else {
            // Only send push if user is offline
            const [receiverUser, notificationSetting] = await Promise.all([
              UserModel.findById(participantId, "fcmToken").lean(),
              NotificationSettingsModel.findOne({
                userId: participantId,
              })
                .select(
                  "muteAllNotifications messageNotifications.messageFromIndividualsAndGroupChats"
                )
                .lean(),
            ]);

            if (
              receiverUser?.fcmToken &&
              !notificationSetting?.muteAllNotifications &&
              notificationSetting?.messageNotifications
                ?.messageFromIndividualsAndGroupChats == "on"
            ) {
              const notificationDetails = {
                notification: {
                  title: isGroup
                    ? `(${us?.username}) ${chat.groupName}`
                    : `${us?.username || "Genuinest"}`,
                  body: `${senderUser?.username} : ${getMessageBodyText(
                    populatedMsg?.content
                  )}`,
                },
                fcmToken: receiverUser.fcmToken,
                data: {
                  type: "message",
                  isGroup: isGroup.toString(),
                  chatId: chatId.toString(),
                },
                serverKey: await getServerKeyToken(),
              };

              sendPushNotification(notificationDetails).catch(console.error);
            }
          }
        }

        // update chat updatedAt field
        chat.set("updatedAt", new Date());
        await chat.save();

        // Emit to everyone in the room (sender & accepted participants)
        return io.to(chatId).emit("new-message", {
          ...populatedMsg?.toObject(),
          tempId: tempId || null,
        });
      } catch (error) {
        console.error("Error sending message:", error);
        return socket.emit("error", {
          success: false,
          message: "Failed to send message",
        });
      }
    });

    //seen message
    socket.on("seen-message", async (payload: any) => {
      try {
        const { chatId, messageId } = payload.data;
        const seenBy = socket.data.user.userId;

        if (!chatId || !messageId) {
          return socket.emit("error", {
            success: false,
            message: "Invalid data",
          });
        }

        // Step 1: Add viewer if not already in viewedBy
        await MessageModel.updateOne(
          {
            _id: messageId,
            chatId,
            "viewedBy.userId": { $ne: seenBy },
          },
          {
            $push: { viewedBy: { userId: seenBy } },
          }
        );

        // Step 2: Fetch message + chat
        const [message, chat] = await Promise.all([
          MessageModel.findById(messageId),
          ChatModel.findById(chatId),
        ]);

        if (!message || !chat) {
          return socket.emit("error", {
            success: false,
            message: "Message or chat not found",
          });
        }

        // ----------------------
        // TIMER LOGIC (single chat + media + timer > 0)
        // ----------------------
        if (
          chat.type === "single" &&
          ["audio", "video", "image"].includes(message.content.type) &&
          message.timerDuration > 0 &&
          message.sentBy.toString() !== seenBy.toString()
        ) {
          // Already expired → block re-view
          if (message.isExpired) {
            return socket.emit("error", {
              success: false,
              message: "Media has expired",
            });
          }

          // Start timer only once
          if (!message.isViewed) {
            setTimeout(async () => {
              await MessageModel.updateOne(
                { _id: messageId },
                { $set: { isExpired: true } }
              );

              io.to(chatId).emit("message-timer-expired", {
                messageId,
                chatId,
              });
            }, message.timerDuration * 1000);
          }
        }

        // ----------------------
        // COUNTER LOGIC (only if no timer set)
        // ----------------------
        if (
          chat.type === "single" &&
          message.timerDuration <= 0 &&
          message.viewType === "counter" &&
          message.sentBy.toString() !== seenBy.toString() &&
          ["audio", "video", "image"].includes(message.content.type)
        ) {
          if (message.viewCount < message.viewLimit) {
            message.viewCount++;
            await message.save();

            // If limit reached → mark expired
            if (message.viewCount >= message.viewLimit) {
              await MessageModel.updateOne(
                { _id: messageId },
                { $set: { isExpired: true } }
              );
            }
          }
        }

        // ----------------------
        // ONE TIME VIEW LOGIC
        // ----------------------
        if (
          message.isOneTimeViewMessage &&
          message.sentBy.toString() !== seenBy.toString()
        ) {
          await MessageModel.updateOne(
            { _id: messageId },
            { $set: { isExpired: true } }
          );
        }

        // Step 3: Mark isViewed if all participants viewed
        const allViewed = message.viewedBy.length === chat.participants.length;

        if (allViewed && !message.isViewed) {
          await MessageModel.updateOne(
            { _id: messageId },
            { $set: { isViewed: true } }
          );
        }

        // Emit seen event
        return io.to(chatId).emit("message-seen", {
          messageId,
          viewedBy: seenBy,
          chatId,
        });
      } catch (error) {
        console.error("Error marking message as seen:", error);
        return socket.emit("error", {
          success: false,
          message: "Failed to mark message as seen",
        });
      }
    });

    // Screenshot taken handler
    socket.on("screen-shot-taken", async (payload: any) => {
      try {
        const {
          type,
          storyId,
          snapId,
          postId,
          profileId,
          userId: receiverId,
        } = payload.data;
        const sentBy = socket.data.user.userId;

        // check if this is story screenshot
        if (storyId) {
          await StoryViewModel.findOneAndUpdate(
            { userId: sentBy, storyId },
            { $set: { hasTakenScreenshot: true } },
            { upsert: true }
          );
        }

        // if screenshot is of any profile then only create in app notification and push notification
        if (profileId) {
          const [receiverUser, senderUser, notificationSettings] =
            await Promise.all([
              UserModel.findById(receiverId, "fcmToken").lean(),
              UserModel.findById(sentBy, "username").lean(),
              NotificationSettingsModel.findOne({
                userId: receiverId,
              })
                .select(
                  "muteAllNotifications messageNotifications.screenShotNotification"
                )
                .lean(),
            ]);

          // create in app notification
          const notificationDetails = {
            title: "New Screenshot Taken",
            message: `${senderUser?.username} has taken a screenshot of your profile`,
            senderId: sentBy,
            receiverId: profileId || receiverId,
            type: "SCREENSHOT_TAKEN",
            targetId: profileId || receiverId,
          };

          NotificationModel.create({ ...notificationDetails }).catch(
            console.error
          );

          // create push notification
          if (
            receiverUser?.fcmToken &&
            !notificationSettings?.muteAllNotifications &&
            notificationSettings?.messageNotifications
              ?.screenShotNotification === "on"
          ) {
            const pushNotificationDetails = {
              notification: {
                title: "New Screenshot Taken",
                body: `${senderUser?.username} has taken a screenshot of your profile`,
              },
              fcmToken: receiverUser.fcmToken,
              data: { type: "SCREENSHOT_TAKEN" },
              serverKey: await getServerKeyToken(),
            };

            sendPushNotification(pushNotificationDetails).catch(console.error);
          }

          return;
        }

        // Step 1: Check if chat exists between sentBy and receiverId
        let chat = await ChatModel.findOne({
          type: "single",
          isDeleted: false,
          participants: {
            $size: 2,
            $all: [
              { $elemMatch: { userId: sentBy } },
              { $elemMatch: { userId: receiverId } },
            ],
          },
        });

        // Step 2: Create chat if not exists
        if (!chat) {
          const [receiver, sender] = await Promise.all([
            UserModel.findById(receiverId, "isPrivate username fcmToken"),
            UserModel.findById(sentBy, "username"),
          ]);

          const [isFollowed, isFollowee] = await Promise.all([
            FollowModel.exists({
              userId: sentBy,
              followedUserId: receiverId,
              isFollowing: true,
            }),
            FollowModel.exists({
              userId: receiverId,
              followedUserId: sentBy,
              isFollowing: true,
            }),
          ]);

          const participantsObj = [
            {
              userId: sentBy,
              hasSeen: true,
              hasRequestAccepted: true,
            },
            {
              userId: receiverId,
              hasSeen: false,
              hasRequestAccepted: isFollowed && isFollowee ? true : false,
            },
          ];

          chat = await ChatModel.create({
            type: "single",
            createdBy: sentBy,
            participants: participantsObj,
          });

          // send push notification for request
          if (receiver?.fcmToken && (!isFollowed || !isFollowee)) {
            const pushDetails = {
              notification: {
                title: "Genuinest",
                body: `${sender?.username} wants to message you`,
              },
              fcmToken: receiver.fcmToken,
              data: {
                type: "MESSAGE_REQUEST",
              },
              serverKey: await getServerKeyToken(),
            };

            sendPushNotification(pushDetails).catch(console.error);
          }
        }

        const chatId = chat._id;

        // Step 3: Create screenshot message
        const newMessage = await MessageModel.create({
          sentBy,
          chatId,
          content: {
            type: "screenshot_callback",
            text: type,
            storyId,
            snapId,
            postId,
            userProfileId: profileId,
          },
        });

        const populatedMsg = await MessageModel.findById(
          newMessage._id
        ).populate([
          { path: "sentBy", select: "username profilePicture" },
          { path: "content.storyId" },
          { path: "content.snapId" },
          {
            path: "content.postId",
            populate: [
              {
                path: "userId",
                select: "username fullName profilePicture",
              },
              {
                path: "hashtags.tagId",
                select: "name",
              },
            ],
          },
          { path: "content.userProfileId", select: "username profilePicture" },
        ]);

        const chatData = await ChatModel.findById(chatId).lean();
        const senderUser = await UserModel.findById(sentBy, "username");

        for (const participant of chatData?.participants || []) {
          const participantId = participant.userId.toString();
          if (
            participantId === sentBy.toString() ||
            !participant.hasRequestAccepted
          ) {
            continue;
          }

          const isOnline = onlineUsers.has(participantId);

          if (isOnline) {
            const socketIds = onlineUsers.get(participantId);

            socketIds?.forEach((sockId) => {
              const sock = io.sockets.sockets.get(sockId);
              sock?.emit("notification", {
                type: "screenshot-taken",
                data: populatedMsg,
              });
            });
          } else {
            const [receiverUser, notificationSetting] = await Promise.all([
              UserModel.findById(participantId, "fcmToken").lean(),
              NotificationSettingsModel.findOne({
                userId: participantId,
              })
                .select(
                  "muteAllNotifications messageNotifications.screenShotNotification"
                )
                .lean(),
            ]);

            if (
              receiverUser?.fcmToken &&
              !notificationSetting?.muteAllNotifications &&
              notificationSetting?.messageNotifications
                ?.screenShotNotification === "on"
            ) {
              const notificationDetails = {
                notification: {
                  title: "Genuinest",
                  body: `${senderUser?.username} took a screenshot.`,
                },
                fcmToken: receiverUser.fcmToken,
                data: {
                  type: "SCREENSHOT_TAKEN",
                  chatId: chatId.toString(),
                },
                serverKey: await getServerKeyToken(),
              };

              sendPushNotification(notificationDetails).catch(console.error);
            }
          }
        }

        // Step 4: Join chat room for all participants
        [sentBy, receiverId].forEach((uid) => {
          const socketIds = onlineUsers.get(uid);

          socketIds?.forEach((sockId) => {
            const sock = io.sockets.sockets.get(sockId);
            sock?.join(chatId.toString());
          });
        });

        // Step 5: Emit new message
        return io.to(chatId.toString()).emit("new-message", populatedMsg);
      } catch (error) {
        console.error("Error handling screenshot event:", error);
        return socket.emit("error", {
          success: false,
          message: "Failed to process screenshot event",
        });
      }
    });

    // Create a new chat
    socket.on("create-chat", async (payload: any) => {
      try {
        const {
          content,
          replyTo,
          mentionedUserIds = [],
          participants,
          groupName,
        } = payload.data;

        const sentBy = socket.data.user.userId;

        if (!participants || !content || participants.length < 2) {
          return socket.emit("error", {
            success: false,
            message: "Invalid data",
          });
        }

        const sender = await UserModel.findById(sentBy, "username");

        const isGroupChat = participants.length > 2;

        const participantsObjArray: any[] = [];

        for (const participantId of participants) {
          if (participantId === sentBy) {
            participantsObjArray.push({
              userId: participantId,
              hasSeen: true,
              hasRequestAccepted: true,
            });
            continue;
          }

          const [participant, notificationSetting] = await Promise.all([
            UserModel.findById(
              participantId,
              "isPrivate username fcmToken"
            ).lean(),
            NotificationSettingsModel.findOne({ userId: participantId })
              .select(
                "muteAllNotifications messageNotifications.messageRequests messageNotifications.groupRequest"
              )
              .lean(),
          ]);

          const [isFollowed, isFollowee] = await Promise.all([
            FollowModel.exists({
              userId: sentBy,
              followedUserId: participantId,
              isFollowing: true,
            }),
            FollowModel.exists({
              userId: participantId,
              followedUserId: sentBy,
              isFollowing: true,
            }),
          ]);

          const pushNotificationDetails = {
            notification: {
              title: "Genuinest",
              body: "",
            },
            fcmToken: participant?.fcmToken,
            data: {
              type: isGroupChat ? "GROUP_REQUEST" : "MESSAGE_REQUEST",
            },
            serverKey: await getServerKeyToken(),
          };

          // ✅ Case: both follow each other → direct message
          if (isFollowed && isFollowee) {
            participantsObjArray.push({
              userId: participantId,
              hasSeen: false,
              hasRequestAccepted: true,
            });

            if (
              participant?.fcmToken &&
              !notificationSetting?.muteAllNotifications
            ) {
              pushNotificationDetails.notification.body = isGroupChat
                ? `${sender?.username} added you to a group`
                : `${sender?.username} sent you a message`;
              sendPushNotification(pushNotificationDetails).catch(
                console.error
              );
            }
          }
          // ❌ Case: anyone doesn’t follow → message request
          else {
            participantsObjArray.push({
              userId: participantId,
              hasSeen: false,
              hasRequestAccepted: false,
            });

            if (
              participant?.fcmToken &&
              !notificationSetting?.muteAllNotifications
            ) {
              pushNotificationDetails.notification.body = isGroupChat
                ? `${sender?.username} wants to add you to a group`
                : `${sender?.username} wants to message you`;
              sendPushNotification(pushNotificationDetails).catch(
                console.error
              );
            }
          }
        }

        let chat;

        // check that is a chat already exists if its single chat
        if (!isGroupChat) {
          const otherUser = participants.find((id: string) => id !== sentBy);

          chat = await ChatModel.findOne({
            type: "single",
            isDeleted: false,
            participants: {
              $size: 2,
              $all: [
                { $elemMatch: { userId: otherUser } },
                { $elemMatch: { userId: sentBy } },
              ],
            },
          });

          // if this user and otherUser deletes this chat then remove its id from deletedBy array
          if (chat) {
            await ChatModel.findByIdAndUpdate(chat._id, {
              $pull: {
                deletedBy: { userId: { $in: [userId, otherUser] } },
              },
            });
          }
        }

        if (!chat) {
          chat = await ChatModel.create({
            type: isGroupChat ? "group" : "single",
            createdBy: sentBy,
            participants: participantsObjArray,
            groupName,
          });
        }

        const mentionedUsersArray = mentionedUserIds.map((id: string) => ({
          userId: id,
        }));

        const newMessage = await MessageModel.create({
          sentBy,
          chatId: chat._id,
          content,
          replyTo,
          mentionedUsers: mentionedUsersArray,
        });

        const populatedMsg = await MessageModel.findById(
          newMessage._id
        ).populate([
          { path: "sentBy", select: "username profilePicture" },
          { path: "content.storyId" },
          { path: "content.snapId" },
          {
            path: "content.postId",
            populate: [
              {
                path: "userId",
                select: "username fullName profilePicture",
              },
              {
                path: "hashtags.tagId",
                select: "name",
              },
            ],
          },
          { path: "content.userProfileId", select: "username profilePicture" },
        ]);

        const chatIdStr = chat._id.toString();

        // join chat room for all participants
        for (const participant of participants) {
          const socketIds = onlineUsers.get(participant);

          if (socketIds) {
            socketIds.forEach((sockId: string) => {
              const sock = io.sockets.sockets.get(sockId);
              sock?.join(chatIdStr);
            });
          }
        }

        // emit new message to all participants
        return io.to(chatIdStr).emit("new-message", populatedMsg);
      } catch (error) {
        console.error("Error creating chat:", error);
        return socket.emit("error", {
          success: false,
          message: "Failed to create chat",
        });
      }
    });

    // Handle disconnect
    socket.on("disconnect", () => {
      // console.log(`❌ User ${userId} disconnected from ${socket.id}`);

      // get user's socket ids
      const socketSet = onlineUsers.get(userId);

      // remove socket id from user's set
      if (socketSet) {
        socketSet.delete(socket.id);

        // remove user from onlineUsers map if no sockets are left
        if (socketSet.size === 0) {
          onlineUsers.delete(userId);
        }
      }
    });
  });
};
