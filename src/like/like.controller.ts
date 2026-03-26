import { CommentModel } from "../comment/comment.model";
import { PostModel } from "../post/post.model";
import { LikeModel } from "./like.model";
import { Request, Response } from "express";
import { NotificationModel } from "../notification/notification.model";
import { UserModel } from "../user/user.model";
import { StoryModel } from "../stories/stories.model";
import { NotificationSettingsModel } from "../setting/alerts&update/notificationSettings.model";
import { FollowModel } from "../follow/follow.model";
import { isBlockedBetween } from "../utils/isBlockedBetween";
import {
  getServerKeyToken,
  sendPushNotification,
} from "../notification/notification.controller";

// like post by post id
export const likePost = async (req: Request, res: Response) => {
  try {
    const { postId } = req.params;
    const userId = (req as any).user.userId;

    // get post details
    const post = await PostModel.findOne({
      _id: postId,
      isDeleted: false,
    }).select("userId mediaType mediaUrl likesCount taggedUsers");

    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found or has been deleted",
      });
    }

    // check if the user is blocked by the post author
    const isBlocked = await isBlockedBetween(userId, post?.userId?.toString());
    if (isBlocked) {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to like this post",
      });
    }

    // check if the post is already liked by the user
    const existingLike = await LikeModel.findOne({
      userId,
      postId,
      isDeleted: false,
    });

    if (existingLike) {
      return res.status(400).json({
        success: false,
        message: "Post already liked by user",
      });
    }

    const like = await LikeModel.create({
      userId,
      postId,
    });

    // update post likes count
    post.likesCount++;
    await post.save();

    // create notification for post author
    if (like && post?.userId?.toString() !== userId) {
      const [user, notificationSettings, targetUser] = await Promise.all([
        UserModel.findById(userId, "username").lean(),
        NotificationSettingsModel.findOne({
          userId: post?.userId?.toString(),
        })
          .select("muteAllNotifications postNotifications.likes")
          .lean(),
        UserModel.findById(post?.userId?.toString(), "fcmToken").lean(),
      ]);

      if (notificationSettings?.postNotifications?.likes !== "no_one") {
        const notificationDetails = {
          title: "New Like",
          message: `${user?.username} liked your post`,
          senderId: userId,
          receiverId: post?.userId?.toString(),
          type: "LIKE",
          targetId: postId,
          mediaType: post?.mediaType,
          mediaUrl: post?.mediaUrl[0],
        };

        const pushNotificationDetails = {
          notification: {
            title: "Genuinest",
            body: `${user?.username} liked your post`,
          },
          fcmToken: targetUser?.fcmToken,
          data: { type: "LIKE", id: post?._id.toString() },
          serverKey: await getServerKeyToken(),
        };

        if (notificationSettings?.postNotifications?.likes === "everyone") {
          NotificationModel.create({ ...notificationDetails }).catch(
            console.error
          );
          if (
            targetUser?.fcmToken &&
            !notificationSettings?.muteAllNotifications
          ) {
            sendPushNotification(pushNotificationDetails).catch(console.error);
          }
        } else if (
          notificationSettings?.postNotifications?.likes === "followees"
        ) {
          // check if the post author is follower of the like author
          const isFollower = await FollowModel.exists({
            userId: post?.userId,
            followedUserId: userId,
            isFollowing: true,
          });

          if (isFollower) {
            NotificationModel.create({ ...notificationDetails }).catch(
              console.error
            );
            if (
              targetUser?.fcmToken &&
              !notificationSettings?.muteAllNotifications
            ) {
              sendPushNotification(pushNotificationDetails).catch(
                console.error
              );
            }
          }
        }
      }
    }

    // send notification to the tagged users if its a image post and post author is not the like author
    if (
      post &&
      post.taggedUsers.length > 0 &&
      post?.mediaType === "image" &&
      post?.userId?.toString() !== userId
    ) {
      const [creator, taggedUsersSettings, taggedUsers] = await Promise.all([
        UserModel.findById(userId, "username").lean(),
        NotificationSettingsModel.find({
          userId: { $in: post.taggedUsers.map((u) => u.userId) },
        })
          .select(
            "userId muteAllNotifications postNotifications.likesAndCommentsOnPhotosOfYou"
          )
          .lean(),
        UserModel.find({
          _id: { $in: post.taggedUsers.map((u) => u.userId) },
        })
          .select("fcmToken")
          .lean(),
      ]);

      const taggedUsersFcmTokenMap: { [key: string]: string } =
        taggedUsers.reduce((acc, user) => {
          acc[user._id.toString()] = user.fcmToken;
          return acc;
        }, {} as { [key: string]: string });

      for (const setting of taggedUsersSettings) {
        if (
          setting?.postNotifications?.likesAndCommentsOnPhotosOfYou !== "no_one"
        ) {
          const notificationDetails = {
            title: "New Like",
            message: `${creator?.username} liked the post you are tagged in`,
            senderId: userId,
            receiverId: setting.userId,
            type: "LIKE",
            targetId: post._id.toString(),
            mediaType: post?.mediaType,
            mediaUrl: post?.mediaUrl[0],
          };

          const pushNotificationDetails = {
            notification: {
              title: "Genuinest",
              body: `${creator?.username} liked the post you are tagged in`,
            },
            fcmToken: taggedUsersFcmTokenMap[setting.userId.toString()],
            data: { type: "LIKE", id: post?._id.toString() },
            serverKey: await getServerKeyToken(),
          };

          if (
            setting?.postNotifications?.likesAndCommentsOnPhotosOfYou ===
            "everyone"
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
            setting?.postNotifications?.likesAndCommentsOnPhotosOfYou ===
            "followees"
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
      success: like ? true : false,
      message: like ? "Post liked successfully" : "Failed to like post",
      result: like ? like : null,
    });
  } catch (error) {
    console.log("error in like post", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error,
    });
  }
};

