import { UserModel } from "../user/user.model";
import { Request, Response } from "express";
import { SearchHistoryModel } from "./searchHistory.model";
import { PostModel } from "../post/post.model";
import { TagModel } from "../post/tag.model";
import { getBlockedUserIds } from "../utils/isBlockedBetween";
import { FollowModel } from "../follow/follow.model";
import { formatPostsInPattern } from "../utils/formatPostsInPattern";
import { LikeModel } from "../like/like.model";
import { SavePostModel } from "../savePost/savepost.model";
import { SettingsModel } from "../setting/settings.model";

// search users by username or fullName
export const searchUsers = async (req: Request, res: Response) => {
  try {
    const { text } = req.params;
    const userId = (req as any).user.userId;

    if (!text || text.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Search query is required",
      });
    }

    const allBlockedUserIds = await getBlockedUserIds(userId);

    // search users by username or fullName
    const users = await UserModel.find({
      $or: [
        { username: { $regex: text, $options: "i" } }, // i for case insensitive
        { fullName: { $regex: text, $options: "i" } },
      ],
      isDeleted: false,
      _id: { $nin: allBlockedUserIds },
    })
      .limit(7)
      .select("fullName username profilePicture userTier")
      .lean();

    return res.status(200).json({
      success: users ? true : false,
      message: users ? "Users fetched successfully" : "No users found",
      count: users ? users.length : 0,
      result: users ? users : null,
    });
  } catch (error) {
    console.error("Error searching users:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error,
    });
  }
};

// save search history
export const saveSearch = async (req: Request, res: Response) => {
  try {
    const { userId } = (req as any).user;
    const { searchedText, searchedUserId } = req.body;

    if (!searchedText || !searchedUserId) {
      return res.status(400).json({
        success: false,
        message: "Missing fields",
      });
    }

    const newSearchItem = {
      searchedText,
      searchedUserId,
    };

    let history = await SearchHistoryModel.findOne({
      userId,
      isDeleted: false,
    });

    // if no history, create a new one
    if (!history) {
      history = await SearchHistoryModel.create({
        userId,
        queries: [newSearchItem],
      });
    } else {
      // Remove any existing entry for same searchedUserId
      history.queries = history.queries.filter(
        (q: any) => !q.searchedUserId.equals(searchedUserId)
      );

      // Insert at beginning and keep only latest 10
      history.queries.unshift(newSearchItem as any);
      history.queries = history.queries.slice(0, 10);

      await history.save();
    }

    return res.status(200).json({
      success: history ? true : false,
      message: history ? "Search saved successfully" : "Failed to save search",
      data: history ? history : null,
    });
  } catch (error) {
    console.error("Error saving search:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error,
    });
  }
};

// get search history
export const getSearchHistory = async (req: Request, res: Response) => {
  try {
    const { userId } = (req as any).user;

    // get search history sorted by searchedAt descending
    const history = await SearchHistoryModel.findOne({
      userId,
      isDeleted: false,
    })
      .populate("queries.searchedUserId", "fullName username profilePicture")
      .sort({ "queries.searchedAt": -1 })
      .lean();

    return res.status(200).json({
      success: history ? true : false,
      message: history
        ? history.queries.length > 0
          ? "Search history fetched successfully"
          : "No search history found"
        : "No search history found",
      count: history ? history.queries.length : 0,
      data: history ? history.queries : null,
    });
  } catch (error) {
    console.error("Error getting search history:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error,
    });
  }
};

// delete a single search item
export const deleteSearchItem = async (req: Request, res: Response) => {
  try {
    const { userId } = (req as any).user;
    const { searchedUserId } = req.params;

    const updatedHistory = await SearchHistoryModel.findOneAndUpdate(
      { userId, isDeleted: false },
      {
        $pull: {
          queries: {
            searchedUserId: searchedUserId,
          },
        },
      },
      { new: true }
    );

    return res.status(200).json({
      success: updatedHistory ? true : false,
      message: updatedHistory
        ? "Search item deleted"
        : "Failed to delete search item",
      data: updatedHistory ? updatedHistory : null,
    });
  } catch (error) {
    console.error("Error deleting search item:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error,
    });
  }
};

