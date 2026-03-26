import cron from "node-cron";
import { ChatModel } from "../../chatMessage/chat/chat.model";
import { MessageModel } from "../../chatMessage/message/message.model";

/**
 * Scheduler to run at **midnight** every day
 */
export const updateSnapStreakScheduler = cron.schedule(
  "0 0 * * *", // 00:00 every day
  async () => {
    console.log("⏰ Running update snap streak scheduler...");

    try {
      // find all single chats where both users have accepted the request
      const chats = await ChatModel.find({
        type: "single",
        isDeleted: false,
        participants: {
          $size: 2,
          $not: { $elemMatch: { hasRequestAccepted: false } },
        },
      }).select("participants snapStreak lastSnapStreakDate");

      for (const chat of chats) {
        // Get current IST date & time
        const nowIST = new Date(
          new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
        );

        // Start & End of IST day
        const todayStartIST = new Date(
          nowIST.getFullYear(),
          nowIST.getMonth(),
          nowIST.getDate()
        );
        const todayEndIST = new Date(todayStartIST);
        todayEndIST.setDate(todayEndIST.getDate() + 1);

        // Check if streak already updated today (IST)
        if (
          chat.lastSnapStreakDate &&
          new Date(chat.lastSnapStreakDate) >= todayStartIST &&
          new Date(chat.lastSnapStreakDate) < todayEndIST
        ) {
          //   console.log("Snap streak already updated today.", chat._id);
          continue;
        }

        // Yesterday IST start & end
        const yesterdayStartIST = new Date(todayStartIST);
        yesterdayStartIST.setDate(todayStartIST.getDate() - 1);

        const yesterdayEndIST = new Date(todayEndIST);
        yesterdayEndIST.setDate(todayEndIST.getDate() - 1);

        // Fetch snaps sent yesterday (IST)
        const [userA, userB] = chat.participants.map((p) =>
          p.userId.toString()
        );

        const yesterdaySnaps = await MessageModel.find({
          chatId: chat._id,
          "content.type": "snap",
          createdAt: { $gte: yesterdayStartIST, $lt: yesterdayEndIST },
          isDeleted: false,
        }).lean();

        const sentSnap = { [userA]: false, [userB]: false };
        for (const msg of yesterdaySnaps) {
          if (msg.sentBy.toString() === userA) sentSnap[userA] = true;
          if (msg.sentBy.toString() === userB) sentSnap[userB] = true;
        }

        const bothSentYesterday = sentSnap[userA] && sentSnap[userB];

        if (bothSentYesterday) {
          chat.snapStreak = chat.snapStreak > 0 ? chat.snapStreak + 1 : 1;
          //   console.log("Snap streak incremented.", chat._id);
        } else {
          chat.snapStreak = 0;
          //   console.log("Snap streak reset.", chat._id);
        }

        chat.lastSnapStreakDate = todayStartIST;
        await chat.save();
      }

      console.log("✅ All snap streaks updated successfully.");
    } catch (error) {
      console.error("❌ Failed to run update snap streak job:", error);
    }
  },
  { timezone: "Asia/Kolkata" }
);
