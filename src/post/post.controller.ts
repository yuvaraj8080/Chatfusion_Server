import { Request, Response } from "express";
import { PostModel } from "./post.model";
import { FollowModel } from "../follow/follow.model";
import { LikeModel } from "../like/like.model";
import { getLocationByCoordinates } from "../utils/geocoder";
import { UserModel } from "../user/user.model";
import { TagModel } from "./tag.model";
import { SettingsModel } from "../setting/settings.model";
import { isBlockedBetween } from "../utils/isBlockedBetween";
import { getBlockedUserIds } from "../utils/isBlockedBetween";
import { NotificationModel } from "../notification/notification.model";
import { NotificationSettingsModel } from "../setting/alerts&update/notificationSettings.model";
import {
  getServerKeyToken,
  sendPushNotification,
} from "../notification/notification.controller";
import { StoryModel } from "../stories/stories.model";
import { SavePostModel } from "../savePost/savepost.model";
import { formatPostsInPattern } from "../utils/formatPostsInPattern";
import { PostViewModel } from "./postView.model";

// create post by user id
export const createPost = async (req: Request, res: Response) => {
  try {
    const {
      caption,
      mediaUrl,
      mediaType,
      taggedUsersIds = [],
      coordinates,
      hashtags = [],
      hideLikesCount = false,
      hideSharesCount = false,
      turnOffComments = false,
      audience,
      tapeThumbnailUrl,
    } = req.body;
    const userId = (req as any).user.userId;

    if (!mediaUrl || !mediaType || !coordinates) {
      return res.status(400).json({
        success: false,
        message: "some fields are missing",
      });
    }

    // 1. get the location info of the post
    const location = await getLocationByCoordinates(coordinates);

    if (!location) {
      return res.status(400).json({
        success: false,
        message: "Invalid coordinates or failed to get location",
      });
    }

    //create the user location
    const postLocation = {
      coordinates: [location.longitude, location.latitude],
      formattedAddress: location.formattedAddress || "",
      street: location.streetName || "",
      city: location.city || "",
      state: location.state || location.administrativeLevels?.level1long || "",
      zipcode: location.zipcode || "",
      country: location.country || "",
    };

    // 2. create hashtags
    const tags = [];
    if (hashtags) {
      for (const hashtag of hashtags) {
        const tag = await TagModel.findOne({ name: hashtag });

        // if tag does not exist, create it
        if (!tag) {
          const newTag = await TagModel.create({ name: hashtag });
          tags.push({ tagId: newTag._id });
        } else {
          tags.push({ tagId: tag._id }); // if tag exists, add it to the tags array

          // increment the tag count
          tag.tagUsageCount++;
          await tag.save();
        }
      }
    }

    // 3. create post without tagged users
    const post = await PostModel.create({
      userId,
      caption,
      mediaUrl,
      mediaType,
      location: postLocation,
      hashtags: tags,
      hideLikesCount,
      hideSharesCount,
      turnOffComments,
      audience,
      tapeThumbnailUrl,
    });

    // 4. create valid tagged users object array
    let validTaggedUsers = [];

    for (const taggedUserId of taggedUsersIds) {
      // get settings of the user
      const settings = await SettingsModel.findOne({
        userId: taggedUserId,
      });

      // if the user has manually approved tags, then add the post to the not approved posts array
      if (settings?.manuallyApproveTags) {
        settings.notApprovedPosts.push(post?._id as any);
        await settings.save();

        // send notification to the user
        const notificationDetails = {
          title: "New Post",
          message: `${userId} wants to tag you in a post`,
          senderId: userId,
          receiverId: taggedUserId,
          type: "TAG",
          targetId: post?._id.toString(),
          mediaType: mediaType,
          mediaUrl: mediaUrl[0],
        };

        NotificationModel.create({ ...notificationDetails }).catch(
          console.error
        );

        continue;
      }

      // if the user has not manually approved tags, then check if the user can taggged by everyone
      if (settings?.whoCanTag === "everyone") {
        validTaggedUsers.push({ userId: taggedUserId });
      }
      // check if the user can taggged by followees only
      else if (settings?.whoCanTag === "followees") {
        // check if this taggeduser is follower of post creator
        const isFollower = await FollowModel.exists({
          userId: taggedUserId,
          followedUserId: userId,
          isFollowing: true,
        });

        if (isFollower) {
          validTaggedUsers.push({ userId: taggedUserId });
        }
      }
    }

    // 5. add the valid tagged users to the post
    post.taggedUsers = validTaggedUsers;
    await post.save();

    // 6. send notification if its first post of the user
    if (post) {
      const postsCount = await PostModel.countDocuments({ userId });
      if (postsCount === 1) {
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
            .select("userId muteAllNotifications postNotifications.firstPosts")
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

        // send notification to the users who have not muted the first posts
        for (const setting of settings) {
          if (setting?.postNotifications?.firstPosts !== "no_one") {
            const notificationDetails = {
              title: "New Post",
              message: `${creator?.username} posted their first post`,
              senderId: userId,
              receiverId: setting.userId,
              type: "POST",
              targetId: post?._id.toString(),
              mediaType: mediaType,
              mediaUrl: mediaUrl[0],
            };

            const pushNotificationDetails = {
              notification: {
                title: "Genuinest",
                body: `${creator?.username} posted their first post`,
              },
              fcmToken: usersFcmTokenMap[setting.userId.toString()],
              data: { type: "POST", id: post?._id.toString() },
              serverKey: await getServerKeyToken(),
            };

            if (setting?.postNotifications?.firstPosts === "everyone") {
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
            } else if (setting?.postNotifications?.firstPosts === "followees") {
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

    // 7. get the creator and settings of the tagged users
    const [creator, taggedUsersSettings, taggedUsers] = await Promise.all([
      UserModel.findById(userId, "username").lean(),
      NotificationSettingsModel.find({
        userId: { $in: validTaggedUsers.map((u) => u.userId) },
      })
        .select(
          "userId muteAllNotifications postNotifications.photosOfYou postNotifications.collabartionInvitations"
        )
        .lean(),
      UserModel.find({
        _id: { $in: validTaggedUsers.map((u) => u.userId) },
      })
        .select("fcmToken")
        .lean(),
    ]);

    const taggedUsersFcmTokenMap: { [key: string]: string } =
      taggedUsers.reduce((acc, user) => {
        acc[user._id.toString()] = user.fcmToken;
        return acc;
      }, {} as { [key: string]: string });

    // 8. send notification to the tagged users if its a image post
    if (post && validTaggedUsers.length > 0 && mediaType === "image") {
      for (const setting of taggedUsersSettings) {
        if (setting?.postNotifications?.photosOfYou !== "no_one") {
          const notificationDetails = {
            title: "New Post Tagged",
            message: `${creator?.username} tagged you in a post`,
            senderId: userId,
            receiverId: setting.userId,
            type: "TAG",
            targetId: post._id.toString(),
            mediaType: mediaType,
            mediaUrl: mediaUrl[0],
          };

          const pushNotificationDetails = {
            notification: {
              title: "Genuinest",
              body: `${creator?.username} tagged you in a post`,
            },
            fcmToken: taggedUsersFcmTokenMap[setting.userId.toString()],
            data: { type: "TAG", id: post?._id.toString() },
            serverKey: await getServerKeyToken(),
          };

          if (setting?.postNotifications?.photosOfYou === "everyone") {
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
          } else if (setting?.postNotifications?.photosOfYou === "followees") {
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

    // 9. send collaboration request to the tagged users
    if (post && validTaggedUsers.length > 0) {
      for (const setting of taggedUsersSettings) {
        if (setting?.postNotifications?.collabartionInvitations !== "no_one") {
          const notificationDetails = {
            title: "New Collaboration Request",
            message: `${creator?.username} invited you to collaborate on a post`,
            senderId: userId,
            receiverId: setting.userId,
            type: "COLLABORATION_REQUEST",
            targetId: post._id.toString(),
            mediaType: mediaType,
            mediaUrl: mediaUrl[0],
          };

          const pushNotificationDetails = {
            notification: {
              title: "Genuinest",
              body: `${creator?.username} invited you to collaborate on a post`,
            },
            fcmToken: taggedUsersFcmTokenMap[setting.userId.toString()],
            data: { type: "COLLABORATION_REQUEST" },
            serverKey: await getServerKeyToken(),
          };

          if (
            setting?.postNotifications?.collabartionInvitations === "everyone"
          ) {
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
            setting?.postNotifications?.collabartionInvitations === "followees"
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

    return res.status(201).json({
      success: post ? true : false,
      message: post ? "Post created successfully" : "Failed to create post",
      result: post ? post : null,
    });
  } catch (error) {
    console.log("Error in createPost", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error,
    });
  }
};

// get home pages posts (User Feed + Suggested Posts)
export const getUserFeed = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    // Fetch followings, close friends, and blocked users
    const [followingIds, closeFriendsOf, blockedUserIds] = await Promise.all([
      FollowModel.distinct("followedUserId", { userId, isFollowing: true }),
      UserModel.distinct("_id", { "closeFriends.userId": userId }),
      getBlockedUserIds(userId),
    ]);

    const primaryUserIds = [...followingIds, userId];

    // --- USER FEED QUERY ---

    let postQuery: any = {
      $and: [
        {
          $or: [
            { userId: { $in: primaryUserIds } },
            { collaborators: { $in: primaryUserIds } },
          ],
        },
        {
          $nor: [
            { userId: { $in: blockedUserIds } },
            { collaborators: { $in: blockedUserIds } },
          ],
        },
        {
          $or: [
            { audience: { $ne: "closeFriends" } },
            { userId: { $in: closeFriendsOf } },
          ],
        },
      ],
      isDeleted: false,
    };

    const [userFeedCount, userFeedPosts] = await Promise.all([
      PostModel.countDocuments(postQuery),
      PostModel.find(postQuery)
        .populate([
          {
            path: "userId",
            select: "username fullName profilePicture isPrivate userTier",
          },
          { path: "hashtags.tagId", select: "name" },
          {
            path: "collaborators",
            select: "username fullName profilePicture isPrivate userTier",
          },
        ])
        .sort({ createdAt: -1, engagementRatio: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    const userFeedIds = userFeedPosts.map((p) => p._id.toString());

    // --- SUGGESTED POSTS ---

    const collaboratorsOfUserAndFollowings = await PostModel.distinct(
      "userId",
      {
        collaborators: { $in: [...followingIds, userId] },
      }
    );

    const excludedUserIds = [
      ...new Set([
        ...blockedUserIds,
        ...followingIds,
        ...collaboratorsOfUserAndFollowings,
        userId,
      ]),
    ];

    const publicUserIds = await UserModel.find({
      isPrivate: false,
      _id: { $nin: excludedUserIds },
    }).distinct("_id");

    const suggestedQuery: any = {
      userId: { $in: publicUserIds },
      isDeleted: false,
      $or: [
        { audience: { $ne: "closeFriends" } },
        { userId: { $in: closeFriendsOf } },
      ],
      _id: { $nin: userFeedIds },
    };

    const [suggestedPostCount, suggestedImagePosts, suggestedVideoPosts] =
      await Promise.all([
        PostModel.countDocuments(suggestedQuery),
        PostModel.find({
          ...suggestedQuery,
          mediaType: "image",
        })
          .populate([
            {
              path: "userId",
              select: "username fullName profilePicture isPrivate userTier",
            },
            { path: "hashtags.tagId", select: "name" },
            {
              path: "collaborators",
              select: "username fullName profilePicture isPrivate userTier",
            },
          ])
          .sort({ createdAt: -1, engagementRatio: -1 })
          .skip(skip)
          .limit(10)
          .lean(),
        PostModel.find({
          ...suggestedQuery,
          mediaType: "video",
        })
          .populate([
            {
              path: "userId",
              select: "username fullName profilePicture isPrivate userTier",
            },
            { path: "hashtags.tagId", select: "name" },
            {
              path: "collaborators",
              select: "username fullName profilePicture isPrivate userTier",
            },
          ])
          .sort({ createdAt: -1, engagementRatio: -1 })
          .skip(skip)
          .limit(10)
          .lean(),
      ]);

    const allPosts = [
      ...userFeedPosts,
      ...suggestedImagePosts,
      ...suggestedVideoPosts,
    ];

    // add isLiked, isSavedPost and isPinnedPost to each post
    const postIds = allPosts.map((post) => post._id.toString());

    // liked posts
    const likedPostIds = await LikeModel.distinct("postId", {
      userId,
      postId: { $in: postIds },
      isDeleted: false,
    });

    // saved posts
    const savedPostIds = await SavePostModel.distinct("postIds.postId", {
      userId,
      "postIds.postId": { $in: postIds },
      isDeleted: false,
    });

    // pinned posts
    const pinnedPostIds = await SettingsModel.distinct("pinnedPosts", {
      userId,
      pinnedPosts: { $in: postIds },
    });

    // make sets
    const likedSet = new Set(likedPostIds.map((id: any) => id.toString()));
    const savedSet = new Set(savedPostIds.map((id: any) => id.toString()));
    const pinnedSet = new Set(pinnedPostIds.map((id: any) => id.toString()));

    // attach flags
    for (const post of allPosts) {
      const id = post._id.toString();
      (post as any).isLiked = likedSet.has(id);
      (post as any).isSavedPost = savedSet.has(id);
      (post as any).isPinnedPost = pinnedSet.has(id);
    }

    return res.status(200).json({
      success: true,
      message: allPosts.length
        ? "Posts fetched successfully"
        : "No posts found",
      count: allPosts.length,
      currentPage: page,
      totalPages:
        userFeedCount === 0
          ? Math.ceil(suggestedPostCount / 10)
          : Math.ceil(userFeedCount / limit),
      result: {
        userFeedPosts,
        suggestedImagePosts,
        suggestedVideoPosts,
      },
    });
  } catch (error) {
    console.error("Error in getUserFeed:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error,
    });
  }
};

// update post by post id
export const updatePost = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { postId } = req.params;

    const post = await PostModel.findOne({
      _id: postId,
      userId,
      isDeleted: false,
    });

    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found or unauthorized",
      });
    }

    // Basic updates
    post.caption = req.body.caption ?? post.caption;
    post.mediaUrl = req.body.mediaUrl ?? post.mediaUrl;
    post.mediaType = req.body.mediaType ?? post.mediaType;
    post.audience = req.body.audience ?? post.audience;
    post.tapeThumbnailUrl = req.body.tapeThumbnailUrl ?? post.tapeThumbnailUrl;

    // 1. Update location if new coordinates sent
    if (req.body.coordinates) {
      const location = await getLocationByCoordinates(req.body.coordinates);

      if (!location) {
        return res.status(400).json({
          success: false,
          message: "Invalid coordinates or failed to get location",
        });
      }

      //create the user location
      const postLocation = {
        coordinates: [location.longitude, location.latitude],
        formattedAddress: location.formattedAddress || "",
        street: location.streetName || "",
        city: location.city || "",
        state:
          location.state || location.administrativeLevels?.level1long || "",
        zipcode: location.zipcode || "",
        country: location.country || "",
      };

      post.location = postLocation as any;
    }

    // 2. Add new hashtags
    if (req.body.hashtags?.length > 0) {
      const existingTagIds = post.hashtags.map((h: any) => h.tagId.toString());
      for (const hashtag of req.body.hashtags) {
        let tag = await TagModel.findOne({ name: hashtag });
        if (!tag) tag = await TagModel.create({ name: hashtag });
        else {
          tag.tagUsageCount++;
          await tag.save();
        }

        if (!existingTagIds.includes(tag._id.toString())) {
          post.hashtags.push({ tagId: tag._id as any });
        }
      }
    }

    // 3. Handle new tagged users
    if (req.body.taggedUsersIds) {
      const newTaggedUserIds = req.body.taggedUsersIds || [];
      const currentTaggedUserIds = post.taggedUsers.map((u: any) =>
        u.userId.toString()
      );
      const newlyTaggedUserIds = newTaggedUserIds.filter(
        (id: string) => !currentTaggedUserIds.includes(id)
      );

      const validTaggedUsers: { userId: string }[] = [];
      for (const taggedUserId of newlyTaggedUserIds) {
        const settings = await SettingsModel.findOne({ userId: taggedUserId });

        if (settings?.manuallyApproveTags) {
          settings.notApprovedPosts.push(post._id as any);
          await settings.save();
          continue;
        }

        if (settings?.whoCanTag === "everyone") {
          validTaggedUsers.push({ userId: taggedUserId });
        } else if (settings?.whoCanTag === "followees") {
          const isFollower = await FollowModel.findOne({
            userId: taggedUserId,
            followedUserId: userId,
            isFollowing: true,
          });
          if (isFollower) validTaggedUsers.push({ userId: taggedUserId });
        }
      }

      post.taggedUsers.push(...(validTaggedUsers as any));

      // 4. Send Tagged User & Collaboration Notifications (in-app + push)
      const [creator, settingsList, usersList] = await Promise.all([
        UserModel.findById(userId, "username").lean(),
        NotificationSettingsModel.find({
          userId: { $in: validTaggedUsers.map((u) => u.userId) },
        })
          .select(
            "userId muteAllNotifications postNotifications.photosOfYou postNotifications.collabartionInvitations"
          )
          .lean(),
        UserModel.find({
          _id: { $in: validTaggedUsers.map((u) => u.userId) },
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
        const taggedUserId = setting.userId.toString();

        // -- 4.1 Photos Of You --
        const allowTagNotify =
          setting.postNotifications?.photosOfYou === "everyone" ||
          (setting.postNotifications?.photosOfYou === "followees" &&
            (await FollowModel.exists({
              userId: setting.userId,
              followedUserId: userId,
              isFollowing: true,
            })));

        if (allowTagNotify && post.mediaType === "image") {
          NotificationModel.create({
            title: "New Post Tagged",
            message: `${creator?.username} tagged you in a post`,
            senderId: userId,
            receiverId: taggedUserId,
            type: "TAG",
            targetId: post._id.toString(),
            mediaType: post.mediaType,
            mediaUrl: post.mediaUrl[0],
          }).catch(console.error);

          if (!setting.muteAllNotifications && fcmTokenMap[taggedUserId]) {
            const pushNotificationDetails = {
              notification: {
                title: "Genuinest",
                body: `${creator?.username} tagged you in a post`,
              },
              fcmToken: fcmTokenMap[taggedUserId],
              data: { type: "TAG", id: post?._id.toString() },
              serverKey: await getServerKeyToken(),
            };

            sendPushNotification(pushNotificationDetails).catch(console.error);
          }
        }

        // -- 4.2 Collaboration Invitation --
        const allowCollab =
          setting.postNotifications?.collabartionInvitations === "everyone" ||
          (setting.postNotifications?.collabartionInvitations === "followees" &&
            (await FollowModel.exists({
              userId: setting.userId,
              followedUserId: userId,
              isFollowing: true,
            })));

        if (allowCollab) {
          NotificationModel.create({
            title: "Collaboration Request",
            message: `${creator?.username} invited you to collaborate on a post`,
            senderId: userId,
            receiverId: taggedUserId,
            type: "COLLABORATION_REQUEST",
            targetId: post._id.toString(),
            mediaType: post.mediaType,
            mediaUrl: post.mediaUrl[0],
          }).catch(console.error);

          if (!setting.muteAllNotifications && fcmTokenMap[taggedUserId]) {
            const pushNotificationDetails = {
              notification: {
                title: "Genuinest",
                body: `${creator?.username} invited you to collaborate on a post`,
              },
              fcmToken: fcmTokenMap[taggedUserId],
              data: { type: "COLLABORATION_REQUEST" },
              serverKey: await getServerKeyToken(),
            };

            sendPushNotification(pushNotificationDetails).catch(console.error);
          }
        }
      }
    }

    await post.save();

    return res.status(200).json({
      success: true,
      message: "Post updated successfully",
      result: post,
    });
  } catch (error) {
    console.error("Error in updatePost:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error,
    });
  }
};

// delete post by post id
export const deletePost = async (req: Request, res: Response) => {
  try {
    const { postId } = req.params;
    const userId = (req as any).user.userId;

    const post = await PostModel.findOne({
      _id: postId,
      userId,
      isDeleted: false,
    }).select("isDeleted userId");

    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found or you are not authorized to delete this post",
      });
    }

    await Promise.all([
      // if the post is pinned then unpin it
      SettingsModel.findOneAndUpdate(
        { userId: post.userId },
        { $pull: { pinnedPosts: postId } }
      ),

      // if the post is saved then remove it from the save post collection of all users who saved it
      SavePostModel.updateMany(
        { "postIds.postId": postId },
        { $pull: { postIds: { postId: postId } } }
      ),
    ]);

    // Mark post as deleted instead of physically deleting
    post.isDeleted = true;
    await post.save();

    return res.status(200).json({
      success: true,
      message: "Post deleted successfully",
      result: post,
    });
  } catch (error) {
    console.log("Error in deletePost", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error,
    });
  }
};

// get a post details by post id
export const getPostById = async (req: Request, res: Response) => {
  try {
    const { postId } = req.params;
    const userId = (req as any).user.userId;

    let post = await PostModel.findOne({
      _id: postId,
      isDeleted: false,
    })
      .populate([
        {
          path: "userId",
          select:
            "username fullName profilePicture isPrivate userTier closeFriends",
        },
        {
          path: "hashtags.tagId",
          select: "name",
        },
        {
          path: "collaborators",
          select: "username fullName profilePicture isPrivate userTier",
        },
      ])
      .lean();

    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found",
      });
    }

    const isOwner = (post.userId as any)._id.toString() === userId;
    const isCollaborator = post.collaborators.some(
      (c: any) => c._id.toString() === userId
    );

    // 1. Block check (unless owner or collaborator)
    const isBlocked = await isBlockedBetween(userId, (post.userId as any)._id);
    if (isBlocked && !isOwner && !isCollaborator) {
      return res.status(403).json({
        success: false,
        message: "You can't view this post (blocked)",
      });
    }

    // 2. Private account check
    if (!isOwner && !isCollaborator && (post.userId as any).isPrivate) {
      const isFollower = await FollowModel.findOne({
        userId,
        followedUserId: (post.userId as any)._id,
        isFollowing: true,
      });

      if (!isFollower) {
        return res.status(403).json({
          success: false,
          message: "You can't view this post (private account)",
        });
      }
    }

    // 3. Close friends check
    if (!isOwner && !isCollaborator && post.audience === "closeFriends") {
      const isInCloseFriends = (post.userId as any)?.closeFriends?.some(
        (friend: any) => friend.userId.toString() === userId
      );

      if (!isInCloseFriends) {
        return res.status(403).json({
          success: false,
          message: "You can't view this post (close friends only)",
        });
      }
    }

    // remove close friends list from post owner info
    (post.userId as any).closeFriends = undefined;

    // add isLiked, isSavedPost and isPinnedPost to each post
    const [isLiked, isSaved, isPinned] = await Promise.all([
      LikeModel.exists({
        userId,
        postId: post._id,
        isDeleted: false,
      }),
      SavePostModel.exists({
        userId,
        "postIds.postId": post._id,
        isDeleted: false,
      }),
      SettingsModel.exists({
        userId,
        pinnedPosts: post._id,
      }),
    ]);

    if (isLiked) (post as any).isLiked = true;

    if (isSaved) (post as any).isSavedPost = true;

    if (isPinned) (post as any).isPinnedPost = true;

    return res.status(200).json({
      success: true,
      message: "Post fetched successfully",
      result: post,
    });
  } catch (error) {
    console.log("Error in getPostById:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error,
    });
  }
};

// get all posts by user id
export const getAllPostsByUserId = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const currentUserId = (req as any).user.userId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    // Blocked check
    const isBlocked = await isBlockedBetween(userId, currentUserId);
    if (isBlocked) {
      return res.status(403).json({
        success: false,
        message: "You can't view this user's posts",
      });
    }

    // get pinned posts
    const settings = await SettingsModel.findOne({
      userId,
    })
      .select("pinnedPosts")
      .populate("pinnedPosts", "mediaUrl mediaType tapeThumbnailUrl");

    // Close Friends Check
    const isCloseFriend = await UserModel.exists({
      _id: userId,
      "closeFriends.userId": currentUserId,
    });

    const query = {
      userId,
      isDeleted: false,
      ...(isCloseFriend ? {} : { audience: { $ne: "closeFriends" } }),
      _id: { $nin: settings?.pinnedPosts },
    };

    let [posts, totalPosts] = await Promise.all([
      PostModel.find(query)
        .select("mediaUrl mediaType tapeThumbnailUrl")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      PostModel.countDocuments(query),
    ]);

    // if this is 1st page then also add pinned posts
    if (page === 1) {
      const extraPosts = settings?.pinnedPosts.map((post: any) => {
        return {
          ...post.toObject(),
          isPinnedPost: true,
        };
      }) as any;
      posts = [...extraPosts, ...posts] as any;
    }

    return res.status(200).json({
      success: true,
      message: posts.length ? "Posts fetched successfully" : "No posts found",
      totalPosts: totalPosts,
      count: posts.length,
      totalPages: Math.ceil(totalPosts / limit),
      currentPage: page,
      result: posts,
    });
  } catch (error) {
    console.error("Error in getAllPostsByUserId:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error?.message || error,
    });
  }
};

