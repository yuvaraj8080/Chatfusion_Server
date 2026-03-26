import { Router } from "express";
import {
  followUser,
  unfollowUser,
  getAllFollowers,
  getAllFollowees,
  searchUsersInFolloweesList,
  searchUsersInFollowersList,
  declineFollowRequest,
  acceptFollowRequest,
  isFollowRequestAlreadySent,
  declineFollowBackRequest,
} from "./follow.controller";

const followRoutes = Router();

// /api/follow/followUser
followRoutes.post("/followUser", followUser);

// /api/follow/unfollowUser
followRoutes.post("/unfollowUser", unfollowUser);

// /api/follow/getAllFollowers/:userId
followRoutes.get("/getAllFollowers/:userId", getAllFollowers);

// /api/follow/getAllFollowees/:userId
followRoutes.get("/getAllFollowees/:userId", getAllFollowees);

// /api/follow/searchUsersInFolloweesList/:text
followRoutes.get(
  "/searchUsersInFolloweesList/:text",
  searchUsersInFolloweesList
);

// /api/follow/searchUsersInFollowersList/:text
followRoutes.get(
  "/searchUsersInFollowersList/:text",
  searchUsersInFollowersList
);

// /api/follow/acceptFollowRequest
followRoutes.post("/acceptFollowRequest", acceptFollowRequest);

// /api/follow/declineFollowRequest
followRoutes.post("/declineFollowRequest", declineFollowRequest);

// /api/follow/declineFollowBackRequest
followRoutes.post("/declineFollowBackRequest", declineFollowBackRequest);

// /api/follow/isFollowRequestAlreadySent/:targetUserId
followRoutes.get(
  "/isFollowRequestAlreadySent/:targetUserId",
  isFollowRequestAlreadySent
);

export default followRoutes;
