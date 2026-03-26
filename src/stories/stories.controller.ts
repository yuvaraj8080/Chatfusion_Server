import { Request, Response } from "express";
import { StoryModel } from "./stories.model";
import { FollowModel } from "../follow/follow.model";
import mongoose from "mongoose";
import { LikeModel } from "../like/like.model";
import { UserModel } from "../user/user.model";
import { SettingsModel } from "../setting/settings.model";
import { NotificationModel } from "../notification/notification.model";
import { NotificationSettingsModel } from "../setting/alerts&update/notificationSettings.model";
import { isBlockedBetween } from "../utils/isBlockedBetween";
import {
  getServerKeyToken,
  sendPushNotification,
} from "../notification/notification.controller";
import { StoryViewModel } from "./storyView.model";

// create a story
export const createStory = async (req: Request, res: Response) => {
  try {
    const {
      mediaType,
      mediaUrl,
      sharedPost,
      stickers = [],
      isCloseFriendsOnly = false,
      mentionUserIds = [],
      turnOffComments = false,
      storyReshared,
    } = req.body;

    const { userId } = (req as any).user;

    if (!mediaUrl && !sharedPost) {
      return res.status(400).json({
        success: false,
        message: "Either mediaUrl or sharedPost is required to create a story",
      });
    }

    // 1. Validate mentioned users
    let validMentionedUsers: any[] = [];

    for (const mentionedUserId of mentionUserIds) {
      const settings = await SettingsModel.findOne({ userId: mentionedUserId });

      if (settings?.whoCanMention === "everyone") {
        validMentionedUsers.push({ userId: mentionedUserId });
      } else if (settings?.whoCanMention === "followees") {
        const isFollower = await FollowModel.exists({
          userId: mentionedUserId,
          followedUserId: userId,
          isFollowing: true,
        });
        if (isFollower) {
          validMentionedUsers.push({ userId: mentionedUserId });
        }
      }
    }

    // 2. Clean up mention stickers
    const validStickers = stickers.filter(
      (sticker: any) =>
        sticker.type !== "mention" ||
        validMentionedUsers.some(
          (u) => u.userId.toString() === sticker.data?.userId?.toString()
        )
    );

    // 3. Create the story
    const story = await StoryModel.create({
      userId,
      mediaType,
      mediaUrl,
      sharedPost,
      stickers: validStickers,
      isCloseFriendsOnly,
      mentionUserIds: validMentionedUsers,
      turnOffComments,
      storyReshared,
    });

    // 4. Notify mentioned users (individually)
    if (story && validMentionedUsers.length > 0) {
      const [creator, mentionedUsersSettings, mentionedUsers] =
        await Promise.all([
          UserModel.findById(userId, "username").lean(),
          NotificationSettingsModel.find({
            userId: { $in: validMentionedUsers.map((u) => u.userId) },
          })
            .select("userId muteAllNotifications storyNotifications.mentions")
            .lean(),
          UserModel.find({
            _id: { $in: validMentionedUsers.map((u) => u.userId) },
          })
            .select("fcmToken")
            .lean(),
        ]);

      const mentionedUsersFcmTokenMap: { [key: string]: string } =
        mentionedUsers.reduce((acc, user) => {
          acc[user._id.toString()] = user.fcmToken;
          return acc;
        }, {} as { [key: string]: string });

      for (const setting of mentionedUsersSettings) {
        if (setting?.storyNotifications?.mentions !== "no_one") {
          const notificationDetails = {
            title: "New Story Mention",
            message: `${creator?.username} mentioned you in a story`,
            senderId: userId,
            receiverId: setting.userId,
            type: "MENTION",
            targetId: story._id.toString(),
            mediaType: story.mediaType,
            mediaUrl: story.mediaUrl,
          };

          const pushNotificationDetails = {
            notification: {
              title: "Genuinest",
              body: `${creator?.username} mentioned you in a story`,
            },
            fcmToken: mentionedUsersFcmTokenMap[setting.userId.toString()],
            data: { type: "MENTION", id: story?._id.toString() },
            serverKey: await getServerKeyToken(),
          };

          if (setting?.storyNotifications?.mentions === "everyone") {
            NotificationModel.create({ ...notificationDetails }).catch(
              console.error
            );
            if (
              pushNotificationDetails?.fcmToken &&
              !setting?.muteAllNotifications
            ) {
              sendPushNotification(pushNotificationDetails).catch(
                console.error
              );
            }
          } else if (setting?.storyNotifications?.mentions === "followees") {
            const isFollower = await FollowModel.exists({
              userId: setting.userId,
              followedUserId: userId,
              isFollowing: true,
            });

            if (isFollower) {
              NotificationModel.create({ ...notificationDetails }).catch(
                console.error
              );
              if (
                pushNotificationDetails?.fcmToken &&
                !setting?.muteAllNotifications
              ) {
                sendPushNotification(pushNotificationDetails).catch(
                  console.error
                );
              }
            }
          }
        }
      }
    }

    // 5. send notification if its first story of the user
    if (story) {
      const storiesCount = await StoryModel.countDocuments({ userId });
      if (storiesCount === 1) {
        const followers = await FollowModel.distinct("userId", {
          followedUserId: userId,
          isFollowing: true,
        });

        const followees = await FollowModel.distinct("followedUserId", {
          userId,
          isFollowing: true,
        });

        const allValidUserIds = [
          ...new Set([
            ...followers.map((id: any) => id.toString()),
            ...followees.map((id: any) => id.toString()),
          ]),
        ];

        // get the creator and settings of the users
        const [creator, settings, users] = await Promise.all([
          UserModel.findById(userId, "username").lean(),
          NotificationSettingsModel.find({
            userId: { $in: allValidUserIds },
          })
            .select("userId muteAllNotifications storyNotifications.firstStory")
            .lean(),
          UserModel.find({
            _id: { $in: allValidUserIds },
          })
            .select("fcmToken")
            .lean(),
        ]);

        const usersFcmTokenMap: { [key: string]: string } = users.reduce(
          (acc, user) => {
            acc[user._id.toString()] = user.fcmToken;
            return acc;
          },
          {} as { [key: string]: string }
        );

        // send notification to the users who have not muted the first story
        for (const setting of settings) {
          if (setting?.storyNotifications?.firstStory !== "no_one") {
            const notificationDetails = {
              title: "New Story",
              message: `${creator?.username} posted their first story.`,
              senderId: userId,
              receiverId: setting.userId,
              type: "STORY",
              targetId: story?._id.toString(),
              mediaType: mediaType,
              mediaUrl: mediaUrl,
            };

            const pushNotificationDetails = {
              notification: {
                title: "Genuinest",
                body: `${creator?.username} posted their first story.`,
              },
              fcmToken: usersFcmTokenMap[setting.userId.toString()],
              data: { type: "STORY", id: story?._id.toString() },
              serverKey: await getServerKeyToken(),
            };

            if (setting?.storyNotifications?.firstStory === "everyone") {
              NotificationModel.create({ ...notificationDetails }).catch(
                console.error
              );
              if (
                pushNotificationDetails?.fcmToken &&
                !setting?.muteAllNotifications
              ) {
                sendPushNotification(pushNotificationDetails).catch(
                  console.error
                );
              }
            } else if (
              setting?.storyNotifications?.firstStory === "followees"
            ) {
              const isFollower = await FollowModel.exists({
                userId: setting.userId,
                followedUserId: userId,
                isFollowing: true,
              });

              if (isFollower) {
                NotificationModel.create({ ...notificationDetails }).catch(
                  console.error
                );
                if (
                  pushNotificationDetails?.fcmToken &&
                  !setting?.muteAllNotifications
                ) {
                  sendPushNotification(pushNotificationDetails).catch(
                    console.error
                  );
                }
              }
            }
          }
        }
      }
    }

    return res.status(201).json({
      success: story ? true : false,
      message: story ? "Story created successfully" : "Failed to create story",
      result: story ? story : null,
    });
  } catch (error) {
    console.error("Error creating story:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error,
    });
  }
};