// get all tagged posts by user id
export const getAllTaggedPostsByUserId = async (
  req: Request,
  res: Response
) => {
  try {
    const profileUserId = req.params.userId; // whose profile you are viewing
    const viewerUserId = (req as any).user.userId; // current user viewing the profile

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    // Blocked check
    const isBlocked = await isBlockedBetween(profileUserId, viewerUserId);
    if (isBlocked) {
      return res.status(403).json({
        success: false,
        message: "You can't view this user's tagged posts",
      });
    }

    // Check blocked by viewer and if viewer is close friend of post owner
    const [viewerBlockedUserIds, closeFriendPostOwners] = await Promise.all([
      getBlockedUserIds(viewerUserId),
      UserModel.distinct("_id", { "closeFriends.userId": profileUserId }),
    ]);

    // get hidden tagged posts of profile user
    const hiddenTaggedPosts = await SettingsModel.distinct(
      "hiddenTaggedPosts",
      {
        userId: profileUserId,
      }
    );

    const query = {
      "taggedUsers.userId": profileUserId,
      isDeleted: false,
      userId: { $nin: viewerBlockedUserIds },
      $or: [
        { audience: { $ne: "closeFriends" } },
        { userId: { $in: closeFriendPostOwners } },
      ],
      _id: { $nin: hiddenTaggedPosts },
    };

    const [posts, totalPosts] = await Promise.all([
      PostModel.find(query)
        .select("mediaUrl mediaType tapeThumbnailUrl")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      PostModel.countDocuments(query),
    ]);

    return res.status(200).json({
      success: true,
      message: posts.length
        ? "Tagged posts fetched successfully"
        : "No tagged posts found",
      count: posts.length,
      totalPages: Math.ceil(totalPosts / limit),
      currentPage: page,
      result: posts,
    });
  } catch (error) {
    console.error("Error in getAllTaggedPostsByUserId:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error?.message || error,
    });
  }
};