// clear all search history
export const clearSearchHistory = async (req: Request, res: Response) => {
  try {
    const { userId } = (req as any).user;

    const clearedHistory = await SearchHistoryModel.findOneAndUpdate(
      { userId, isDeleted: false },
      { isDeleted: true },
      { new: true }
    );

    return res.status(200).json({
      success: clearedHistory ? true : false,
      message: clearedHistory
        ? "Search history cleared"
        : "Failed to clear search history",
      data: clearedHistory ? clearedHistory : null,
    });
  } catch (error) {
    console.error("Error clearing search history:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error,
    });
  }
};

// search posts by post caption (for You section)
export const searchPostsByCaption = async (req: Request, res: Response) => {
  try {
    const { text } = req.params;
    const userId = (req as any).user.userId;

    // Step 1: Fetch data for filtering
    const [blockedUserIds, followingIds, closeFriendsOf] = await Promise.all([
      getBlockedUserIds(userId),
      FollowModel.distinct("followedUserId", {
        userId,
        isFollowing: true,
      }),
      UserModel.distinct("_id", { "closeFriends.userId": userId }),
    ]);

    // Step 2: Fetch public user IDs (excluding blocked + self)
    const publicUserIds = await UserModel.find({
      isPrivate: false,
      _id: { $nin: [...blockedUserIds, userId] },
    }).distinct("_id");

    // Step 3: Allowed user IDs = self + followings + public
    const allowedUserIds = [
      ...new Set([
        ...followingIds.map((id: any) => id.toString()),
        ...publicUserIds.map((id: any) => id.toString()),
        userId,
      ]),
    ];

    // Step 4: Build query
    const postQuery: any = {
      caption: { $regex: text, $options: "i" },
      isDeleted: false,
      $and: [
        {
          $or: [{ userId: { $in: allowedUserIds } }, { collaborators: userId }],
        },
        {
          userId: { $nin: blockedUserIds },
        },
        {
          $or: [
            { audience: { $ne: "closeFriends" } },
            { userId: { $in: closeFriendsOf } },
            { collaborators: userId },
          ],
        },
      ],
    };

    let posts = await PostModel.find(postQuery)
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
    console.error("Error searching posts by caption:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error,
    });
  }
};

// search places by location in posts (places section)
export const searchPlacesByLocation = async (req: Request, res: Response) => {
  try {
    const { text } = req.params;

    const posts = await PostModel.find({
      "location.formattedAddress": { $regex: text, $options: "i" },
    })
      .select("location")
      .limit(7)
      .lean();

    // create a map of formattedAddress to location object
    const locations = Array.from(
      new Map(
        posts.map((post) => [post.location.formattedAddress, post.location])
      ).values()
    );

    return res.status(200).json({
      success: locations.length > 0,
      message:
        locations.length > 0
          ? "Places fetched successfully"
          : "No places found",
      count: locations.length,
      result: locations,
    });
  } catch (error) {
    console.error("Error searching places:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error,
    });
  }
};

// search hashtags (for tags section)
export const searchHashtags = async (req: Request, res: Response) => {
  try {
    const { text } = req.params;

    const hashtags = await TagModel.find({
      name: { $regex: text, $options: "i" },
    })
      .sort({ tagUsageCount: -1 })
      .limit(7)
      .lean();

    return res.status(200).json({
      success: hashtags ? true : false,
      message: hashtags ? "Hashtags fetched successfully" : "No hashtags found",
      count: hashtags ? hashtags.length : 0,
      result: hashtags ? hashtags : null,
    });
  } catch (error) {
    console.error("Error searching hashtags:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error,
    });
  }
};

