import { Request, Response } from "express";
import { StoryHighlightsModel } from "./storyHighlights.model";
import { StoryModel } from "../stories/stories.model";
import { isBlockedBetween } from "../utils/isBlockedBetween";
import { LikeModel } from "../like/like.model";

// create a story highlight
export const createAndUpdateStoryHighlight = async (
  req: Request,
  res: Response
) => {
  try {
    const { storyTitle, stories, thumbnail } = req.body;
    const { userId } = (req as any).user;

    // Transform storyIds into array of objects with mongoose ObjectId
    const storyIdsObjectArray = stories.map((id: string) => ({
      storyId: id,
    }));

    const storyHighlights = await StoryHighlightsModel.findOneAndUpdate(
      {
        userId,
        storyTitle,
        isDeleted: false,
      },
      {
        $addToSet: {
          storyIds: { $each: storyIdsObjectArray },
        },
        thumbnail: thumbnail || null,
      },
      {
        new: true,
        upsert: true,
      }
    ).populate("storyIds.storyId", "mediaType mediaUrl");

    return res.status(201).json({
      success: storyHighlights ? true : false,
      message: storyHighlights
        ? "Story highlights created successfully"
        : "Failed to create story highlights",
      result: storyHighlights ? storyHighlights : null,
    });
  } catch (error) {
    console.log("Error in createStoryHighlights", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create story highlights",
      error: error,
    });
  }
};

// get all story highlights by userId
export const getAllStoryHighlights = async (req: Request, res: Response) => {
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

    const storyHighlightsDocs = await StoryHighlightsModel.find({
      userId,
      isDeleted: false,
    })
      .select("storyTitle storyIds thumbnail")
      .populate(
        "storyIds.storyId",
        "_id mediaType mediaUrl stickers mentionUserIds createdAt isCloseFriendsOnly sharedPost turnOffComments storyReshared"
      )
      .sort({ createdAt: -1 });

    const storyHighlights: any[] = [];

    for (const doc of storyHighlightsDocs) {
      const highlight: any = {
        _id: doc._id,
        storyTitle: doc.storyTitle,
        storyIds: [],
        thumbnail: doc.thumbnail,
      };

      for (const story of doc.storyIds) {
        if (!story.storyId) continue;

        const isLiked = await LikeModel.exists({
          userId: currentUserId,
          storyId: (story.storyId as any)._id,
          isDeleted: false,
        });

        // Create new story object and add isLiked
        const storyData: any = {
          storyId: {
            _id: (story.storyId as any)._id,
            mediaType: (story.storyId as any).mediaType,
            mediaUrl: (story.storyId as any).mediaUrl,
            stickers: (story.storyId as any).stickers,
            mentionUserIds: (story.storyId as any).mentionUserIds,
            createdAt: (story.storyId as any).createdAt,
            isCloseFriendsOnly: (story.storyId as any).isCloseFriendsOnly,
            sharedPost: (story.storyId as any).sharedPost,
            turnOffComments: (story.storyId as any).turnOffComments,
            storyReshared: (story.storyId as any).storyReshared,
            isLiked: !!isLiked,
          },
        };

        (highlight.storyIds as any).push(storyData);
      }

      if (highlight.storyIds.length > 0) {
        storyHighlights.push(highlight);
      }
    }

    return res.status(200).json({
      success: true,
      message: "Story highlights fetched successfully",
      result: storyHighlights,
    });
  } catch (error) {
    console.log("Error in getAllStoryHighlights", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch story highlights",
      error: error,
    });
  }
};

// delete a specifc story from story highlight
export const deleteSpecificStoryFromStoryHighlight = async (
  req: Request,
  res: Response
) => {
  try {
    const { storyId, storyTitle } = req.body;
    const { userId } = (req as any).user;

    const storyHighlights = await StoryHighlightsModel.findOneAndUpdate(
      {
        userId,
        storyTitle,
        isDeleted: false,
      },
      {
        $pull: {
          storyIds: {
            storyId: storyId,
          },
        },
      },
      { new: true }
    );

    return res.status(200).json({
      success: storyHighlights ? true : false,
      message: storyHighlights
        ? "Story highlights deleted successfully"
        : "Failed to delete story highlights",
      result: storyHighlights ? storyHighlights : null,
    });
  } catch (error) {
    console.log("Error in deleteStoryHighlights", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete story highlights",
      error: error,
    });
  }
};

// delete a story highlight
export const deleteStoryHighlight = async (req: Request, res: Response) => {
  try {
    const { storyHighlightsId } = req.params;
    const { userId } = (req as any).user;

    const storyHighlights = await StoryHighlightsModel.findOneAndUpdate(
      {
        userId,
        _id: storyHighlightsId,
      },
      { isDeleted: true },
      { new: true }
    );

    return res.status(200).json({
      success: storyHighlights ? true : false,
      message: storyHighlights
        ? "Story highlights deleted successfully"
        : "Failed to delete story highlights",
      result: storyHighlights ? storyHighlights : null,
    });
  } catch (error) {
    console.log("Error in deleteStoryHighlights", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete story highlights",
      error: error,
    });
  }
};

// get all stories of a user including expired stories
export const getAllStoriesOfUser = async (req: Request, res: Response) => {
  try {
    const { userId } = (req as any).user;

    const stories = await StoryModel.find({
      userId,
      isDeleted: false,
    })
      .select("mediaUrl createdAt sharedPost storyReshared")
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: stories ? true : false,
      message: stories
        ? "Stories fetched successfully"
        : "Failed to fetch stories",
      result: stories ? stories : null,
    });
  } catch (error) {
    console.log("Error in getAllStoriesOfUser", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch stories",
      error: error,
    });
  }
};