// get all tapes of user by user id
export const getAllTapesByUserId = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const currentUserId = (req as any).user.userId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    // Blocked check
    const isBlocked = await isBlockedBetween(userId, currentUserId);
    if (isBlocked) {
      return res.status(403).json({
        success: false,
        message: "You can't view this user's tapes",
      });
    }

    // Close Friends Check
    const isCloseFriend = await UserModel.exists({
      _id: userId,
      "closeFriends.userId": currentUserId,
    });

    const query = {
      userId,
      mediaType: "video",
      isDeleted: false,
      ...(isCloseFriend ? {} : { audience: { $ne: "closeFriends" } }),
    };

    let [posts, totalPosts] = await Promise.all([
      PostModel.find(query)
        .select("mediaUrl mediaType tapeThumbnailUrl")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      PostModel.countDocuments(query),
    ]);

    // add viewers count
    for (const post of posts) {
      const viewersCount = await PostViewModel.countDocuments({
        postId: post._id,
      });

      (post as any).viewersCount = viewersCount;
    }

    return res.status(200).json({
      success: true,
      message: posts.length ? "Tapes fetched successfully" : "No tapes found",
      count: posts.length,
      totalPages: Math.ceil(totalPosts / limit),
      currentPage: page,
      result: posts,
    });
  } catch (error) {
    console.error("Error in getAllTapesByUserId:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error,
    });
  }
};

