import { Router } from "express";

import {
  addUsersToCloseFriends,
  removeUsersFromCloseFriends,
  getCloseFriendsList,
} from "./closeFriends.controller";

const CloseFriendRoutes = Router();

// /api/setting/closeFriends/addUsersToCloseFriends
CloseFriendRoutes.patch("/addUsersToCloseFriends", addUsersToCloseFriends);

// /api/setting/closeFriends/removeUsersFromCloseFriends
CloseFriendRoutes.patch(
  "/removeUsersFromCloseFriends",
  removeUsersFromCloseFriends
);

// /api/setting/closeFriends/getCloseFriendsList
CloseFriendRoutes.get("/getCloseFriendsList", getCloseFriendsList);

export default CloseFriendRoutes;