// get all stories of the users he follows and his own stories
export const getHomePageStories = async (req: Request, res: Response) => {
  try {
    const userId = new mongoose.Types.ObjectId((req as any).user.userId) as any;

    // Step 1: Get the list of users the current user follows
    let usersIds = await FollowModel.distinct("followedUserId", {
      userId,
      isFollowing: true,
    });

    // Include current user
    usersIds.push(userId);

    // Step 2: Fetch current user's muted story list
    const currentUser = await UserModel.findById(userId)
      .select("mutedStoryUserIds")
      .lean();

    const mutedIdsSet = new Set(
      (currentUser?.mutedStoryUserIds || []).map((id: any) => id.toString())
    );

    // Filter out muted users
    usersIds = usersIds.filter((id: any) => !mutedIdsSet.has(id.toString()));

    // Step 3: Fetch non-deleted, non-expired stories of those users
    const groupedStories = await StoryModel.aggregate([
      {
        $match: {
          userId: { $in: usersIds },
          isDeleted: false,
          expiresAt: { $gt: new Date() },
        },
      },
      { $sort: { createdAt: -1 } },
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: "$user" },
      {
        $group: {
          _id: "$user._id", // userId
          username: { $first: "$user.username" },
          profilePicture: { $first: "$user.profilePicture" },
          userTier: { $first: "$user.userTier" },
          stories: {
            $push: {
              _id: "$_id",
              mediaType: "$mediaType",
              mediaUrl: "$mediaUrl",
              stickers: "$stickers",
              createdAt: "$createdAt",
              sharedPost: "$sharedPost",
              isCloseFriendsOnly: "$isCloseFriendsOnly",
              turnOffComments: "$turnOffComments",
              mentionUserIds: "$mentionUserIds",
              storyReshared: "$storyReshared",
            },
          },
        },
      },
      { $sort: { "stories.0.createdAt": -1 } },
    ]);

    // Step 4 & 5: Fetch visibility + notification settings in parallel
    const storyUserIds = groupedStories.map((g) => g._id.toString());

    const [userData, settingsDocs] = await Promise.all([
      UserModel.find({ _id: { $in: storyUserIds } })
        .select("hideStoryFrom closeFriends.userId")
        .lean(),
      NotificationSettingsModel.find({ userId: { $in: storyUserIds } })
        .select(
          "userId storyNotifications.canShareStoriesInMessage storyNotifications.canShareWhoAreMentionedInStory"
        )
        .lean(),
    ]);

    // Prepare lookup maps
    const userToHideStoryFrom = new Map<string, Set<string>>();
    const userToCloseFriends = new Map<string, Set<string>>();
    const userToSettings = new Map<string, any>();

    for (const user of userData) {
      userToHideStoryFrom.set(
        user._id.toString(),
        new Set((user.hideStoryFrom || []).map((id: any) => id.toString()))
      );

      userToCloseFriends.set(
        user._id.toString(),
        new Set(
          (user.closeFriends || []).map((cf: any) => cf.userId.toString())
        )
      );
    }

    for (const setting of settingsDocs) {
      userToSettings.set(setting.userId.toString(), {
        canShareStoriesInMessage:
          setting.storyNotifications.canShareStoriesInMessage,
        canShareWhoAreMentionedInStory:
          setting.storyNotifications.canShareWhoAreMentionedInStory,
      });
    }

    // Step 6: Filter each group of stories by visibility and sharing rules
    const homePageStories = groupedStories
      .map((group) => {
        const creatorId = group._id.toString();
        const isSelf = creatorId === userId.toString();

        const hideList = userToHideStoryFrom.get(creatorId) || new Set();
        const closeFriendsList = userToCloseFriends.get(creatorId) || new Set();
        const settings = userToSettings.get(creatorId) || {};

        // Skip entire group if creator has hidden stories from current user (unless it's self)
        if (!isSelf && hideList.has(userId.toString())) return null;

        // Filter individual stories
        const filteredStories = group.stories
          .map((story: any) => {
            const isCloseFriends = story.isCloseFriendsOnly;
            const isMentioned = story.mentionUserIds?.some(
              (obj: any) => obj.userId.toString() === userId.toString()
            );

            // Show only visible stories
            const isVisible =
              !isCloseFriends ||
              isSelf ||
              closeFriendsList.has(userId.toString());

            if (!isVisible) return null;

            // if current user is the story owner
            if (creatorId === userId.toString()) {
              return {
                ...story,
                isSharableByCurrentUser: true,
              };
            }

            // Sharing rule:
            // if canShareStoriesInMessage === false => false
            // if true and canShareWhoAreMentionedInStory === true => only if mentioned
            // else => true
            const canShareInMessage =
              settings.canShareStoriesInMessage === true;
            const canShareIfMentioned =
              settings.canShareWhoAreMentionedInStory === true;

            let isSharableByCurrentUser = false;
            if (canShareInMessage) {
              if (canShareIfMentioned) {
                isSharableByCurrentUser = isMentioned;
              } else {
                isSharableByCurrentUser = true;
              }
            }

            return {
              ...story,
              isSharableByCurrentUser,
            };
          })
          .filter(Boolean); // remove hidden/invisible stories

        if (filteredStories.length === 0) return null;

        return {
          _id: group._id,
          username: group.username,
          profilePicture: group.profilePicture,
          userTier: group.userTier,
          stories: filteredStories,
        };
      })
      .filter(Boolean); // remove null groups

    // Step 7: Check if story is liked and already viewed by the current user
    for (const group of homePageStories) {
      const storyIds = group?.stories?.map((s: any) => s._id) || [];

      // batch fetch likes + views for all stories in this group
      const [likedStoryIds, viewedStoryIds] = await Promise.all([
        LikeModel.distinct("storyId", {
          userId,
          storyId: { $in: storyIds },
          isDeleted: false,
        }),
        StoryViewModel.distinct("storyId", {
          userId,
          storyId: { $in: storyIds },
        }),
      ]);

      // convert to Sets
      const likedSet = new Set(likedStoryIds.map((id: any) => id.toString()));
      const viewedSet = new Set(viewedStoryIds.map((id: any) => id.toString()));

      let hasAllStoriesViewed = true;

      for (const story of group?.stories || []) {
        const id = story._id.toString();

        (story as any).isLiked = likedSet.has(id);

        if (!viewedSet.has(id)) {
          hasAllStoriesViewed = false;
        }
      }

      if (hasAllStoriesViewed) (group as any).hasAllStoriesViewed = true;
    }

    return res.status(200).json({
      success: true,
      message: "Home page stories fetched successfully",
      count: homePageStories.length,
      result: homePageStories,
    });
  } catch (error) {
    console.error("Error fetching stories:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error,
    });
  }
};