// get user details who liked a post
export const getUsersWhoLikedPost = async (req: Request, res: Response) => {
  try {
    const { postId } = req.params;

    // get all users who liked this post
    const likes = await LikeModel.find({ postId, isDeleted: false })
      .select("userId -_id")
      .populate("userId", "username fullName profilePicture userTier")
      .lean();

    return res.status(200).json({
      success: likes ? true : false,
      message: likes
        ? "Users who liked the post fetched successfully"
        : "No users who liked the post found",
      count: likes ? likes.length : 0,
      result: likes ? likes : null,
    });
  } catch (error) {
    console.log("Error in getUsersWhoLikedPost", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error,
    });
  }
};

// view a post
export const viewPost = async (req: Request, res: Response) => {
  try {
    const { postId } = req.params;
    const userId = (req as any).user.userId;

    await PostViewModel.findOneAndUpdate(
      {
        userId,
        postId,
      },
      { $set: { updatedAt: new Date() } },
      { upsert: true }
    );

    return res.status(200).json({
      success: true,
      message: "Post viewed successfully",
    });
  } catch (error) {
    console.log("Error in viewPost", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error,
    });
  }
};

// Get posts by location using user's coordinates and distance in km
export const getPostsByLocation = async (req: Request, res: Response) => {
  try {
    const { distance } = req.params;
    const { userId } = (req as any).user;

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const user = await UserModel.findById(userId, "location");

    // Get user's location coordinates
    const [lng, lat] = user?.location?.coordinates || [];

    if (!lng || !lat) {
      return res.status(400).json({
        success: false,
        message: "User location not set",
      });
    }

    const radius = Number(distance) / 6378.1; // Convert km to radians

    // 1. Blocked users
    const allBlockedUserIds = await getBlockedUserIds(userId);

    // 2. Followed users
    const followingIds = await FollowModel.distinct("followedUserId", {
      userId,
      isFollowing: true,
    });

    // 3. Public users (not blocked or self)
    const publicUserIds = await UserModel.find({
      isPrivate: false,
      _id: { $nin: [...allBlockedUserIds, userId] },
    }).distinct("_id");

    // 4. Allowed user IDs: public + followed + self
    const allowedUserIds = [
      ...new Set([
        ...followingIds.map((id: any) => id.toString()),
        ...publicUserIds.map((id: any) => id.toString()),
        userId,
      ]),
    ];

    // 5. Final query with location + allowed users
    const query = {
      location: {
        $geoWithin: { $centerSphere: [[lng, lat], radius] },
      },
      userId: { $in: allowedUserIds },
      isDeleted: false,
    };

    const totalPosts = await PostModel.countDocuments(query);

    const posts = await PostModel.find(query)
      .select("mediaUrl mediaType tapeThumbnailUrl")
      .sort({ createdAt: -1, engagementRatio: -1 })
      .skip(skip)
      .limit(limit);

    return res.status(200).json({
      success: true,
      message: posts.length
        ? "Posts fetched successfully"
        : "No posts found nearby",
      count: posts.length,
      totalPages: Math.ceil(totalPosts / limit),
      currentPage: page,
      result: posts,
    });
  } catch (error) {
    console.error("Error in getPostsByLocation:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error,
    });
  }
};

