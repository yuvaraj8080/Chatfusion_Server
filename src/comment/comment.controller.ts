import { Request, Response } from "express";
import { CommentModel } from "./comment.model";
import { PostModel } from "../post/post.model";
import { NotificationModel } from "../notification/notification.model";
import { UserModel } from "../user/user.model";
import { LikeModel } from "../like/like.model";
import { FollowModel } from "../follow/follow.model";
import { SettingsModel } from "../setting/settings.model";
import { NotificationSettingsModel } from "../setting/alerts&update/notificationSettings.model";
import { StoryModel } from "../stories/stories.model";
import { getBlockedUserIds, isBlockedBetween } from "../utils/isBlockedBetween";
import {
  getServerKeyToken,
  sendPushNotification,
} from "../notification/notification.controller";

// create comment by post id or story id
export const createComment = async (req: Request, res: Response) => {
  try {
    const { postId, storyId } = req.params;
    const { content, mentionUserIds = [] } = req.body;
    const { userId } = (req as any).user;

    // 1. check if the post or story exists and is not deleted
    const [post, story] = await Promise.all([
      postId ? PostModel.findOne({ _id: postId, isDeleted: false }) : null,
      storyId
        ? StoryModel.findOne({
            _id: storyId,
            isDeleted: false,
            expiresAt: { $gt: new Date() },
          })
        : null,
    ]);

    if (!post && !story) {
      return res.status(404).json({
        success: false,
        message: "Post or story not found or has been deleted",
      });
    }

    // check if the user is blocked by the post or story author
    const targetUserId = post?.userId?.toString() || story?.userId?.toString();
    if (!targetUserId) {
      return res.status(404).json({
        success: false,
        message: "Post or story author not found",
      });
    }

    const isBlocked = await isBlockedBetween(userId, targetUserId);
    if (isBlocked) {
      return res.status(403).json({
        success: false,
        message: `You are blocked by the ${post ? "post" : "story"} author`,
      });
    }

    // 2. create the comment with mention users
    const comment = await CommentModel.create({
      userId,
      postId: post?._id || null,
      storyId: story?._id || null,
      content,
    });

    // 3. update post comments count
    if (post) {
      post.commentsCount++;
      await post.save();
    }

    // 4. create valid mentioned users object array
    let validMentionedUsers = [];

    for (const mentionedUserId of mentionUserIds) {
      // get settings of the user
      const settings = await SettingsModel.findOne({
        userId: mentionedUserId,
      });

      // if the user can mentioned by everyone
      if (settings?.whoCanMention === "everyone") {
        validMentionedUsers.push({ userId: mentionedUserId });
      }
      // if the user can mentioned by followees only
      else if (settings?.whoCanMention === "followees") {
        // check if this mentioneduser is follower of post creator
        const isFollower = await FollowModel.findOne({
          userId: mentionedUserId,
          followedUserId: userId,
          isFollowing: true,
        });

        if (isFollower) {
          validMentionedUsers.push({ userId: mentionedUserId });
        }
      }
    }

    // 5. add the valid mentioned users to the comment
    comment.mentionUserIds = validMentionedUsers;
    await comment.save();

    // 6. create notification for the post or story owner
    if (
      comment &&
      (post?.userId?.toString() !== userId ||
        story?.userId?.toString() !== userId)
    ) {
      const [user, notificationSettings, targetUser] = await Promise.all([
        UserModel.findById(userId, "username").lean(),
        NotificationSettingsModel.findOne({
          userId: post?.userId || story?.userId,
        })
          .select(
            "muteAllNotifications postNotifications.comments storyNotifications.comments"
          )
          .lean(),
        UserModel.findById(post?.userId || story?.userId, "fcmToken").lean(),
      ]);

      // send in app notification
      if (
        notificationSettings?.postNotifications?.comments !== "no_one" ||
        notificationSettings?.storyNotifications?.comments !== "no_one"
      ) {
        const notificationDetails = {
          title: "New Comment",
          message: `${user?.username} commented on your ${
            post ? "post" : "story"
          }`,
          senderId: userId,
          receiverId: post?.userId?.toString() || story?.userId?.toString(),
          type: "COMMENT",
          targetId: post?._id.toString() || story?._id.toString(),
          mediaType: post?.mediaType || story?.mediaType,
          mediaUrl: post?.mediaUrl[0] || story?.mediaUrl,
        };

        const pushNotificationDetails = {
          notification: {
            title: "Genuinest",
            body: `${user?.username} commented on your ${
              post ? "post" : "story"
            }`,
          },
          fcmToken: targetUser?.fcmToken,
          data: {
            type: "COMMENT",
            id: post?._id.toString() || story?._id.toString(),
          },
          serverKey: await getServerKeyToken(),
        };

        const shouldSendToEveryone =
          notificationSettings?.postNotifications?.comments === "everyone" ||
          notificationSettings?.storyNotifications?.comments === "everyone";

        const shouldSendToFollowees =
          notificationSettings?.postNotifications?.comments === "followees" ||
          notificationSettings?.storyNotifications?.comments === "followees";

        if (shouldSendToEveryone) {
          NotificationModel.create({ ...notificationDetails }).catch(
            console.error
          );

          if (
            targetUser?.fcmToken &&
            !notificationSettings?.muteAllNotifications
          ) {
            sendPushNotification(pushNotificationDetails).catch(console.error);
          }
        } else if (shouldSendToFollowees) {
          // check if the post author is follower of the comment author
          const isFollower = await FollowModel.exists({
            userId: post?.userId || story?.userId,
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

    // 7. send notification to the tagged users of that post if its a image post
    if (post && post.taggedUsers.length > 0 && post?.mediaType === "image") {
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
            title: "New Comment",
            message: `${creator?.username} commented on the post you are tagged in`,
            senderId: userId,
            receiverId: setting.userId,
            type: "COMMENT",
            targetId: post._id.toString(),
            mediaType: post?.mediaType,
            mediaUrl: post?.mediaUrl[0],
          };

          const pushNotificationDetails = {
            notification: {
              title: "Genuinest",
              body: `${creator?.username} commented on the post you are tagged in`,
            },
            fcmToken: taggedUsersFcmTokenMap[setting.userId.toString()],
            data: { type: "COMMENT", id: post?._id.toString() },
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
      success: comment ? true : false,
      message: comment
        ? "Comment created successfully"
        : "Failed to create comment",
      result: comment ? comment : null,
    });
  } catch (error) {
    console.log("Error in createComment", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error,
    });
  }
};

// reply to comment by comment id
export const replyToComment = async (req: Request, res: Response) => {
  try {
    const { commentId } = req.params;
    const { content, mentionUserIds = [], postId } = req.body;
    const userId = (req as any).user.userId;

    // get the comment owner
    const comment = await CommentModel.findOne({
      _id: commentId,
      isDeleted: false,
    })
      .select("userId")
      .lean();

    if (!comment) {
      return res.status(404).json({
        success: false,
        message: "Comment not found or has been deleted",
      });
    }

    // check if the user is blocked by the post owner
    const isBlocked = await isBlockedBetween(userId, comment.userId.toString());
    if (isBlocked) {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to reply to this comment",
      });
    }

    // create mention users array
    const mentionUsers = mentionUserIds?.map((id: string) => ({
      userId: id,
    }));

    const reply = await CommentModel.create({
      userId,
      postId,
      content,
      parentCommentId: commentId,
      mentionUserIds: mentionUsers || [],
    });

    await Promise.all([
      // update post comments count
      PostModel.findByIdAndUpdate(postId, {
        $inc: { commentsCount: 1 },
      }),

      // update comment replies count
      CommentModel.findByIdAndUpdate(commentId, {
        $inc: { repliesCount: 1 },
      }),
    ]);

    return res.status(201).json({
      success: reply ? true : false,
      message: reply ? "Reply created successfully" : "Failed to create reply",
      result: reply ? reply : null,
    });
  } catch (error) {
    console.log("Error in replyToComment", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error,
    });
  }
};

