import { Request, Response } from "express";
import { PostModel } from "../../post/post.model";
import { StoryModel } from "../../stories/stories.model";

// make post or story archived
export const makeArchived = async (req: Request, res: Response) => {
  try {
    const { postId, storyId } = req.params;
    const { userId } = (req as any).user;

    const [post, story] = await Promise.all([
      postId ? PostModel.findOne({ _id: postId, userId }) : null,
      storyId ? StoryModel.findOne({ _id: storyId, userId }) : null,
    ]);

    if (!post && !story) {
      return res.status(404).json({
        success: false,
        message: "Post or story not found",
      });
    }

    if (post) {
      post.isArchived = true;
      post.isDeleted = true;
      await post.save();
    }

    if (story) {
      story.isArchived = true;
      story.isDeleted = true;
      await story.save();
    }

    return res.status(200).json({
      success: post || story ? true : false,
      message: post
        ? "Post archived successfully"
        : "Story archived successfully",
    });
  } catch (error) {
    console.error("Error making post or story archived:", error);
    return res.status(500).json({
      success: false,
      message: "Error making post or story archived",
    });
  }
};

// unarchive post or story
export const makeUnarchived = async (req: Request, res: Response) => {
  try {
    const { postId, storyId } = req.params;
    const { userId } = (req as any).user;

    const [post, story] = await Promise.all([
      postId ? PostModel.findOne({ _id: postId, userId }) : null,
      storyId ? StoryModel.findOne({ _id: storyId, userId }) : null,
    ]);

    if (!post && !story) {
      return res.status(404).json({
        success: false,
        message: "Post or story not found",
      });
    }

    if (post) {
      post.isArchived = false;
      post.isDeleted = false;
      await post.save();
    }

    if (story) {
      story.isArchived = false;
      story.isDeleted = false;
      await story.save();
    }

    return res.status(200).json({
      success: post || story ? true : false,
      message: post
        ? "Post unarchived successfully"
        : "Story unarchived successfully",
    });
  } catch (error) {
    console.error("Error making post or story unarchived:", error);
    return res.status(500).json({
      success: false,
      message: "Error making post or story unarchived",
    });
  }
};

// get archived posts
export const getArchivedPosts = async (req: Request, res: Response) => {
  try {
    const { userId } = (req as any).user;

    const posts = await PostModel.find({ userId, isArchived: true })
      .select("mediaUrl mediaType tapeThumbnailUrl")
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: posts ? true : false,
      message: posts
        ? "Archived posts fetched successfully"
        : "No archived posts found",
      count: posts ? posts.length : 0,
      result: posts ? posts : null,
    });
  } catch (error) {
    console.error("Error getting archived posts:", error);
    return res.status(500).json({
      success: false,
      message: "Error getting archived posts",
    });
  }
};

// get archived stories
export const getArchivedStories = async (req: Request, res: Response) => {
  try {
    const { userId } = (req as any).user;

    const stories = await StoryModel.find({ userId, isArchived: true })
      .select("mediaUrl mediaType updatedAt sharedPost storyReshared")
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: stories ? true : false,
      message: stories
        ? "Archived stories fetched successfully"
        : "No archived stories found",
      count: stories ? stories.length : 0,
      result: stories ? stories : null,
    });
  } catch (error) {
    console.error("Error getting archived stories:", error);
    return res.status(500).json({
      success: false,
      message: "Error getting archived stories",
    });
  }
};