// delete a story
export const deleteStory = async (req: Request, res: Response) => {
  try {
    const { storyId } = req.params;
    const userId = (req as any).user.userId;

    // Find the story to ensure it belongs to the user
    const story = await StoryModel.findOne({
      _id: storyId,
      userId,
      isDeleted: false,
    });

    if (!story) {
      return res.status(404).json({
        success: false,
        message: "Story not found or you are not authorized to delete it",
      });
    }

    // Mark story as deleted
    story.isDeleted = true;
    await story.save();

    return res.status(200).json({
      success: story ? true : false,
      message: story ? "Story deleted successfully" : "Failed to delete story",
      result: story ? story : null,
    });
  } catch (error) {
    console.error("Error deleting story:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error,
    });
  }
};

// update a story
export const updateStory = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { storyId } = req.params;

    const story = await StoryModel.findOne({
      _id: storyId,
      userId,
      isDeleted: false,
    });

    if (!story) {
      return res.status(404).json({
        success: false,
        message: "Story not found or unauthorized",
      });
    }

    let validMentionedUsers: { userId: string }[] = [];

    // 1. Mentions logic
    if (req.body.mentionUserIds) {
      const existingMentionedIds = story.mentionUserIds.map((u: any) =>
        u.userId.toString()
      );
      const newMentionIds = req.body.mentionUserIds.filter(
        (id: string) => !existingMentionedIds.includes(id)
      );

      for (const mentionId of newMentionIds) {
        const settings = await SettingsModel.findOne({ userId: mentionId });

        if (settings?.whoCanMention === "everyone") {
          validMentionedUsers.push({ userId: mentionId });
        } else if (settings?.whoCanMention === "followees") {
          const isFollower = await FollowModel.exists({
            userId: mentionId,
            followedUserId: userId,
            isFollowing: true,
          });
          if (isFollower) validMentionedUsers.push({ userId: mentionId });
        }
      }

      // 2. Stickers cleanup
      const incomingStickers = req.body.stickers || story.stickers;
      const cleanedStickers = incomingStickers.filter(
        (sticker: any) =>
          sticker.type !== "mention" ||
          validMentionedUsers.some(
            (u) => u.userId.toString() === sticker.data?.userId?.toString()
          )
      );
      story.stickers = cleanedStickers;

      // 3. Add new mentioned users to story
      story.mentionUserIds.push(...(validMentionedUsers as any));
    }

    await story.save();

    // 4. Send notifications to newly mentioned users
    if (validMentionedUsers.length > 0) {
      const [creator, settingsList, usersList] = await Promise.all([
        UserModel.findById(userId, "username").lean(),
        NotificationSettingsModel.find({
          userId: { $in: validMentionedUsers.map((u) => u.userId) },
        })
          .select("userId muteAllNotifications storyNotifications.mentions")
          .lean(),
        UserModel.find({
          _id: { $in: validMentionedUsers.map((u) => u.userId) },
        })
          .select("fcmToken")
          .lean(),
      ]);

      const fcmTokenMap: Record<string, string> = usersList.reduce(
        (acc, user) => {
          acc[user._id.toString()] = user.fcmToken;
          return acc;
        },
        {} as Record<string, string>
      );

      for (const setting of settingsList) {
        const receiverId = setting.userId.toString();

        const allowMentionNotify =
          setting.storyNotifications?.mentions === "everyone" ||
          (setting.storyNotifications?.mentions === "followees" &&
            (await FollowModel.exists({
              userId: setting.userId,
              followedUserId: userId,
              isFollowing: true,
            })));

        if (!allowMentionNotify) continue;

        const notification = {
          title: "Story Mention",
          message: `${creator?.username} mentioned you in a story`,
          senderId: userId,
          receiverId,
          type: "MENTION",
          targetId: story._id.toString(),
          mediaType: story.mediaType,
          mediaUrl: story.mediaUrl,
        };

        NotificationModel.create(notification).catch(console.error);

        if (!setting.muteAllNotifications && fcmTokenMap[receiverId]) {
          const push = {
            notification: {
              title: "Genuinest",
              body: `${creator?.username} mentioned you in a story`,
            },
            fcmToken: fcmTokenMap[receiverId],
            data: { type: "MENTION", id: story?._id.toString() },
            serverKey: await getServerKeyToken(),
          };

          sendPushNotification(push).catch(console.error);
        }
      }
    }

    return res.status(200).json({
      success: true,
      message: "Story updated successfully",
      result: story,
    });
  } catch (error) {
    console.error("Error in updateStory:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error,
    });
  }
};