// get all mentioned users in a post
export const getMentionedUsers = async (req: Request, res: Response) => {
  try {
    const { postId } = req.params;

    const post = await PostModel.findOne({
      _id: postId,
      isDeleted: false,
    })
      .populate(
        "taggedUsers.userId",
        "username fullName profilePicture isPrivate userTier"
      )
      .lean();

    return res.status(200).json({
      success: post?.taggedUsers ? true : false,
      message: post?.taggedUsers
        ? "Mentioned users fetched successfully"
        : "No mentioned users found",
      count: post?.taggedUsers ? post?.taggedUsers?.length : 0,
      result: post?.taggedUsers ? post?.taggedUsers : null,
    });
  } catch (error) {
    console.log("Error in getMentionedUsers", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error,
    });
  }
};

// Get all tapes (video posts only)
export const getAllTapes = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    // 1. Get blocked users, following IDs, and closeFriend entries
    const [blockedUserIds, followingIds, closeFriendsOf] = await Promise.all([
      getBlockedUserIds(userId),
      FollowModel.distinct("followedUserId", { userId, isFollowing: true }),
      UserModel.distinct("_id", { "closeFriends.userId": userId }),
    ]);

    // 2. Construct allowed user list (self + following + public users)
    const publicUserIds = await UserModel.find({
      isPrivate: false,
      _id: { $nin: [...blockedUserIds, userId] },
    }).distinct("_id");

    const allowedUserIds = [
      ...new Set([
        ...followingIds.map((id: any) => id.toString()),
        ...publicUserIds.map((id: any) => id.toString()),
        userId,
      ]),
    ];

    // 3. Construct final query
    const query: any = {
      mediaType: "video",
      isDeleted: false,
      $and: [
        {
          $or: [
            { userId: { $in: allowedUserIds } },
            { collaborators: userId }, // include if user is a collaborator
          ],
        },
        {
          userId: { $nin: blockedUserIds }, // exclude blocked users
        },
        {
          $or: [
            { audience: { $ne: "closeFriends" } },
            { userId: { $in: closeFriendsOf } },
            { collaborators: userId }, // collaborators can always see
          ],
        },
      ],
    };

    // 4. Count and fetch posts
    let [totalPosts, posts] = await Promise.all([
      PostModel.countDocuments(query),
      PostModel.find(query)
        .populate([
          {
            path: "userId",
            select: "username fullName profilePicture isPrivate userTier",
          },
          {
            path: "hashtags.tagId",
            select: "name",
          },
          {
            path: "collaborators",
            select: "username fullName profilePicture isPrivate userTier",
          },
        ])
        .sort({ createdAt: -1, engagementRatio: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    // 5. make posts in random order
    posts = posts.sort(() => Math.random() - 0.5);

    // 6. add isLiked, isSavedPost and isPinnedPost to each post
    const postIds = posts.map((post) => post._id.toString());

    // liked posts
    const likedPostIds = await LikeModel.distinct("postId", {
      userId,
      postId: { $in: postIds },
      isDeleted: false,
    });

    // saved posts
    const savedPostIds = await SavePostModel.distinct("postIds.postId", {
      userId,
      "postIds.postId": { $in: postIds },
      isDeleted: false,
    });

    // pinned posts
    const pinnedPostIds = await SettingsModel.distinct("pinnedPosts", {
      userId,
      pinnedPosts: { $in: postIds },
    });

    // make sets
    const likedSet = new Set(likedPostIds.map((id: any) => id.toString()));
    const savedSet = new Set(savedPostIds.map((id: any) => id.toString()));
    const pinnedSet = new Set(pinnedPostIds.map((id: any) => id.toString()));

    // attach flags
    for (const post of posts) {
      const id = post._id.toString();
      (post as any).isLiked = likedSet.has(id);
      (post as any).isSavedPost = savedSet.has(id);
      (post as any).isPinnedPost = pinnedSet.has(id);
    }

    return res.status(200).json({
      success: true,
      message: posts.length ? "Tapes fetched successfully" : "No tapes found",
      count: posts.length,
      totalPages: Math.ceil(totalPosts / limit),
      currentPage: page,
      result: posts,
    });
  } catch (error) {
    console.error("Error in getAllTapes:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error,
    });
  }
};

// Get all image posts
export const getAllImagePosts = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    // 1. Fetch blocked users, followings, closeFriendsOf
    const [blockedUserIds, followingIds, closeFriendsOf] = await Promise.all([
      getBlockedUserIds(userId),
      FollowModel.distinct("followedUserId", { userId, isFollowing: true }),
      UserModel.distinct("_id", { "closeFriends.userId": userId }),
    ]);

    // 2. Public users (not blocked + not self)
    const publicUserIds = await UserModel.find({
      isPrivate: false,
      _id: { $nin: [...blockedUserIds, userId] },
    }).distinct("_id");

    // 3. Combine followings + public + self
    const allowedUserIds = [
      ...new Set([
        ...followingIds.map((id: any) => id.toString()),
        ...publicUserIds.map((id: any) => id.toString()),
        userId,
      ]),
    ];

    // 4. Query for image posts
    const query: any = {
      mediaType: "image",
      isDeleted: false,
      $and: [
        {
          $or: [
            { userId: { $in: allowedUserIds } },
            { collaborators: userId }, // include if user is a collaborator
          ],
        },
        {
          userId: { $nin: blockedUserIds }, // exclude blocked users
        },
        {
          $or: [
            { audience: { $ne: "closeFriends" } },
            { userId: { $in: closeFriendsOf } },
            { collaborators: userId }, // collaborators can always see
          ],
        },
      ],
    };

    let [totalPosts, posts] = await Promise.all([
      PostModel.countDocuments(query),
      PostModel.find(query)
        .populate([
          {
            path: "userId",
            select: "username fullName profilePicture isPrivate userTier",
          },
          {
            path: "hashtags.tagId",
            select: "name",
          },
          {
            path: "collaborators",
            select: "username fullName profilePicture isPrivate userTier",
          },
        ])
        .sort({ createdAt: -1, engagementRatio: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    // 5. make posts in random order
    posts = posts.sort(() => Math.random() - 0.5);

    // 6. add isLiked, isSavedPost and isPinnedPost to each post
    const postIds = posts.map((post) => post._id.toString());

    // liked posts
    const likedPostIds = await LikeModel.distinct("postId", {
      userId,
      postId: { $in: postIds },
      isDeleted: false,
    });

    // saved posts
    const savedPostIds = await SavePostModel.distinct("postIds.postId", {
      userId,
      "postIds.postId": { $in: postIds },
      isDeleted: false,
    });

    // pinned posts
    const pinnedPostIds = await SettingsModel.distinct("pinnedPosts", {
      userId,
      pinnedPosts: { $in: postIds },
    });

    // make sets
    const likedSet = new Set(likedPostIds.map((id: any) => id.toString()));
    const savedSet = new Set(savedPostIds.map((id: any) => id.toString()));
    const pinnedSet = new Set(pinnedPostIds.map((id: any) => id.toString()));

    // attach flags
    for (const post of posts) {
      const id = post._id.toString();
      (post as any).isLiked = likedSet.has(id);
      (post as any).isSavedPost = savedSet.has(id);
      (post as any).isPinnedPost = pinnedSet.has(id);
    }

    return res.status(200).json({
      success: true,
      message: posts.length
        ? "Image posts fetched successfully"
        : "No image posts found",
      count: posts.length,
      totalPages: Math.ceil(totalPosts / limit),
      currentPage: page,
      result: posts,
    });
  } catch (error) {
    console.error("Error in getAllImagePosts:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error,
    });
  }
};

// search posts by a hashtagId
export const getPostsByHashtagId = async (req: Request, res: Response) => {
  try {
    const { hashtagId } = req.params;
    const userId = (req as any).user.userId;

    // 1. Blocked users, followings, closeFriendsOf
    const [blockedUserIds, followingIds, closeFriendsOf] = await Promise.all([
      getBlockedUserIds(userId),
      FollowModel.distinct("followedUserId", {
        userId,
        isFollowing: true,
      }),
      UserModel.distinct("_id", { "closeFriends.userId": userId }),
    ]);

    // 2. Public users (not blocked + not self)
    const publicUserIds = await UserModel.find({
      isPrivate: false,
      _id: { $nin: [...blockedUserIds, userId] },
    }).distinct("_id");

    // 3. Allowed users: public + followings + self
    const allowedUserIds = [
      ...new Set([
        ...followingIds.map((id: any) => id.toString()),
        ...publicUserIds.map((id: any) => id.toString()),
        userId,
      ]),
    ];

    // 4. Query: posts with hashtag, from allowed users, not deleted
    const query: any = {
      hashtags: { $in: [{ tagId: hashtagId }] },
      isDeleted: false,
      $and: [
        {
          $or: [
            { userId: { $in: allowedUserIds } },
            { collaborators: userId }, // include if user is a collaborator
          ],
        },
        {
          userId: { $nin: blockedUserIds }, // exclude blocked users
        },
        {
          $or: [
            { audience: { $ne: "closeFriends" } },
            { userId: { $in: closeFriendsOf } },
            { collaborators: userId }, // collaborators can always see
          ],
        },
      ],
    };

    let posts = await PostModel.find(query)
      .select("mediaUrl mediaType tapeThumbnailUrl")
      .sort({ createdAt: -1, engagementRatio: -1 })
      .lean();

    if (posts.length >= 20) {
      posts = formatPostsInPattern(posts, 20);
    }

    return res.status(200).json({
      success: true,
      message: posts.length ? "Posts fetched successfully" : "No posts found",
      count: posts.length,
      result: posts,
    });
  } catch (error) {
    console.error("Error searching posts by hashtag:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error,
    });
  }
};

// toggle hide likes count
export const toggleHideLikesCount = async (req: Request, res: Response) => {
  try {
    const { postId } = req.params;
    const userId = (req as any).user.userId;

    const post = await PostModel.findOne({
      _id: postId,
      userId,
      isDeleted: false,
    });

    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found",
      });
    }

    post.hideLikesCount = !post.hideLikesCount;
    await post.save();

    return res.status(200).json({
      success: true,
      message: post.hideLikesCount
        ? "Likes count hidden successfully"
        : "Likes count unhidden successfully",
      result: {
        hideLikesCount: post.hideLikesCount,
      },
    });
  } catch (error) {
    console.log("Error in toggleHideLikesCount", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error,
    });
  }
};

