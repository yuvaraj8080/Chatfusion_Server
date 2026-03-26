import { BlockedUserModel } from "../blockUser/blockedUser.model";

// check if the current user is blocked by the target user or the target user is blocked by the current user
export const isBlockedBetween = async (
  currentUserId: string,
  targetUserId: string
) => {
  const blockedUser = await BlockedUserModel.exists({
    $or: [
      { userId: currentUserId, "blockedUserIds.userId": targetUserId },
      { userId: targetUserId, "blockedUserIds.userId": currentUserId },
    ],
  });

  return blockedUser ? true : false;
};

// get all blocked user ids for a user that are blocked by the user and the user that blocked the user (for search and other operations)
export const getBlockedUserIds = async (userId: string) => {
  const [blockedByYou, blockedYou] = await Promise.all([
    BlockedUserModel.distinct("blockedUserIds.userId", { userId }),
    BlockedUserModel.distinct("userId", { "blockedUserIds.userId": userId }),
  ]);

  const allBlockedUserIds = [
    ...new Set([
      ...blockedByYou.map((id: any) => id.toString()),
      ...blockedYou.map((id: any) => id.toString()),
    ]),
  ];

  return allBlockedUserIds;
};