// Get stories for a specific user
export const getUserStories = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const currentUserId = (req as any).user.userId;

    const isBlocked = await isBlockedBetween(currentUserId, userId);
    if (isBlocked) {
      return res.status(403).json({
        success: false,
        message: "You are blocked by this user",
        result: null,
      });
    }

    const targetUser = await UserModel.findById(userId)
      .select("closeFriends.userId hideStoryFrom")
      .lean();

    // Check if current user is in hideStoryFrom list
    const isHidden =
      targetUser?.hideStoryFrom?.some(
        (id: any) => id.toString() === currentUserId
      ) ?? false;

    if (isHidden && currentUserId !== userId) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to view this user's stories",
        result: null,
      });
    }

    // Check if current user is close friend or self
    const isCloseFriend =
      userId === currentUserId ||
      (targetUser?.closeFriends || []).some(
        (cf: any) => cf.userId.toString() === currentUserId
      );

    // Set visibility condition
    const visibilityCondition = isCloseFriend
      ? {} // all stories
      : { isCloseFriendsOnly: false }; // public stories only

    // Get story sharing settings
    const settings = await NotificationSettingsModel.findOne({ userId })
      .select(
        "storyNotifications.canShareStoriesInMessage storyNotifications.canShareWhoAreMentionedInStory"
      )
      .lean();

    // Fetch stories
    const stories = await StoryModel.find({
      userId,
      isDeleted: false,
      expiresAt: { $gt: new Date() },
      ...visibilityCondition,
    })
      .populate("userId", "username profilePicture userTier")
      .select(
        "mediaType mediaUrl stickers mentionUserIds createdAt isCloseFriendsOnly sharedPost turnOffComments storyReshared"
      )
      .sort({ createdAt: -1 })
      .lean();

    // Inject isSharableByCurrentUser for each story and isLiked
    const finalStories = stories.map((story) => {
      const isMentioned = story.mentionUserIds?.some(
        (obj: any) => obj.userId.toString() === currentUserId
      );

      // if current user is the story owner
      if (userId === currentUserId) {
        return {
          ...story,
          isSharableByCurrentUser: true,
        };
      }

      let isSharableByCurrentUser = false;
      if (settings?.storyNotifications?.canShareStoriesInMessage === true) {
        if (
          settings?.storyNotifications?.canShareWhoAreMentionedInStory === true
        ) {
          isSharableByCurrentUser = isMentioned;
        } else {
          isSharableByCurrentUser = true;
        }
      }

      return {
        ...story,
        isSharableByCurrentUser,
      };
    });

    // Check if story is liked by current user
    const storyIds = finalStories.map((story) => story._id.toString());

    // liked stories
    const [likedStoryIds, viewedStoryCount] = await Promise.all([
      LikeModel.distinct("storyId", {
        userId: currentUserId,
        storyId: { $in: storyIds },
        isDeleted: false,
      }),
      StoryViewModel.countDocuments({
        userId: currentUserId,
        storyId: { $in: storyIds },
      }),
    ]);

    // make set
    const likedSet = new Set(likedStoryIds.map((id: any) => id.toString()));

    // attach flags
    for (const story of finalStories) {
      const id = story._id.toString();
      (story as any).isLiked = likedSet.has(id);
    }

    return res.status(200).json({
      success: true,
      message: "User stories fetched successfully",
      count: finalStories.length,
      hasAllStoriesViewed:
        storyIds.length > 0 && viewedStoryCount === storyIds.length
          ? true
          : false,
      result: finalStories,
    });
  } catch (error) {
    console.error("Error fetching user stories:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error,
    });
  }
};

