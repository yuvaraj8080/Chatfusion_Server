import { Request, Response } from "express";
import { SavePostModel } from "./savepost.model";
import { PostModel } from "../post/post.model";
import { BlockedUserModel } from "../blockUser/blockedUser.model";
import { UserModel } from "../user/user.model";
import { NotificationSettingsModel } from "../setting/alerts&update/notificationSettings.model";
import {
  getServerKeyToken,
  sendPushNotification,
} from "../notification/notification.controller";
import { NotificationModel } from "../notification/notification.model";

// create a collection
export const createCollection = async (req: Request, res: Response) => {
  try {
    const { collectionName, collaboratorIds, postIds } = req.body;
    const userId = (req as any).user.userId;

    if (!collectionName) {
      return res.status(400).json({
        success: false,
        message: "Collection name is required",
      });
    }

    // check if the collection already exists
    const existingCollection = await SavePostModel.findOne({
      userId,
      collectionName,
      isDeleted: false,
    });

    if (existingCollection) {
      return res.status(400).json({
        success: false,
        message: "Collection already exists",
      });
    }

    // Transform postIds into array of objects with mongoose ObjectId
    const postIdsObjectArray = postIds.map((id: string) => ({
      postId: id,
    }));

    // create a new collection
    const collection = await SavePostModel.create({
      userId,
      collectionName,
      postIds: postIdsObjectArray,
    });

    if (collaboratorIds) {
      // get the creator and settings of the collaborators
      const [creator, collaboratorsSettings, collaborators] = await Promise.all(
        [
          UserModel.findById(userId, "username").lean(),
          NotificationSettingsModel.find({
            userId: { $in: collaboratorIds },
          })
            .select("userId muteAllNotifications")
            .lean(),
          UserModel.find({
            _id: { $in: collaboratorIds },
          })
            .select("fcmToken")
            .lean(),
        ]
      );

      const collaboratorsFcmTokenMap: { [key: string]: string } =
        collaborators.reduce((acc, user) => {
          acc[user._id.toString()] = user.fcmToken;
          return acc;
        }, {} as { [key: string]: string });

      // send collaboration request to the collaborators
      if (collaboratorsSettings && collaboratorsSettings?.length > 0) {
        for (const setting of collaboratorsSettings) {
          const notificationDetails = {
            title: "New Collaboration Request",
            message: `${creator?.username} invited you to collaborate on a collection ${collectionName}`,
            senderId: userId,
            receiverId: setting.userId,
            type: "COLLABORATION_COLLECTION_REQUEST",
            targetId: collection._id.toString(),
          };

          const pushNotificationDetails = {
            notification: {
              title: "Genuinest",
              body: `${creator?.username} invited you to collaborate on a collection ${collectionName}`,
            },
            fcmToken: collaboratorsFcmTokenMap[setting.userId.toString()],
            data: { type: "COLLABORATION_COLLECTION_REQUEST" },
            serverKey: await getServerKeyToken(),
          };

          NotificationModel.create({ ...notificationDetails }).catch(
            console.error
          );
          if (
            pushNotificationDetails?.fcmToken &&
            !setting?.muteAllNotifications
          ) {
            sendPushNotification(pushNotificationDetails).catch(console.error);
          }
        }
      }
    }

    return res.status(201).json({
      success: collection ? true : false,
      message: collection
        ? "Collection created successfully"
        : "Failed to create collection",
      result: collection ? collection : null,
    });
  } catch (error) {
    console.error("Error creating collection:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error,
    });
  }
};

// save posts in a collection
export const savePostsInCollection = async (req: Request, res: Response) => {
  try {
    // default collection name is All Posts
    const { collectionName = "All Posts", postIds } = req.body;
    const userId = (req as any).user.userId;

    // Transform postIds into array of objects with mongoose ObjectId
    const postIdsObjectArray = postIds.map((id: string) => ({
      postId: id,
    }));

    // create a new collection and save posts in it
    const collection = await SavePostModel.findOneAndUpdate(
      {
        $or: [{ userId }, { collaborators: userId }],
        collectionName,
        isDeleted: false,
      },
      {
        $addToSet: { postIds: { $each: postIdsObjectArray } },
      },
      { new: true }
    );

    // update the post count for the collection
    if (collection) {
      await PostModel.updateMany(
        { _id: { $in: postIds } },
        { $inc: { savesCount: 1 } }
      );
    }

    return res.status(201).json({
      success: collection ? true : false,
      message: collection
        ? "Posts added to collection successfully"
        : "Failed to add posts to collection",
      result: collection ? collection : null,
    });
  } catch (error) {
    console.error("Error adding posts to collection:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error,
    });
  }
};