// toggle turn off comments (post / story)
export const toggleTurnOffComments = async (req: Request, res: Response) => {
  try {
    const { postId, storyId } = req.params;
    const userId = (req as any).user.userId;

    const [post, story] = await Promise.all([
      postId
        ? PostModel.findOne({
            _id: postId,
            userId,
            isDeleted: false,
          }).select("turnOffComments")
        : null,
      storyId
        ? StoryModel.findOne({
            _id: storyId,
            userId,
            isDeleted: false,
          }).select("turnOffComments")
        : null,
    ]);

    if (post) {
      post.turnOffComments = !post.turnOffComments;
      await post.save();
    } else if (story) {
      story.turnOffComments = !story.turnOffComments;
      await story.save();
    }

    return res.status(200).json({
      success: post || story ? true : false,
      message:
        post || story
          ? "Comments turned off successfully"
          : "Comments turned on successfully",
      result: {
        turnOffComments:
          post || story
            ? post?.turnOffComments || story?.turnOffComments
            : null,
      },
    });
  } catch (error) {
    console.log("Error in toggleTurnOffComments", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error,
    });
  }
};

// toggle hide shares count
export const toggleHideSharesCount = async (req: Request, res: Response) => {
  try {
    const { postId } = req.params;
    const userId = (req as any).user.userId;

    const post = await PostModel.findOne({
      _id: postId,
      userId,
      isDeleted: false,
    });

    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found",
      });
    }

    post.hideSharesCount = !post.hideSharesCount;
    await post.save();

    return res.status(200).json({
      success: true,
      message: post.hideSharesCount
        ? "Shares count hidden successfully"
        : "Shares count unhidden successfully",
      result: {
        hideSharesCount: post.hideSharesCount,
      },
    });
  } catch (error) {
    console.log("Error in toggleHideSharesCount", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error,
    });
  }
};