// search tapes by post caption
export const searchTapesByCaption = async (req: Request, res: Response) => {
  try {
    const { text } = req.params;
    const userId = (req as any).user.userId;

    const [blockedUserIds, followingIds, closeFriendsOf] = await Promise.all([
      getBlockedUserIds(userId),
      FollowModel.distinct("followedUserId", { userId, isFollowing: true }),
      UserModel.distinct("_id", { "closeFriends.userId": userId }),
    ]);

    const publicUserIds = await UserModel.find({
      isPrivate: false,
      _id: { $nin: [...blockedUserIds, userId] },
    }).distinct("_id");

    const allowedUserIds = [
      ...new Set([
        ...followingIds.map((id) => id.toString()),
        ...publicUserIds.map((id) => id.toString()),
        userId,
      ]),
    ];

    const query = {
      caption: { $regex: text, $options: "i" },
      mediaType: "video",
      isDeleted: false,
      $and: [
        {
          $or: [{ userId: { $in: allowedUserIds } }, { collaborators: userId }],
        },
        { userId: { $nin: blockedUserIds } },
        {
          $or: [
            { audience: { $ne: "closeFriends" } },
            { userId: { $in: closeFriendsOf } },
            { collaborators: userId },
          ],
        },
      ],
    };

    const posts = await PostModel.find(query)
      .select("mediaUrl mediaType tapeThumbnailUrl")
      .sort({ createdAt: -1, engagementRatio: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      message: posts.length ? "Tapes fetched successfully" : "No tapes found",
      count: posts.length,
      result: posts,
    });
  } catch (error) {
    console.error("Error searching tapes:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error,
    });
  }
};

// get all posts by location coordinates
export const getPostsByLocationCoordinates = async (
  req: Request,
  res: Response
) => {
  try {
    const { coordinates } = (req as any).query;
    const userId = (req as any).user.userId;

    if (!coordinates) {
      return res.status(400).json({
        success: false,
        message: "Coordinates are required",
      });
    }

    const cleanString = coordinates.replace(/[\[\]\s]/g, "");
    const coordinatesArray = cleanString.split(",").map(Number);

    const [blockedUserIds, followingIds, closeFriendsOf] = await Promise.all([
      getBlockedUserIds(userId),
      FollowModel.distinct("followedUserId", { userId, isFollowing: true }),
      UserModel.distinct("_id", { "closeFriends.userId": userId }),
    ]);

    const publicUserIds = await UserModel.find({
      isPrivate: false,
      _id: { $nin: [...blockedUserIds, userId] },
    }).distinct("_id");

    const allowedUserIds = [
      ...new Set([
        ...followingIds.map((id) => id.toString()),
        ...publicUserIds.map((id) => id.toString()),
        userId,
      ]),
    ];

    const query = {
      "location.coordinates": coordinatesArray,
      isDeleted: false,
      $and: [
        {
          $or: [{ userId: { $in: allowedUserIds } }, { collaborators: userId }],
        },
        { userId: { $nin: blockedUserIds } },
        {
          $or: [
            { audience: { $ne: "closeFriends" } },
            { userId: { $in: closeFriendsOf } },
            { collaborators: userId },
          ],
        },
      ],
    };

    let posts = await PostModel.find(query)
      .select("mediaUrl mediaType tapeThumbnailUrl")
      .sort({ createdAt: -1, engagementRatio: -1 });

    if (posts.length >= 10) {
      posts = formatPostsInPattern(posts, 20);
    }

    return res.status(200).json({
      success: posts.length > 0,
      message: posts.length ? "Posts fetched successfully" : "No posts found",
      count: posts.length,
      result: posts,
    });
  } catch (error) {
    console.error("Error getting posts by location coordinates:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error,
    });
  }
};

