import "dotenv/config";
import express, { Application } from "express";
import cors from "cors";
import helmet from "helmet";
import mainRoutes from "./mainRoutes";
import { mongoose } from "@typegoose/typegoose";
import http from "http";
import { networkInterfaces } from "os";
import { calculateEngagementRatioScheduler } from "./utils/schedulers/calculateEngagementRatioScheduler";
import { initSocketServer } from "./chatMessage/socket";
import { startMessageReminderScheduler } from "./utils/schedulers/messageReminder.scheduler";
import { updateSnapStreakScheduler } from "./utils/schedulers/updateSnapStreak.scheduler";
import { startSubscriptionExpiryScheduler } from "./utils/schedulers/subscriptionExpiryScheduler";

(async () => {
  const app: Application = express();

  // Middleware
  app.use(cors({ origin: "*" }));
  app.use(helmet());
  app.use(express.json({ limit: "5000mb" }));
  app.use(
    express.urlencoded({
      limit: "5000mb",
      extended: true,
      parameterLimit: 50000000,
    })
  );

  // Database Connection
  try {
    await mongoose.connect(process.env.DB_URL as string);
    console.log("Connected to database!");
  } catch (error) {
    console.error("Database connection failed:", error);
  }
  mongoose.set("debug", false);

  // Create HTTP Server
  const server = http.createServer(app);

  initSocketServer(server);

  // Attach status and API routes
  app.use("/status", (_, res) => {
    res.send({ message: "Success" });
  });
  app.use("/api", mainRoutes);

  // initialize the schedulers
  calculateEngagementRatioScheduler.start();
  startMessageReminderScheduler.start();
  updateSnapStreakScheduler.start();
  startSubscriptionExpiryScheduler.start();

  // Start Server
  const port = parseInt(process.env.PORT || '3000');
  server.listen(port, '0.0.0.0', () => {
    const nets = networkInterfaces();
    const en0 = nets['en0'];
    const ip = en0?.find((addr: any) => addr.family === 'IPv4')?.address || 'localhost';
    console.log(`API server started at http://${ip}:${port}`);
  });
})();
