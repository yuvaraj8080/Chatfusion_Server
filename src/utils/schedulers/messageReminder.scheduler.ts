import cron from "node-cron";
import { MessageModel } from "../../chatMessage/message/message.model";
import { UserModel } from "../../user/user.model";
import { NotificationSettingsModel } from "../../setting/alerts&update/notificationSettings.model";
import {
  getServerKeyToken,
  sendPushNotification,
} from "../../notification/notification.controller";

/**
 * This job runs every 12 hours.
 * It checks all active chats and sends a reminder to users who have unread messages for more than 1 day.
 */
export const startMessageReminderScheduler = cron.schedule(
  "0 */12 * * *",
  async () => {
    console.log("⏰ Running message reminder scheduler...");

    const now = new Date();
    const reminderThreshold = new Date(now.getTime() - 12 * 60 * 60 * 1000); // 12 hours ago

    try {
      const messages = await MessageModel.find({
        createdAt: { $lte: reminderThreshold },
        isViewed: false,
        isDeleted: false,
      })
        .populate("chatId", "participants groupName")
        .lean();

      // Track already-notified users per chat
      const notifiedSet = new Set<string>(); // `${chatId}-${participantId}`

      for (const message of messages) {
        const chat: any = message.chatId;
        if (!chat || !chat.participants) continue;

        const senderId = message.sentBy.toString();

        for (const participant of chat.participants) {
          const participantId = participant.userId.toString();

          // Skip sender, unseen users, unaccepted users and already notified users
          const key = `${chat._id}-${participantId}`;
          if (
            participantId === senderId ||
            !participant.hasRequestAccepted ||
            message.viewedBy.some(
              (v) => v.userId.toString() === participantId
            ) ||
            notifiedSet.has(key)
          ) {
            continue;
          }

          // Mark this user as already notified for this chat
          notifiedSet.add(key);

          // Check notification settings
          const [receiver, notificationSetting] = await Promise.all([
            UserModel.findById(participantId, "fcmToken"),
            NotificationSettingsModel.findOne({ userId: participantId }).select(
              "muteAllNotifications messageNotifications.messageReminders"
            ),
          ]);

          if (
            receiver?.fcmToken &&
            !notificationSetting?.muteAllNotifications &&
            notificationSetting?.messageNotifications?.messageReminders === "on"
          ) {
            const notificationDetails = {
              notification: {
                title: "Genuinest",
                body: `You have unread messages in ${
                  chat.groupName || "a chat"
                }.`,
              },
              fcmToken: receiver.fcmToken,
              data: {
                type: "MESSAGE_REMINDER",
                chatId: chat._id.toString(),
              },
              serverKey: await getServerKeyToken(),
            };

            sendPushNotification(notificationDetails).catch(console.error);
          }
        }
      }

      console.log("✅ Message reminder notifications sent.");
    } catch (error) {
      console.error("❌ Failed to run message reminder job:", error);
    }
  },
  { timezone: "Asia/Kolkata" }
);
