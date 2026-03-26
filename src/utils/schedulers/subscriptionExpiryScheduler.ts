import cron from "node-cron";
import { checkExpiredSubscriptions } from "../../paymentModule/subscriptionModule/subscription.controller";

// Run every day at 2 AM to check for expired subscriptions
export const startSubscriptionExpiryScheduler = cron.schedule(
  "0 2 * * *",
  async () => {
    console.log("⏰ Running subscription expiry scheduler...");

    try {
      await checkExpiredSubscriptions();

      console.log("✅ Subscription expiry check completed");
    } catch (error) {
      console.error(
        "❌ Error occurred while checking expired subscriptions:",
        error
      );
    }
  },
  { timezone: "Asia/Kolkata" }
);
