import { Request, Response } from "express";
import { LikeModel } from "../../like/like.model";
import { CommentModel } from "../../comment/comment.model";
import { PostModel } from "../../post/post.model";
import { StoryModel } from "../../stories/stories.model";
import { SettingsModel } from "../settings.model";
import { getBlockedUserIds } from "../../utils/isBlockedBetween";
import { UserModel } from "../../user/user.model";

// get all liked posts by user
export const getLikedPostsByUser = async (req: Request, res: Response) => {
  try {
    const { userId } = (req as any).user;

    const allBlockedUserIds = new Set(await getBlockedUserIds(userId));

    let likedPosts = await LikeModel.find({
      userId,
      postId: { $ne: null }, // check if postId not null
      isDeleted: false,
    })
      .select("postId -_id")
      .populate("postId", "mediaUrl mediaType userId tapeThumbnailUrl")
      .sort({ createdAt: -1 })
      .lean();

    // filter out posts from blocked users
    likedPosts = likedPosts.filter(
      (post) => !allBlockedUserIds.has((post.postId as any).userId?.toString())
    );

    return res.status(200).json({
      success: likedPosts.length > 0 ? true : false,
      message:
        likedPosts.length > 0
          ? "Liked posts fetched successfully"
          : "No liked posts found",
      count: likedPosts.length > 0 ? likedPosts.length : 0,
      result: likedPosts.length > 0 ? likedPosts : [],
    });
  } catch (error) {
    console.log("Error in getLikedPostsByUser", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error,
    });
  }
};

// get all comments by user on any post (only top level comments)
export const getCommentsByUser = async (req: Request, res: Response) => {
  try {
    const { userId } = (req as any).user;

    const allBlockedUserIds = new Set(await getBlockedUserIds(userId));

    let commentsData = await CommentModel.find({
      userId,
      parentCommentId: null, // only top level comments
      isDeleted: false,
    })
      .populate({
        path: "postId",
        select: "userId caption mediaUrl tapeThumbnailUrl",
        populate: {
          path: "userId",
          select: "username fullName profilePicture userTier",
        },
      })
      .select("content postId createdAt updatedAt")
      .sort({ createdAt: -1 })
      .lean();

    // filter out comments from blocked users
    commentsData = commentsData.filter(
      (comment) =>
        !allBlockedUserIds.has((comment.postId as any).userId?.toString())
    );

    res.status(200).json({
      success: commentsData ? true : false,
      message: "Comments fetched successfully",
      count: commentsData.length,
      result: commentsData ? commentsData : [],
    });
  } catch (error) {
    console.log("Error in getCommentsByUser", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error,
    });
  }
};

// Get all posts where user is tagged
export const getPostsWhereUserIsTagged = async (
  req: Request,
  res: Response
) => {
  try {
    const { userId } = (req as any).user;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const [closeFriendUserIds, blockedUserIds] = await Promise.all([
      UserModel.distinct("_id", { "closeFriends.userId": userId }),
      getBlockedUserIds(userId),
    ]);

    const query = {
      "taggedUsers.userId": userId,
      isDeleted: false,
      userId: { $nin: blockedUserIds },
      $or: [
        { audience: { $ne: "closeFriends" } },
        { userId: { $in: closeFriendUserIds } },
      ],
    };

    const [totalPosts, posts] = await Promise.all([
      PostModel.countDocuments(query),
      PostModel.find(query)
        .select("mediaUrl mediaType createdAt tapeThumbnailUrl")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
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
    console.error("Error in getPostsWhereUserIsTagged:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error?.message || error,
    });
  }
};

// get user stories that are expired or story archive
export const getExpiredStoriesOfUser = async (req: Request, res: Response) => {
  try {
    const { userId } = (req as any).user;

    const expiredStories = await StoryModel.find({
      userId,
      isDeleted: false,
      expiresAt: { $lt: new Date() },
    })
      .select("mediaUrl mediaType sharedPost storyReshared")
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      success: expiredStories ? true : false,
      message: "Expired stories fetched successfully",
      result: expiredStories ? expiredStories : [],
    });
  } catch (error) {
    console.log("Error in getExpiredStoriesOfUser", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error,
    });
  }
};

// get recently deleted stories of user (stories that are deleted in last 30 days)
export const getRecentlyDeletedStoriesOfUser = async (
  req: Request,
  res: Response
) => {
  try {
    const { userId } = (req as any).user;

    const recentlyDeletedStories = await StoryModel.find({
      userId,
      isDeleted: true,
      updatedAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }, // last 30 days
    })
      .select("mediaUrl mediaType updatedAt sharedPost storyReshared")
      .sort({ updatedAt: -1 })
      .lean();

    return res.status(200).json({
      success: recentlyDeletedStories ? true : false,
      message: "Recently deleted stories fetched successfully",
      count: recentlyDeletedStories ? recentlyDeletedStories.length : 0,
      result: recentlyDeletedStories ? recentlyDeletedStories : [],
    });
  } catch (error) {
    console.log("Error in getRecentlyDeletedStoriesOfUser", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error,
    });
  }
};