// View a story - mark it as viewed by the user
export const viewStory = async (req: Request, res: Response) => {
  try {
    const { storyId } = req.params;
    const userId = (req as any).user.userId;

    await StoryViewModel.findOneAndUpdate(
      {
        userId,
        storyId,
      },
      { $set: { updatedAt: new Date() } },
      { upsert: true }
    );

    return res.status(200).json({
      success: true,
      message: "Story viewed successfully",
    });
  } catch (error) {
    console.error("Error viewing story:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error,
    });
  }
};

// Get all viewers of a story (with their viewedAt and user details)
export const getAllViewersOfStory = async (req: Request, res: Response) => {
  try {
    const { storyId } = req.params;
    const userId = (req as any).user.userId;

    // check if the story belongs to the user or not
    const story = await StoryModel.exists({
      _id: storyId,
      userId,
      isDeleted: false,
    });

    if (!story) {
      return res.status(404).json({
        success: false,
        message: "Story not found",
      });
    }

    const viewers = await StoryViewModel.find({
      storyId,
    })
      .populate("userId", "username fullname profilePicture")
      .sort({ viewedAt: -1 })
      .lean();

    return res.status(200).json({
      success: viewers ? true : false,
      message: viewers
        ? "Viewers fetched successfully"
        : "Failed to fetch viewers",
      count: viewers ? viewers.length : 0,
      result: viewers ? viewers : null,
    });
  } catch (error) {
    console.error("Error fetching viewers:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error,
    });
  }
};

