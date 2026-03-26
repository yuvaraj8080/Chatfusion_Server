import { Router } from "express";
import {
  blockUser,
  unblockUsers,
  getAllBlockedUsers,
} from "./blockedUser.controller";

const blockedUserRoutes = Router();

// /api/blocked-user/block
blockedUserRoutes.post("/block", blockUser);

// /api/blocked-user/unblock
blockedUserRoutes.post("/unblock", unblockUsers);

// /api/blocked-user/getAllBlockedUsers
blockedUserRoutes.get("/getAllBlockedUsers", getAllBlockedUsers);

export default blockedUserRoutes;
