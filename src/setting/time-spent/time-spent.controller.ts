import { TimeSpentModel } from "./time-spent.model";
import { Request, Response } from "express";
import mongoose from "mongoose";
import { formatDuration } from "../../utils/formatDuration";

// start session
export const startSession = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;

    // Check if an active session already exists
    const existingSession = await TimeSpentModel.findOne({
      userId,
      endTime: { $exists: false },
    });

    if (existingSession) {
      return res.status(400).json({
        success: false,
        message: "Session already started and not ended yet",
      });
    }

    const session = await TimeSpentModel.create({ userId });

    return res.status(200).json({
      success: session ? true : false,
      message: session ? "Session started" : "Session not started",
      result: session ? session : null,
    });
  } catch (error) {
    console.log("error in startSession", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// end session
export const endSession = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;

    const session = await TimeSpentModel.findOne({
      userId,
      endTime: { $exists: false }, // Get the latest open session
    });

    if (!session) {
      return res.status(400).json({
        success: false,
        message: "No active session found",
      });
    }

    const endTime = new Date();
    const duration = Math.floor(
      (endTime.getTime() - session.startTime.getTime()) / 1000 // convert to seconds
    );

    session.endTime = endTime;
    session.duration = duration;

    await session.save();

    return res.status(200).json({
      success: session ? true : false,
      message: session ? "Session ended" : "Session not ended",
      result: session ? session : null,
    });
  } catch (error) {
    console.log("error in endSession", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// get weekly usage
export const getWeeklyUsage = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;

    const now = new Date();
    const from = new Date(now);
    from.setDate(from.getDate() - 6);
    from.setHours(0, 0, 0, 0);

    const to = new Date();
    to.setHours(23, 59, 59, 999);

    // Aggregate sessions from last 7 days
    const rawData = await TimeSpentModel.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId),
          startTime: { $gte: from, $lt: to },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$startTime" },
          },
          totalDuration: { $sum: "$duration" },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ]);

    const result = [];

    for (let i = 6; i >= 0; i--) {
      const dateObj = new Date(now);
      dateObj.setDate(now.getDate() - i);
      dateObj.setHours(0, 0, 0, 0);

      const dateStr = dateObj.toLocaleDateString("en-CA"); // YYYY-MM-DD
      const todayStr = new Date().toLocaleDateString("en-CA");

      const isToday = dateStr === todayStr;
      const dayStr = isToday
        ? "Today"
        : dateObj.toLocaleDateString("en-US", { weekday: "short" });

      const entry = rawData.find((d) => d._id === dateStr);
      const duration = entry ? entry.totalDuration : 0;

      result.push({
        date: dateStr,
        day: dayStr,
        duration,
        formattedDuration: formatDuration(duration),
      });
    }

    const totalSeconds = result.reduce((sum, d) => sum + d.duration, 0);
    const dailyAverage = Math.floor(totalSeconds / 7);
    const formattedDailyAverage = formatDuration(dailyAverage);

    return res.status(200).json({
      success: true,
      message: "Weekly usage fetched successfully",
      result,
      dailyAverage,
      formattedDailyAverage,
    });
  } catch (error) {
    console.log("error in getWeeklyUsage", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};