// get related posts (image or video) by a post id
export const getRelatedPosts = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { postId } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const [blockedUserIds, followedUserIds, closeFriendsOf] = await Promise.all(
      [
        getBlockedUserIds(userId),
        FollowModel.distinct("followedUserId", { userId, isFollowing: true }),
        UserModel.distinct("_id", { "closeFriends.userId": userId }),
      ]
    );

    const publicUserIds = await UserModel.find({
      isPrivate: false,
      _id: { $nin: [...blockedUserIds, userId] },
    }).distinct("_id");

    const allowedUserIds = [
      ...new Set([...followedUserIds, ...publicUserIds, userId]),
    ];

    const post = await PostModel.findById(postId).lean();
    if (!post) {
      return res
        .status(404)
        .json({ success: false, message: "Post not found" });
    }

    const mediaType = post.mediaType;
    const tagIds =
      post.hashtags?.map((tag: any) => tag.tagId?.toString()) || [];
    const taggedUserIds =
      post.taggedUsers?.map((tag: any) => tag.userId?.toString()) || [];
    const { city, country } = post.location || {};

    const orFilters: any[] = [];
    if (tagIds.length > 0)
      orFilters.push({ "hashtags.tagId": { $in: tagIds } });
    if (taggedUserIds.length > 0)
      orFilters.push({ "taggedUsers.userId": { $in: taggedUserIds } });
    if (city && country)
      orFilters.push({ "location.city": city, "location.country": country });

    const relatedQuery: any = {
      _id: { $ne: post._id },
      mediaType,
      isDeleted: false,
      userId: { $in: allowedUserIds },
      $and: [
        {
          $or: [
            { audience: { $ne: "closeFriends" } },
            { userId: { $in: closeFriendsOf } },
          ],
        },
        {
          userId: { $nin: blockedUserIds },
        },
      ],
    };

    if (orFilters.length > 0) relatedQuery.$or = orFilters;

    let posts = await PostModel.find(relatedQuery)
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
      .lean();

    let totalPosts = await PostModel.countDocuments(relatedQuery);

    if (posts.length === 0) {
      const fallbackQuery = {
        _id: { $ne: post._id },
        mediaType,
        isDeleted: false,
        userId: { $in: allowedUserIds },
        $and: [
          {
            $or: [
              { audience: { $ne: "closeFriends" } },
              { userId: { $in: closeFriendsOf } },
            ],
          },
          {
            userId: { $nin: blockedUserIds },
          },
        ],
      };

      totalPosts = await PostModel.countDocuments(fallbackQuery);

      posts = await PostModel.find(fallbackQuery)
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
        .lean();
    }

    // add isLiked, isSavedPost and isPinnedPost to each post
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
        ? "Related posts fetched successfully"
        : "No related posts found",
      count: posts.length,
      totalPages: Math.ceil(totalPosts / limit),
      currentPage: page,
      result: posts,
    });
  } catch (error) {
    console.error("Error in getRelatedPosts", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error,
    });
  }
};

// get suggested posts (image or video) for a user
export const getSuggestedPosts = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const mediaType = req.query.mediaType as "image" | "video";
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const [blockedUserIds, followedUserIds, closeFriendsOf] = await Promise.all(
      [
        getBlockedUserIds(userId),
        FollowModel.distinct("followedUserId", { userId, isFollowing: true }),
        UserModel.distinct("_id", { "closeFriends.userId": userId }),
      ]
    );

    const excludedUserIds = [
      ...new Set([...blockedUserIds, ...followedUserIds, userId]),
    ];

    const publicUserIds = await UserModel.find({
      isPrivate: false,
      _id: { $nin: excludedUserIds },
    }).distinct("_id");

    const postQuery: any = {
      userId: { $in: publicUserIds },
      isDeleted: false,
      $or: [
        { audience: { $ne: "closeFriends" } },
        { userId: { $in: closeFriendsOf } },
      ],
    };

    if (mediaType) postQuery.mediaType = mediaType;

    const totalPosts = await PostModel.countDocuments(postQuery);

    const posts = await PostModel.find(postQuery)
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
      .limit(limit);

    return res.status(200).json({
      success: true,
      message: posts.length
        ? "Suggested posts fetched successfully"
        : "No suggested posts found",
      count: posts.length,
      totalPages: Math.ceil(totalPosts / limit),
      currentPage: page,
      result: posts,
    });
  } catch (error) {
    console.error("Error in getSuggestedPosts:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error,
    });
  }
};