// update adjust preview of a post
export const updateAdjustPreview = async (req: Request, res: Response) => {
  try {
    const { postId } = req.params;
    const userId = (req as any).user.userId;

    const post = await PostModel.findOne({
      _id: postId,
      userId,
      isDeleted: false,
    });

    if (post) {
      post.adjustPreview = req.body.adjustPreview || post.adjustPreview;
      await post.save();
    }

    return res.status(200).json({
      success: post ? true : false,
      message: post
        ? "Adjust preview updated successfully"
        : "Failed to update adjust preview",
      result: post ? post : null,
    });
  } catch (error) {
    console.log("Error in updateAdjustPreview", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error,
    });
  }
};

// pin a post on profile page
export const pinPostOnProfilePage = async (req: Request, res: Response) => {
  try {
    const { postId } = req.params;
    const userId = (req as any).user.userId;

    const settings: any = await SettingsModel.findOne({
      userId,
    }).select("pinnedPosts");

    // remove last post if pinned posts count is 3
    if (settings?.pinnedPosts?.length >= 3) {
      settings.pinnedPosts.pop();
    }

    settings.pinnedPosts.push(postId);
    await settings.save();

    return res.status(200).json({
      success: true,
      message: "Post pinned successfully",
      result: {
        pinnedPosts: settings.pinnedPosts,
      },
    });
  } catch (error) {
    console.log("Error in pinPostOnProfilePage", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error,
    });
  }
};