// get users who liked a story
export const getUsersWhoLikedStory = async (req: Request, res: Response) => {
  try {
    const { storyId } = req.params;
    const userId = (req as any).user.userId;

    // check if the story belongs to the user or not
    const story = await StoryModel.exists({
      _id: storyId,
      userId,
      isDeleted: false,
    });

    if (!story) {
      return res.status(404).json({
        success: false,
        message: "Story not found",
      });
    }

    const users = await LikeModel.find({ storyId, isDeleted: false })
      .select("userId -_id")
      .populate("userId", "username fullName profilePicture")
      .lean();

    return res.status(200).json({
      success: users ? true : false,
      message: users
        ? "Users who liked story fetched successfully"
        : "Failed to fetch users who liked story",
      count: users ? users.length : 0,
      result: users ? users : null,
    });
  } catch (error) {
    console.error("Error fetching users who liked story:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error,
    });
  }
};

// get a story by id
export const getStoryById = async (req: Request, res: Response) => {
  try {
    const { storyId } = req.params;
    const userId = (req as any).user.userId;

    const [story, isLiked] = await Promise.all([
      StoryModel.findOne({
        _id: storyId,
        userId,
        isDeleted: false,
        expiresAt: { $gt: new Date() },
      }).lean(),
      LikeModel.exists({
        userId,
        storyId,
        isDeleted: false,
      }),
    ]);

    // If story is liked then add isLiked to story
    if (story && isLiked) (story as any).isLiked = true;

    return res.status(200).json({
      success: story ? true : false,
      message: story ? "Story fetched successfully" : "Story not found",
      result: story ? story : null,
    });
  } catch (error) {
    console.error("Error fetching story by id:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error,
    });
  }
};

