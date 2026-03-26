import express from "express";
import {
  createUser,
  getUsersExceptFollowing,
  getUserById,
  saveUserName,
  suggestUsers,
  getUserSubscriptionDetails,
} from "./user.controller";

import { verifyAccessToken } from "../utils/generic/auth/auth.middleware";

const UserRoutes = express.Router();

// /api/users/createUser
UserRoutes.post("/createUser", createUser);

// /api/users/getUsersExceptFollowing
UserRoutes.get(
  "/getUsersExceptFollowing",
  verifyAccessToken,
  getUsersExceptFollowing
);

// /api/users/getUserById/:userId
UserRoutes.get("/getUserById/:userId", verifyAccessToken, getUserById);

// /api/users/saveUserName
UserRoutes.post("/saveUserName", saveUserName);

// /api/users/suggest
UserRoutes.get("/suggest", verifyAccessToken, suggestUsers);

// /api/users/subscription-details
UserRoutes.get(
  "/subscription-details",
  verifyAccessToken,
  getUserSubscriptionDetails
);

export default UserRoutes;