// add post to interested posts
export const addPostToInterestedPosts = async (req: Request, res: Response) => {
  try {
    const { userId } = (req as any).user;
    const { postId } = req.body;

    const settings = await SettingsModel.findOneAndUpdate(
      { userId },
      { $addToSet: { interestedPosts: postId } },
      { new: true }
    );

    return res.status(200).json({
      success: settings ? true : false,
      message: "Post added to interested posts successfully",
      result: settings ? settings : null,
    });
  } catch (error) {
    console.log("Error in addPostToInterestedPosts", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error,
    });
  }
};

// get all interested posts of user
export const getInterestedPostsOfUser = async (req: Request, res: Response) => {
  try {
    const { userId } = (req as any).user;

    const allBlockedUserIds = new Set(await getBlockedUserIds(userId));

    const settings = await SettingsModel.findOne({ userId })
      .select("interestedPosts")
      .populate("interestedPosts", "mediaUrl mediaType userId tapeThumbnailUrl")
      .lean();

    // filter out posts from blocked users
    const interestedPosts = settings?.interestedPosts?.filter(
      (post) => !allBlockedUserIds.has((post as any).userId?.toString())
    );

    return res.status(200).json({
      success: interestedPosts ? true : false,
      message: "Interested posts fetched successfully",
      count: interestedPosts ? interestedPosts.length : 0,
      result: interestedPosts ? interestedPosts : [],
    });
  } catch (error) {
    console.log("Error in getInterestedPostsOfUser", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error,
    });
  }
};

// remove posts from interested posts
export const removePostsFromInterestedPosts = async (
  req: Request,
  res: Response
) => {
  try {
    const { userId } = (req as any).user;
    const { postIds } = req.body;

    const settings = await SettingsModel.findOneAndUpdate(
      { userId },
      { $pull: { interestedPosts: { $in: postIds } } },
      { new: true }
    );

    return res.status(200).json({
      success: settings ? true : false,
      message: "Post removed from interested posts successfully",
      result: settings ? settings : null,
    });
  } catch (error) {
    console.log("Error in removePostsFromInterestedPosts", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error,
    });
  }
};

// add post to not interested posts
export const addPostToNotInterestedPosts = async (
  req: Request,
  res: Response
) => {
  try {
    const { userId } = (req as any).user;
    const { postId } = req.body;

    const settings = await SettingsModel.findOneAndUpdate(
      { userId },
      { $addToSet: { notInterestedPosts: postId } },
      { new: true }
    );

    return res.status(200).json({
      success: settings ? true : false,
      message: "Post added to not interested posts successfully",
      result: settings ? settings : null,
    });
  } catch (error) {
    console.log("Error in addPostToNotInterestedPosts", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error,
    });
  }
};

// get all not interested posts of user
export const getNotInterestedPostsOfUser = async (
  req: Request,
  res: Response
) => {
  try {
    const { userId } = (req as any).user;

    const allBlockedUserIds = new Set(await getBlockedUserIds(userId));

    const settings = await SettingsModel.findOne({ userId })
      .select("notInterestedPosts")
      .populate("notInterestedPosts", "mediaUrl mediaType tapeThumbnailUrl")
      .lean();

    // filter out posts from blocked users
    const notInterestedPosts = settings?.notInterestedPosts?.filter(
      (post) => !allBlockedUserIds.has((post as any).userId?.toString())
    );

    return res.status(200).json({
      success: notInterestedPosts ? true : false,
      message: "Not interested posts fetched successfully",
      count: notInterestedPosts ? notInterestedPosts.length : 0,
      result: notInterestedPosts ? notInterestedPosts : [],
    });
  } catch (error) {
    console.log("Error in getNotInterestedPostsOfUser", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error,
    });
  }
};

// remove posts from not interested posts
export const removePostsFromNotInterestedPosts = async (
  req: Request,
  res: Response
) => {
  try {
    const { userId } = (req as any).user;
    const { postIds } = req.body;

    const settings = await SettingsModel.findOneAndUpdate(
      { userId },
      { $pull: { notInterestedPosts: { $in: postIds } } },
      { new: true }
    );

    return res.status(200).json({
      success: settings ? true : false,
      message: "Post removed from not interested posts successfully",
      result: settings ? settings : null,
    });
  } catch (error) {
    console.log("Error in removePostsFromNotInterestedPosts", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error,
    });
  }
};

// unlike multiple posts
export const unlikeMultiplePosts = async (req: Request, res: Response) => {
  try {
    const { postIds } = req.body;
    const userId = (req as any).user.userId;

    await Promise.all([
      // unlike posts
      LikeModel.updateMany(
        { userId, postId: { $in: postIds }, isDeleted: false },
        { isDeleted: true }
      ),
      // update post likes count
      PostModel.updateMany(
        { _id: { $in: postIds } },
        { $inc: { likesCount: -1 } }
      ),
    ]);

    return res.status(200).json({
      success: true,
      message: "Posts unliked successfully",
    });
  } catch (error) {
    console.log("error in unlike multiple posts", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error,
    });
  }
};
