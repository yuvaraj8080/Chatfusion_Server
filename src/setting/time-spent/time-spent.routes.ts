import { Router } from "express";
import {
  startSession,
  endSession,
  getWeeklyUsage,
} from "./time-spent.controller";

const TimeSpentRoutes = Router();

// /api/setting/time-spent/start-session
TimeSpentRoutes.post("/start-session", startSession);

// /api/setting/time-spent/end-session
TimeSpentRoutes.post("/end-session", endSession);

// /api/setting/time-spent/weekly-usage
TimeSpentRoutes.get("/weekly-usage", getWeeklyUsage);

export default TimeSpentRoutes;