// get all collections
export const getAllCollections = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;

    // get all collections
    const collections = await SavePostModel.find({
      $or: [{ userId }, { collaborators: userId }],
      isDeleted: false,
    })
      .select("collectionName")
      .lean();

    return res.status(200).json({
      success: collections ? true : false,
      message: collections
        ? "Collections fetched successfully"
        : "No collections found",
      count: collections ? collections.length : 0,
      result: collections ? collections : null,
    });
  } catch (error) {
    console.error("Error fetching collections:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error,
    });
  }
};

// delete a collection
export const deleteCollection = async (req: Request, res: Response) => {
  try {
    const { collectionName } = req.params;
    const userId = (req as any).user.userId;

    // delete a collection
    const deletedCollection = await SavePostModel.findOneAndUpdate(
      { userId, collectionName, isDeleted: false },
      { isDeleted: true }
    );

    // if the collection is deleted, update the post count for the collection
    if (deletedCollection) {
      await PostModel.updateMany(
        {
          _id: {
            $in: deletedCollection.postIds.map((element) => element.postId),
          },
        },
        { $inc: { savesCount: -1 } }
      );
    }

    return res.status(200).json({
      success: deletedCollection ? true : false,
      message: deletedCollection
        ? "Collection deleted successfully"
        : "Collection not deleted",
    });
  } catch (error) {
    console.error("Error deleting collection:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error,
    });
  }
};

// get all posts in a specific collection
export const getAllPostsInCollection = async (req: Request, res: Response) => {
  try {
    const { collectionName } = req.params;
    const userId = (req as any).user.userId;

    // 1. Get block and close-friends info
    const [blockedByYou, blockedYou, closeFriendsOf] = await Promise.all([
      BlockedUserModel.distinct("blockedUserIds.userId", { userId }).lean(),
      BlockedUserModel.distinct("userId", {
        "blockedUserIds.userId": userId,
      }).lean(),
      UserModel.distinct("_id", { "closeFriends.userId": userId }).lean(),
    ]);

    const allBlockedUserIds = new Set([
      ...blockedByYou.map((id: any) => id.toString()),
      ...blockedYou.map((id: any) => id.toString()),
    ]);

    // 2. Get the saved collection
    const collection = await SavePostModel.findOne({
      $or: [{ userId }, { collaborators: userId }],
      collectionName,
      isDeleted: false,
    })
      .populate({
        path: "postIds.postId",
        select: "mediaUrl mediaType userId audience isDeleted tapeThumbnailUrl",
      })
      .lean();

    if (!collection) {
      return res.status(404).json({
        success: false,
        message: "Collection not found",
      });
    }

    // 3. Filter posts
    const filteredPosts = collection.postIds
      .map((entry: any) => entry.postId)
      .filter((post: any) => {
        if (!post || post.isDeleted) return false;

        const ownerId = post.userId?.toString();
        if (!ownerId || allBlockedUserIds.has(ownerId)) return false;

        if (
          post.audience === "closeFriends" &&
          !closeFriendsOf.includes(ownerId)
        )
          return false;

        return true;
      });

    return res.status(200).json({
      success: true,
      message: filteredPosts.length
        ? "Collection posts fetched successfully"
        : "No posts found",
      count: filteredPosts.length,
      result: filteredPosts.map((post: any) => ({
        postId: {
          _id: post._id,
          userId: post.userId,
          mediaUrl: post.mediaUrl,
          mediaType: post.mediaType,
          tapeThumbnailUrl: post.tapeThumbnailUrl,
        },
      })),
    });
  } catch (error) {
    console.error("Error fetching collection posts:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error,
    });
  }
};

// remove posts from a specific collection
export const removePostsFromCollection = async (
  req: Request,
  res: Response
) => {
  try {
    const { collectionName, postIds } = req.body;
    const userId = (req as any).user.userId;

    const updatedCollection = await SavePostModel.findOneAndUpdate(
      {
        $or: [{ userId }, { collaborators: userId }],
        collectionName,
        isDeleted: false,
      },
      { $pull: { postIds: { postId: { $in: postIds } } } },
      { new: true }
    );

    // if the collection is updated, update the post count for the collection
    if (updatedCollection) {
      await PostModel.updateMany(
        { _id: { $in: postIds } },
        { $inc: { savesCount: -1 } }
      );
    }

    return res.status(200).json({
      success: updatedCollection ? true : false,
      message: updatedCollection
        ? "Posts removed successfully"
        : "Posts not removed",
      result: updatedCollection ? updatedCollection : null,
    });
  } catch (error) {
    console.error("Error removing posts from collection:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error,
    });
  }
};