// unpin a post from profile page
export const unpinPostFromProfilePage = async (req: Request, res: Response) => {
  try {
    const { postId } = req.params;
    const userId = (req as any).user.userId;

    const settings = await SettingsModel.findOneAndUpdate(
      { userId },
      { $pull: { pinnedPosts: postId } },
      { new: true }
    ).select("pinnedPosts");

    return res.status(200).json({
      success: true,
      message: "Post unpinned successfully",
      result: {
        pinnedPosts: settings?.pinnedPosts,
      },
    });
  } catch (error) {
    console.log("Error in unpinPostFromProfilePage", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error,
    });
  }
};

// check the post is liked by the user
export const isPostLikedByUser = async (req: Request, res: Response) => {
  try {
    const { postId } = req.params;
    const userId = (req as any).user.userId;

    const isLiked = await LikeModel.exists({
      userId,
      postId,
      isDeleted: false,
    });

    return res.status(200).json({
      success: isLiked ? true : false,
      message: isLiked
        ? "Post liked by the user"
        : "Post not liked by the user",
      result: isLiked ? true : false,
    });
  } catch (error) {
    console.log("Error in isPostLikedByUser", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error,
    });
  }
};

// is this post already saved by the user
export const isPostAlreadySaved = async (req: Request, res: Response) => {
  try {
    const { postId } = req.params;
    const userId = (req as any).user.userId;

    const isSaved = await SavePostModel.exists({
      userId,
      "postIds.postId": postId,
      isDeleted: false,
    });

    return res.status(200).json({
      success: isSaved ? true : false,
      message: isSaved ? "Post already saved" : "Post not saved",
      result: isSaved ? true : false,
    });
  } catch (error) {
    console.log("Error in isPostAlreadySaved", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error,
    });
  }
};

// check if a post is pinned on profile page
export const isPostPinnedOnProfilePage = async (
  req: Request,
  res: Response
) => {
  try {
    const { postId } = req.params;
    const userId = (req as any).user.userId;

    const settings: any = await SettingsModel.findOne({
      userId,
    })
      .select("pinnedPosts")
      .lean();

    const isPinned = settings?.pinnedPosts?.find(
      (post: any) => post.toString() === postId
    )
      ? true
      : false;

    return res.status(200).json({
      success: isPinned ? true : false,
      message: isPinned
        ? "Post is pinned on profile page"
        : "Post is not pinned on profile page",
      result: isPinned,
    });
  } catch (error) {
    console.log("Error in isPostPinnedOnProfilePage", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error,
    });
  }
};