// unlike post by post id
export const unlikePost = async (req: Request, res: Response) => {
  try {
    const { postId } = req.params;
    const userId = (req as any).user.userId;

    // check if the post is not liked by the user
    const like = await LikeModel.findOne({ userId, postId, isDeleted: false });

    if (!like) {
      return res.status(404).json({
        success: false,
        message: "Post not liked by user",
      });
    }

    like.isDeleted = true;
    await like.save();

    // update post likes count
    await PostModel.findByIdAndUpdate(postId, {
      $inc: { likesCount: -1 },
    });

    return res.status(200).json({
      success: like ? true : false,
      message: like ? "Post unliked successfully" : "Failed to unlike post",
      result: like ? like : null,
    });
  } catch (error) {
    console.log("error in unlike post", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error,
    });
  }
};

//like comment by comment id
export const likeComment = async (req: Request, res: Response) => {
  try {
    const { commentId } = req.params;
    const userId = (req as any).user.userId;

    const comment = await CommentModel.findOne({
      _id: commentId,
      isDeleted: false,
    }).select("userId likesCount postId storyId");

    if (!comment) {
      return res.status(404).json({
        success: false,
        message: "Comment not found or has been deleted",
      });
    }

    // check if the user is blocked by the post author
    const isBlocked = await isBlockedBetween(
      userId,
      comment?.userId?.toString()
    );
    if (isBlocked) {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to like this comment",
      });
    }

    const existingLike = await LikeModel.findOne({
      userId,
      commentId,
      isDeleted: false,
    });

    if (existingLike) {
      return res.status(400).json({
        success: false,
        message: "Comment already liked by user",
      });
    }

    const like = await LikeModel.create({
      userId,
      commentId,
    });

    // update comment likes count
    comment.likesCount++;
    await comment.save();

    // create notification for the comment owner
    if (like && comment.userId.toString() !== userId) {
      const [user, targetUser, notificationSettings] = await Promise.all([
        UserModel.findById(userId, "username").lean(),
        UserModel.findById(comment?.userId?.toString(), "fcmToken").lean(),
        NotificationSettingsModel.findOne({
          userId: comment?.userId?.toString(),
        })
          .select("muteAllNotifications")
          .lean(),
      ]);

      const notificationDetails = {
        title: "New Like",
        message: `${user?.username} liked your comment on a ${
          comment?.postId ? "post" : "story"
        }`,
        senderId: userId,
        receiverId: comment.userId.toString(),
        type: "LIKE",
        targetId: comment?.postId?.toString() || comment?.storyId?.toString(),
      };

      const pushNotificationDetails = {
        notification: {
          title: "Genuinest",
          body: `${user?.username} liked your comment on a ${
            comment?.postId ? "post" : "story"
          }`,
        },
        fcmToken: targetUser?.fcmToken,
        data: {
          type: "LIKE",
          id: comment?.postId?.toString() || comment?.storyId?.toString(),
        },
        serverKey: await getServerKeyToken(),
      };

      NotificationModel.create({ ...notificationDetails }).catch(console.error);
      if (targetUser?.fcmToken && !notificationSettings?.muteAllNotifications) {
        sendPushNotification(pushNotificationDetails).catch(console.error);
      }
    }

    return res.status(201).json({
      success: like ? true : false,
      message: like ? "Comment liked successfully" : "Failed to like comment",
      result: like ? like : null,
    });
  } catch (error) {
    console.log("error in like comment", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error,
    });
  }
};