// get all stories of a user where location sticker is used
export const getStoriesWithLocationSticker = async (
  req: Request,
  res: Response
) => {
  try {
    const { userId } = (req as any).user;

    const stories = await StoryModel.find({
      userId,
      isDeleted: false,
      stickers: {
        $elemMatch: {
          type: "location",
        },
      },
    })
      .select("stickers mediaUrl")
      .lean();

    const storiesWithLocationSticker = stories.map((story) => {
      // Filter out only location stickers
      const locationStickers = story.stickers.filter(
        (sticker: any) => sticker.type === "location"
      );

      return {
        storyId: story._id,
        mediaUrl: story.mediaUrl,
        stickerId: locationStickers[0].data.id,
        name: locationStickers[0].data.name,
        latitude: locationStickers[0].data.latitude,
        longitude: locationStickers[0].data.longitude,
      };
    });

    return res.status(200).json({
      success: stories ? true : false,
      message: stories
        ? "Stories with location sticker fetched successfully"
        : "Failed to fetch stories with location sticker",
      count: stories ? stories.length : 0,
      result: storiesWithLocationSticker ? storiesWithLocationSticker : null,
    });
  } catch (error) {
    console.error("Error fetching stories with location sticker:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error,
    });
  }
};

// mute a user's story
export const toggleMuteStory = async (req: Request, res: Response) => {
  try {
    const userId = req.params.userId;
    const currentUserId = (req as any).user.userId;

    if (userId.toString() === currentUserId) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to mute your own story",
      });
    }

    const currentUser = await UserModel.findById(currentUserId).select(
      "mutedStoryUserIds"
    );

    const isMuted = currentUser?.mutedStoryUserIds?.some(
      (id) => id.toString() === userId.toString()
    );

    if (isMuted) {
      await UserModel.findByIdAndUpdate(currentUserId, {
        $pull: { mutedStoryUserIds: userId },
      });
    } else {
      await UserModel.findByIdAndUpdate(currentUserId, {
        $addToSet: { mutedStoryUserIds: userId },
      });
    }

    return res.status(200).json({
      success: true,
      message: isMuted
        ? "Story unmuted successfully"
        : "Story muted successfully",
      result: {
        isMuted: !isMuted,
      },
    });
  } catch (error) {
    console.error("Error muting story:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error,
    });
  }
};

// check if the story is muted by the current user
export const isStoryMutedByUser = async (req: Request, res: Response) => {
  try {
    const userId = req.params.userId;
    const currentUserId = (req as any).user.userId;

    const isFound = await UserModel.findOne({
      _id: currentUserId,
      mutedStoryUserIds: { $in: [userId] },
    }).lean();

    return res.status(200).json({
      success: isFound ? true : false,
      message: isFound ? "Story muted by you" : "Story not muted by you",
      result: {
        isMuted: isFound ? true : false,
      },
    });
  } catch (error) {
    console.error("Error checking if story is muted by user:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error,
    });
  }
};

// check if story liked by current user
export const isStoryLikedByUser = async (req: Request, res: Response) => {
  try {
    const { storyId } = req.params;
    const userId = (req as any).user.userId;

    const isLiked = await LikeModel.exists({
      userId,
      storyId,
      isDeleted: false,
    });

    return res.status(200).json({
      success: isLiked ? true : false,
      message: isLiked ? "Story liked by user" : "Story not liked by user",
      result: isLiked ? true : false,
    });
  } catch (error) {
    console.error("Error checking if story is liked by user:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error,
    });
  }
};
