import { Request, Response } from "express";
import { SettingsModel } from "../settings.model";
import { PostModel } from "../../post/post.model";

// get tags and mentions settings
export const getTagsAndMentionsSettings = async (
  req: Request,
  res: Response
) => {
  try {
    const { userId } = (req as any).user;

    const settings = await SettingsModel.findOne({ userId })
      .select("whoCanTag whoCanMention manuallyApproveTags")
      .lean();

    return res.status(200).json({
      success: settings ? true : false,
      message: settings
        ? "Tags and mentions settings fetched successfully"
        : "Tags and mentions settings not found",
      data: settings ? settings : null,
    });
  } catch (error) {
    console.log("Error in getTagsAndMentionsSettings", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error,
    });
  }
};

// update tags and mentions settings
export const updateTagsAndMentionsSettings = async (
  req: Request,
  res: Response
) => {
  try {
    const { userId } = (req as any).user;

    const settings = await SettingsModel.findOne({ userId });

    if (!settings) {
      return res.status(404).json({
        success: false,
        message: "Tags and mentions settings not found",
      });
    }

    settings.whoCanTag = req.body.whoCanTag || settings.whoCanTag;
    settings.whoCanMention = req.body.whoCanMention || settings.whoCanMention;

    await settings.save();

    return res.status(200).json({
      success: settings ? true : false,
      message: settings
        ? "Tags and mentions settings updated successfully"
        : "Tags and mentions settings not found",
      data: settings ? settings : null,
    });
  } catch (error) {
    console.log("Error in updateTagsAndMentionsSettings", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error,
    });
  }
};

// toggle manually approve tags
export const toggleManuallyApproveTags = async (
  req: Request,
  res: Response
) => {
  try {
    const { userId } = (req as any).user;

    const settings = await SettingsModel.findOne({ userId });

    if (!settings) {
      return res.status(404).json({
        success: false,
        message: "Tags and mentions settings not found",
      });
    }

    settings.manuallyApproveTags = !settings.manuallyApproveTags;
    await settings.save();

    return res.status(200).json({
      success: settings ? true : false,
      message: settings
        ? "Manually approve tags updated successfully"
        : "Tags and mentions settings not found",
      result: {
        manuallyApproveTags: settings.manuallyApproveTags,
      },
    });
  } catch (error) {
    console.log("Error in toggleManuallyApproveTags", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error,
    });
  }
};

// get pending tags posts
export const getPendingTagsPosts = async (req: Request, res: Response) => {
  try {
    const { userId } = (req as any).user;

    const posts = await SettingsModel.findOne({ userId })
      .select("notApprovedPosts")
      .populate("notApprovedPosts", "mediaUrl mediaType tapeThumbnailUrl")
      .lean();

    return res.status(200).json({
      success: posts ? true : false,
      message: posts
        ? "Pending tags posts fetched successfully"
        : "No pending tags posts found",
      count: posts ? posts.notApprovedPosts.length : 0,
      result: posts ? posts.notApprovedPosts : null,
    });
  } catch (error) {
    console.log("Error in getPendingTagsPosts", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error,
    });
  }
};

// approve pending tags posts
export const approvePendingTagsPosts = async (req: Request, res: Response) => {
  try {
    const { userId } = (req as any).user;
    const { postIds } = req.body;

    // add the current user id to the tagged users array of the posts
    await PostModel.updateMany(
      { _id: { $in: postIds } },
      { $addToSet: { taggedUsers: { userId: userId } } }
    );

    // remove the posts from the not approved posts array of the user
    const settings = await SettingsModel.findOneAndUpdate(
      { userId },
      { $pull: { notApprovedPosts: { $in: postIds } } },
      { new: true }
    )
      .select("notApprovedPosts")
      .populate("notApprovedPosts", "mediaUrl mediaType tapeThumbnailUrl")
      .lean();

    return res.status(200).json({
      success: settings ? true : false,
      message: settings
        ? "Pending tags posts approved successfully"
        : "No pending tags posts found",
      count: settings ? settings.notApprovedPosts.length : 0,
      result: settings ? settings.notApprovedPosts : null,
    });
  } catch (error) {
    console.log("Error in approvePendingTagsPosts", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error,
    });
  }
};

// remove user from tagged posts
export const removeUserFromTaggedPosts = async (
  req: Request,
  res: Response
) => {
  try {
    const { userId } = (req as any).user;
    const { postIds } = req.body;

    await PostModel.updateMany(
      { _id: { $in: postIds } },
      { $pull: { taggedUsers: { userId: userId } } }
    );

    return res.status(200).json({
      success: true,
      message: "User removed from tagged posts successfully",
    });
  } catch (error) {
    console.log("Error in removeUserFromTaggedPosts", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error,
    });
  }
};

// hide tagged posts
export const hideTaggedPosts = async (req: Request, res: Response) => {
  try {
    const { userId } = (req as any).user;
    const { postIds } = req.body;

    await SettingsModel.findOneAndUpdate(
      { userId },
      { $addToSet: { hiddenTaggedPosts: { $each: postIds } } }
    );

    return res.status(200).json({
      success: true,
      message: "Tagged posts hidden successfully",
    });
  } catch (error) {
    console.log("Error in hideTaggedPosts", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error,
    });
  }
};