//unlike comment by comment id
export const unlikeComment = async (req: Request, res: Response) => {
  try {
    const { commentId } = req.params;
    const userId = (req as any).user.userId;

    // check if the comment is not liked by the user
    const like = await LikeModel.findOne({
      userId,
      commentId,
      isDeleted: false,
    });

    if (!like) {
      return res.status(404).json({
        success: false,
        message: "Comment not liked by user",
      });
    }

    like.isDeleted = true;
    await like.save();

    // update comment likes count
    await CommentModel.findByIdAndUpdate(commentId, {
      $inc: { likesCount: -1 },
    });

    return res.status(200).json({
      success: like ? true : false,
      message: like
        ? "Comment unliked successfully"
        : "Failed to unlike comment",
      result: like ? like : null,
    });
  } catch (error) {
    console.log("error in unlike comment", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error,
    });
  }
};

// like story by story id
export const likeStory = async (req: Request, res: Response) => {
  try {
    const { storyId } = req.params;
    const userId = (req as any).user.userId;

    const story = await StoryModel.findOne({
      _id: storyId,
      isDeleted: false,
    }).select("userId mediaType mediaUrl");

    if (!story) {
      return res.status(404).json({
        success: false,
        message: "Story not found or has been deleted",
      });
    }

    // check if the user is blocked by the story author
    const isBlocked = await isBlockedBetween(userId, story?.userId?.toString());
    if (isBlocked) {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to like this story",
      });
    }

    const existingLike = await LikeModel.exists({
      userId,
      storyId,
      isDeleted: false,
    });

    if (existingLike) {
      return res.status(400).json({
        success: false,
        message: "Story already liked by user",
      });
    }

    const like = await LikeModel.create({
      userId,
      storyId,
    });

    // create notification for story author
    if (like && story?.userId?.toString() !== userId) {
      const [user, notificationSettings, targetUser] = await Promise.all([
        UserModel.findById(userId, "username").lean(),
        NotificationSettingsModel.findOne({
          userId: story?.userId?.toString(),
        })
          .select("muteAllNotifications storyNotifications.likes")
          .lean(),
        UserModel.findById(story?.userId?.toString(), "fcmToken").lean(),
      ]);

      // check if the story author is not the like author then create notification
      if (notificationSettings?.storyNotifications?.likes !== "no_one") {
        const notificationDetails = {
          title: "New Like",
          message: `${user?.username} liked your story`,
          senderId: userId,
          receiverId: story?.userId?.toString(),
          type: "LIKE",
          targetId: storyId,
          mediaType: story?.mediaType,
          mediaUrl: story?.mediaUrl,
        };

        const pushNotificationDetails = {
          notification: {
            title: "Genuinest",
            body: `${user?.username} liked your story`,
          },
          fcmToken: targetUser?.fcmToken,
          data: { type: "LIKE", id: storyId },
          serverKey: await getServerKeyToken(),
        };

        if (notificationSettings?.storyNotifications?.likes === "everyone") {
          NotificationModel.create({ ...notificationDetails }).catch(
            console.error
          );
          if (
            targetUser?.fcmToken &&
            !notificationSettings?.muteAllNotifications
          ) {
            sendPushNotification(pushNotificationDetails).catch(console.error);
          }
        } else if (
          notificationSettings?.storyNotifications?.likes === "followees"
        ) {
          // check if the story author is follower of the like author
          const isFollower = await FollowModel.exists({
            userId: story?.userId,
            followedUserId: userId,
            isFollowing: true,
          });

          if (isFollower) {
            NotificationModel.create({ ...notificationDetails }).catch(
              console.error
            );
            if (
              targetUser?.fcmToken &&
              !notificationSettings?.muteAllNotifications
            ) {
              sendPushNotification(pushNotificationDetails).catch(
                console.error
              );
            }
          }
        }
      }
    }

    return res.status(201).json({
      success: like ? true : false,
      message: like ? "Story liked successfully" : "Failed to like story",
      result: like ? like : null,
    });
  } catch (error) {
    console.log("error in like story", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error,
    });
  }
};

// unlike story by story id
export const unlikeStory = async (req: Request, res: Response) => {
  try {
    const { storyId } = req.params;
    const userId = (req as any).user.userId;

    const like = await LikeModel.findOne({
      userId,
      storyId,
      isDeleted: false,
    });

    if (!like) {
      return res.status(404).json({
        success: false,
        message: "Story not liked by user",
      });
    }

    like.isDeleted = true;
    await like.save();

    return res.status(200).json({
      success: like ? true : false,
      message: like ? "Story unliked successfully" : "Failed to unlike story",
      result: like ? like : null,
    });
  } catch (error) {
    console.log("error in unlike story", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error,
    });
  }
};