// get all comments by post id (only top level comments)
export const getAllCommentsByPostId = async (req: Request, res: Response) => {
  try {
    const { postId } = req.params;
    const userId = (req as any).user.userId;

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    // get the post owner
    const post = await PostModel.findOne({
      _id: postId,
      isDeleted: false,
    })
      .select("userId")
      .lean();

    if (!post) {
      return res
        .status(404)
        .json({ success: false, message: "Post not found" });
    }

    // check if current user or post owner blocked each other
    const isBlocked = await isBlockedBetween(userId, post.userId.toString());
    if (isBlocked) {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to view comments on this post",
      });
    }

    const allBlockedUserIds = await getBlockedUserIds(userId);

    const query = {
      postId,
      parentCommentId: null,
      isDeleted: false,
      userId: { $nin: allBlockedUserIds },
    };

    // get all comments by post id where parent comment id is null
    const [totalComments, comments] = await Promise.all([
      CommentModel.countDocuments(query),
      CommentModel.find(query)
        .populate("userId", "username profilePicture")
        .sort({ likesCount: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    // add isLiked field to the comments
    const commentIds = comments.map((c) => c._id);

    // get all commentIds liked by this user in one query
    const likedCommentIds = await LikeModel.distinct("commentId", {
      userId,
      commentId: { $in: commentIds },
      isDeleted: false,
    });

    // make a Set for O(1) lookup
    const likedSet = new Set(likedCommentIds.map((id: any) => id.toString()));

    // mark isLiked
    for (const comment of comments) {
      (comment as any).isLiked = likedSet.has(comment._id.toString());
    }

    return res.status(200).json({
      success: comments ? true : false,
      message: comments ? "Comments fetched successfully" : "No comments found",
      count: comments ? comments.length : 0,
      totalPages: Math.ceil(totalComments / limit),
      currentPage: page,
      result: comments ? comments : null,
    });
  } catch (error) {
    console.log("Error in getAllCommentsByPostId", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error,
    });
  }
};

// get replies by comment id (second level comments)
export const getRepliesByCommentId = async (req: Request, res: Response) => {
  try {
    const { commentId } = req.params;
    const userId = (req as any).user.userId;

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const allBlockedUserIds = await getBlockedUserIds(userId);

    const query = {
      parentCommentId: commentId,
      isDeleted: false,
      userId: { $nin: allBlockedUserIds },
    };

    const [totalReplies, replies] = await Promise.all([
      CommentModel.countDocuments(query),
      CommentModel.find(query)
        .populate("userId", "username profilePicture")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    // add isLiked field to the replies
    const commentIds = replies.map((c) => c._id);

    // get all commentIds liked by this user in one query
    const likedCommentIds = await LikeModel.distinct("commentId", {
      userId,
      commentId: { $in: commentIds },
      isDeleted: false,
    });

    // make a Set for O(1) lookup
    const likedSet = new Set(likedCommentIds.map((id: any) => id.toString()));

    // mark isLiked
    for (const reply of replies) {
      (reply as any).isLiked = likedSet.has(reply._id.toString());
    }

    return res.status(200).json({
      success: replies ? true : false,
      message: replies
        ? "Replies fetched successfully"
        : "Failed to fetch replies",
      count: replies ? replies.length : 0,
      totalPages: Math.ceil(totalReplies / limit),
      currentPage: page,
      result: replies ? replies : null,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error,
    });
  }
};

// delete comment by comment id
export const deleteComment = async (req: Request, res: Response) => {
  try {
    const { commentId } = req.params;
    const userId = (req as any).user.userId;

    // find the comment
    const comment = await CommentModel.findOne({
      _id: commentId,
      userId,
      isDeleted: false,
    });

    if (!comment) {
      return res.status(404).json({
        success: false,
        message:
          "Comment not found or you are not authorized to delete this comment",
      });
    }

    // check if the comment is a parent comment or a reply
    if (comment.parentCommentId === null) {
      // if the comment is a parent comment and it is a post comment
      // Mark all replies to this comment as deleted
      if (comment.postId) {
        const { modifiedCount } = await CommentModel.updateMany(
          { parentCommentId: commentId, isDeleted: false },
          { isDeleted: true }
        );

        // update post comments count after deleting the comment
        await PostModel.findByIdAndUpdate(comment.postId, {
          $inc: { commentsCount: -modifiedCount },
        });
      }
    } else {
      // if the comment is a reply
      await Promise.all([
        // update post comments count after deleting the reply
        PostModel.findByIdAndUpdate(comment.postId, {
          $inc: { commentsCount: -1 },
        }),

        // update the parent comment replies count
        CommentModel.findByIdAndUpdate(comment.parentCommentId, {
          $inc: { repliesCount: -1 },
        }),
      ]);
    }

    // Mark comment as deleted
    comment.isDeleted = true;
    await comment.save();

    return res.status(200).json({
      success: true,
      message: "Comment deleted successfully",
      result: comment,
    });
  } catch (error) {
    console.log("Error in deleteComment", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error,
    });
  }
};

// update comment by comment id
export const updateComment = async (req: Request, res: Response) => {
  try {
    const { commentId } = req.params;
    const userId = (req as any).user.userId;

    // find the comment
    const comment = await CommentModel.findOne({
      _id: commentId,
      userId,
      isDeleted: false,
    });

    if (!comment) {
      return res.status(404).json({
        success: false,
        message:
          "Comment not found or you are not authorized to update this comment",
      });
    }

    // create mention users array
    if (req.body.mentionUserIds) {
      const mentionUsers = req.body.mentionUserIds.map((id: string) => ({
        userId: id,
      }));

      comment.mentionUserIds = mentionUsers;
    }

    // update comment content and mention users if provided
    comment.content = req.body.content || comment.content;

    await comment.save();

    return res.status(200).json({
      success: comment ? true : false,
      message: comment
        ? "Comment updated successfully"
        : "Failed to update comment",
      result: comment ? comment : null,
    });
  } catch (error) {
    console.log("Error in updateComment", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error,
    });
  }
};

// get all comments by story id
export const getAllCommentsByStoryId = async (req: Request, res: Response) => {
  try {
    const { storyId } = req.params;
    const userId = (req as any).user.userId;
    const allBlockedUserIds = await getBlockedUserIds(userId);

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const query = {
      storyId,
      isDeleted: false,
      userId: { $nin: allBlockedUserIds },
    };

    // get all comments by story id
    const [totalComments, comments] = await Promise.all([
      CommentModel.countDocuments(query),
      CommentModel.find(query)
        .populate("userId", "username profilePicture")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    // add isLiked field to the comments
    const commentIds = comments.map((c) => c._id);

    // get all commentIds liked by this user in one query
    const likedCommentIds = await LikeModel.distinct("commentId", {
      userId,
      commentId: { $in: commentIds },
      isDeleted: false,
    });

    // make a Set for O(1) lookup
    const likedSet = new Set(likedCommentIds.map((id: any) => id.toString()));

    // mark isLiked
    for (const comment of comments) {
      (comment as any).isLiked = likedSet.has(comment._id.toString());
    }

    return res.status(200).json({
      success: comments ? true : false,
      message: comments ? "Comments fetched successfully" : "No comments found",
      count: comments ? comments.length : 0,
      totalPages: Math.ceil(totalComments / limit),
      currentPage: page,
      result: comments ? comments : null,
    });
  } catch (error) {
    console.log("Error in getAllCommentsByStoryId", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error,
    });
  }
};

// check if comment liked by current user
export const isCommentLikedByUser = async (req: Request, res: Response) => {
  try {
    const { commentId } = req.params;
    const userId = (req as any).user.userId;

    const isLiked = await LikeModel.exists({
      userId,
      commentId,
      isDeleted: false,
    });

    return res.status(200).json({
      success: isLiked ? true : false,
      message: isLiked ? "Comment liked" : "Comment not liked",
      result: isLiked ? true : false,
    });
  } catch (error) {
    console.log("Error in isCommentLikedByCurrentUser", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error,
    });
  }
};