// Get search feed posts using user location (city → state → country)
export const getSearchFeedPosts = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;

    const page = parseInt(req.query.page as string) || 1;
    const limit = (parseInt(req.query.limit as string) || 20) + 10;
    const skip = (page - 1) * limit;

    const user = await UserModel.findById(userId).lean();
    const { city, state, country } = user?.location || {};

    if (!city || !state || !country) {
      return res.status(400).json({
        success: false,
        message: "User location not set",
      });
    }

    const [blockedUserIds, followingIds, closeFriendsOf] = await Promise.all([
      getBlockedUserIds(userId),
      FollowModel.distinct("followedUserId", { userId, isFollowing: true }),
      UserModel.distinct("_id", { "closeFriends.userId": userId }),
    ]);

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

    const baseQuery: any = {
      isDeleted: false,
      userId: { $in: allowedUserIds },
      $or: [
        { audience: { $ne: "closeFriends" } },
        { userId: { $in: closeFriendsOf } },
      ],
    };

    const filters = [
      { "location.city": city },
      { "location.state": state, "location.city": { $ne: city } },
      { "location.country": country, "location.state": { $ne: state } },
      {}, // global fallback
    ];

    const postIds: string[] = [];

    for (const filter of filters) {
      const query = { ...baseQuery, ...filter };

      const ids = await PostModel.find(query)
        .sort({ createdAt: -1, engagementRatio: -1 })
        .select("_id")
        .lean();

      for (const post of ids) {
        postIds.push(post._id.toString());
      }
    }

    // Deduplicate + paginate
    const uniquePostIds = [...new Set(postIds)];
    const totalPosts = uniquePostIds.length;

    const paginatedIds = uniquePostIds.slice(skip, skip + limit);

    const posts = await PostModel.find({ _id: { $in: paginatedIds } })
      .select("mediaUrl mediaType tapeThumbnailUrl")
      .lean();

    // sort to match paginatedIds order
    const postMap = new Map(posts.map((p) => [p._id.toString(), p]));
    let sortedPosts = paginatedIds.map((id) => postMap.get(id)).filter(Boolean);

    if (sortedPosts.length === limit) {
      sortedPosts = formatPostsInPattern(sortedPosts, limit);
    }

    return res.status(200).json({
      success: true,
      message: sortedPosts.length
        ? "Posts fetched successfully"
        : "No posts found",
      count: sortedPosts.length,
      totalPages: Math.ceil(totalPosts / limit),
      currentPage: page,
      result: sortedPosts,
    });
  } catch (error) {
    console.error("Error in getSearchFeedPosts:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error,
    });
  }
};

// unified search for users, hashtags, and places
export const searchAllSuggestions = async (req: Request, res: Response) => {
  try {
    const { text } = req.params;
    const { userId } = (req as any).user;

    if (!text || text.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Search text is required",
      });
    }

    // get all blocked user ids
    const allBlockedUserIds = await getBlockedUserIds(userId);

    // ----- Search users -----
    const users = await UserModel.find({
      $or: [
        { username: { $regex: text, $options: "i" } },
        { fullName: { $regex: text, $options: "i" } },
      ],
      isDeleted: false,
      _id: { $nin: allBlockedUserIds },
    })
      .limit(7)
      .select("fullName username profilePicture userTier");

    // ----- Search hashtags -----
    const hashtags = await TagModel.find({
      name: { $regex: text, $options: "i" },
    })
      .sort({ tagUsageCount: -1 })
      .limit(7);

    // ----- Search places -----
    const postsWithLocation = await PostModel.find({
      "location.formattedAddress": { $regex: text, $options: "i" },
    })
      .select("location")
      .limit(20); // get more to remove duplicates

    const places = Array.from(
      new Map(
        postsWithLocation.map((post) => [
          post.location.formattedAddress,
          post.location,
        ])
      ).values()
    ).slice(0, 7); // limit to 7 after removing duplicates

    return res.status(200).json({
      success: true,
      message: "Search results fetched successfully",
      result: {
        users,
        hashtags,
        places,
      },
    });
  } catch (error) {
    console.error("Error in searchAllSuggestions:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error,
    });
  }
};
