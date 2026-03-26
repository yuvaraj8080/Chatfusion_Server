import { Request, Response } from "express";
import { NotificationSettingsModel } from "./notificationSettings.model";

// toggle mute all notifications
export const toggleMuteAllNotifications = async (
  req: Request,
  res: Response
) => {
  try {
    const { userId } = (req as any).user;

    const notificationSettings = await NotificationSettingsModel.findOne({
      userId,
    });

    if (!notificationSettings) {
      return res.status(404).json({
        success: false,
        message: "Notification settings not found",
      });
    }

    // toggle mute all notifications
    notificationSettings.muteAllNotifications =
      !notificationSettings.muteAllNotifications;
    await notificationSettings.save();

    return res.status(200).json({
      success: true,
      message: notificationSettings.muteAllNotifications
        ? "Notifications muted successfully"
        : "Notifications unmuted successfully",
      result: {
        muteAllNotifications: notificationSettings.muteAllNotifications,
      },
    });
  } catch (error) {
    console.log("Error in toggleMuteAllNotifications", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error,
    });
  }
};

// get mute all notifications status for user
export const getMuteAllNotificationsStatus = async (
  req: Request,
  res: Response
) => {
  try {
    const { userId } = (req as any).user;

    const notificationSettings = await NotificationSettingsModel.findOne({
      userId,
    }).lean();

    return res.status(200).json({
      success: notificationSettings ? true : false,
      message: notificationSettings
        ? "Notification settings fetched successfully"
        : "Notification settings not found",
      result: {
        muteAllNotifications: notificationSettings?.muteAllNotifications,
      },
    });
  } catch (error) {
    console.log("Error in getMuteAllNotificationsStatus", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error,
    });
  }
};

// get post notification settings
export const getPostNotificationSettings = async (
  req: Request,
  res: Response
) => {
  try {
    const { userId } = (req as any).user;

    const notificationSettings = await NotificationSettingsModel.findOne({
      userId,
    })
      .select("postNotifications")
      .lean();

    return res.status(200).json({
      success: notificationSettings ? true : false,
      message: notificationSettings
        ? "Post notification settings fetched successfully"
        : "Post notification settings not found",
      result: notificationSettings
        ? notificationSettings.postNotifications
        : null,
    });
  } catch (error) {
    console.log("Error in getPostNotificationSettings", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error,
    });
  }
};

// update post notification settings
export const updatePostNotificationSettings = async (
  req: Request,
  res: Response
) => {
  try {
    const { userId } = (req as any).user;

    const postNotificationsSettings = await NotificationSettingsModel.findOne({
      userId,
    }).select("postNotifications");

    if (!postNotificationsSettings) {
      return res.status(404).json({
        success: false,
        message: "Post notification settings not found",
      });
    }

    // update post notification settings
    postNotificationsSettings.postNotifications.likes =
      req.body.likes || postNotificationsSettings.postNotifications.likes;
    postNotificationsSettings.postNotifications.comments =
      req.body.comments || postNotificationsSettings.postNotifications.comments;
    postNotificationsSettings.postNotifications.likesAndCommentsOnPhotosOfYou =
      req.body.likesAndCommentsOnPhotosOfYou ||
      postNotificationsSettings.postNotifications.likesAndCommentsOnPhotosOfYou;
    postNotificationsSettings.postNotifications.firstPosts =
      req.body.firstPosts ||
      postNotificationsSettings.postNotifications.firstPosts;
    postNotificationsSettings.postNotifications.photosOfYou =
      req.body.photosOfYou ||
      postNotificationsSettings.postNotifications.photosOfYou;
    postNotificationsSettings.postNotifications.collabartionInvitations =
      req.body.collabartionInvitations ||
      postNotificationsSettings.postNotifications.collabartionInvitations;

    await postNotificationsSettings.save();

    return res.status(200).json({
      success: true,
      message: "Post notification settings updated successfully",
      result: postNotificationsSettings.postNotifications,
    });
  } catch (error) {
    console.log("Error in updatePostNotificationSettings", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error,
    });
  }
};

// get story notification settings
export const getStoryNotificationSettings = async (
  req: Request,
  res: Response
) => {
  try {
    const { userId } = (req as any).user;

    const notificationSettings = await NotificationSettingsModel.findOne({
      userId,
    })
      .select("storyNotifications")
      .lean();

    return res.status(200).json({
      success: notificationSettings ? true : false,
      message: notificationSettings
        ? "Story notification settings fetched successfully"
        : "Story notification settings not found",
      result: notificationSettings
        ? notificationSettings.storyNotifications
        : null,
    });
  } catch (error) {
    console.log("Error in getStoryNotificationSettings", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error,
    });
  }
};

// update story notification settings
export const updateStoryNotificationSettings = async (
  req: Request,
  res: Response
) => {
  try {
    const { userId } = (req as any).user;

    const storyNotificationsSettings = await NotificationSettingsModel.findOne({
      userId,
    }).select("storyNotifications");

    if (!storyNotificationsSettings) {
      return res.status(404).json({
        success: false,
        message: "Story notification settings not found",
      });
    }

    // update story notification settings
    storyNotificationsSettings.storyNotifications.likes =
      req.body.likes || storyNotificationsSettings.storyNotifications.likes;
    storyNotificationsSettings.storyNotifications.comments =
      req.body.comments ||
      storyNotificationsSettings.storyNotifications.comments;
    storyNotificationsSettings.storyNotifications.firstStory =
      req.body.firstStory ||
      storyNotificationsSettings.storyNotifications.firstStory;
    storyNotificationsSettings.storyNotifications.mentions =
      req.body.mentions ||
      storyNotificationsSettings.storyNotifications.mentions;

    await storyNotificationsSettings.save();

    return res.status(200).json({
      success: true,
      message: "Story notification settings updated successfully",
      result: storyNotificationsSettings.storyNotifications,
    });
  } catch (error) {
    console.log("Error in updateStoryNotificationSettings", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error,
    });
  }
};

// toggle canShareWhoAreMentionedInStory in settings
export const toggleCanShareWhoAreMentionedInStory = async (
  req: Request,
  res: Response
) => {
  try {
    const { userId } = (req as any).user;

    const notificationSettings = await NotificationSettingsModel.findOne({
      userId,
    }).select("storyNotifications");

    if (!notificationSettings) {
      return res.status(404).json({
        success: false,
        message: "Notification settings not found",
      });
    }

    notificationSettings.storyNotifications.canShareWhoAreMentionedInStory =
      !notificationSettings.storyNotifications.canShareWhoAreMentionedInStory;

    await notificationSettings.save();

    return res.status(200).json({
      success: true,
      message: "Can share who are mentioned in story updated successfully",
      result: {
        canShareWhoAreMentionedInStory:
          notificationSettings.storyNotifications
            .canShareWhoAreMentionedInStory,
      },
    });
  } catch (error) {
    console.log("Error in toggleCanShareWhoAreMentionedInStory", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error,
    });
  }
};

// toggle canShareStoriesInMessage in settings
export const toggleCanShareStoriesInMessage = async (
  req: Request,
  res: Response
) => {
  try {
    const { userId } = (req as any).user;

    const notificationSettings = await NotificationSettingsModel.findOne({
      userId,
    }).select("storyNotifications");

    if (!notificationSettings) {
      return res.status(404).json({
        success: false,
        message: "Notification settings not found",
      });
    }

    notificationSettings.storyNotifications.canShareStoriesInMessage =
      !notificationSettings.storyNotifications.canShareStoriesInMessage;

    await notificationSettings.save();

    return res.status(200).json({
      success: true,
      message: "Can share stories in message updated successfully",
      result: {
        canShareStoriesInMessage:
          notificationSettings.storyNotifications.canShareStoriesInMessage,
      },
    });
  } catch (error) {
    console.log("Error in toggleCanShareStoriesInMessage", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error,
    });
  }
};

// get followingAndFollowers notification settings
export const getFollowingAndFollowersNotificationSettings = async (
  req: Request,
  res: Response
) => {
  try {
    const { userId } = (req as any).user;

    const notificationSettings = await NotificationSettingsModel.findOne({
      userId,
    })
      .select("followingAndFollowersNotifications")
      .lean();

    return res.status(200).json({
      success: notificationSettings ? true : false,
      message: notificationSettings
        ? "Following and followers notification settings fetched successfully"
        : "Following and followers notification settings not found",
      result: notificationSettings
        ? notificationSettings.followingAndFollowersNotifications
        : null,
    });
  } catch (error) {
    console.log("Error in getFollowingAndFollowersNotificationSettings", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error,
    });
  }
};

// update followingAndFollowers notification settings
export const updateFollowingAndFollowersNotificationSettings = async (
  req: Request,
  res: Response
) => {
  try {
    const { userId } = (req as any).user;

    const followingAndFollowersNotificationsSettings =
      await NotificationSettingsModel.findOne({
        userId,
      }).select("followingAndFollowersNotifications");

    if (!followingAndFollowersNotificationsSettings) {
      return res.status(404).json({
        success: false,
        message: "Following and followers notification settings not found",
      });
    }

    // update following and followers notification settings
    followingAndFollowersNotificationsSettings.followingAndFollowersNotifications.followRequests =
      req.body.followRequests ||
      followingAndFollowersNotificationsSettings
        .followingAndFollowersNotifications.followRequests;
    followingAndFollowersNotificationsSettings.followingAndFollowersNotifications.acceptedFollowRequests =
      req.body.acceptedFollowRequests ||
      followingAndFollowersNotificationsSettings
        .followingAndFollowersNotifications.acceptedFollowRequests;
    followingAndFollowersNotificationsSettings.followingAndFollowersNotifications.accountSuggestions =
      req.body.accountSuggestions ||
      followingAndFollowersNotificationsSettings
        .followingAndFollowersNotifications.accountSuggestions;
    followingAndFollowersNotificationsSettings.followingAndFollowersNotifications.mentionsInBio =
      req.body.mentionsInBio ||
      followingAndFollowersNotificationsSettings
        .followingAndFollowersNotifications.mentionsInBio;

    await followingAndFollowersNotificationsSettings.save();

    return res.status(200).json({
      success: true,
      message:
        "Following and followers notification settings updated successfully",
      result:
        followingAndFollowersNotificationsSettings.followingAndFollowersNotifications,
    });
  } catch (error) {
    console.log(
      "Error in updateFollowingAndFollowersNotificationSettings",
      error
    );
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error,
    });
  }
};

// get message notification settings
export const getMessageNotificationSettings = async (
  req: Request,
  res: Response
) => {
  try {
    const { userId } = (req as any).user;

    const notificationSettings = await NotificationSettingsModel.findOne({
      userId,
    })
      .select("messageNotifications")
      .lean();

    return res.status(200).json({
      success: notificationSettings ? true : false,
      message: notificationSettings
        ? "Message notification settings fetched successfully"
        : "Message notification settings not found",
      result: notificationSettings
        ? notificationSettings.messageNotifications
        : null,
    });
  } catch (error) {
    console.log("Error in getMessageNotificationSettings", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error,
    });
  }
};

// update message notification settings
export const updateMessageNotificationSettings = async (
  req: Request,
  res: Response
) => {
  try {
    const { userId } = (req as any).user;

    const messageNotificationsSettings =
      await NotificationSettingsModel.findOne({
        userId,
      }).select("messageNotifications");

    if (!messageNotificationsSettings) {
      return res.status(404).json({
        success: false,
        message: "Message notification settings not found",
      });
    }

    // update message notification settings
    messageNotificationsSettings.messageNotifications.messageRequests =
      req.body.messageRequests ||
      messageNotificationsSettings.messageNotifications.messageRequests;
    messageNotificationsSettings.messageNotifications.messageFromIndividualsAndGroupChats =
      req.body.messageFromIndividualsAndGroupChats ||
      messageNotificationsSettings.messageNotifications
        .messageFromIndividualsAndGroupChats;
    messageNotificationsSettings.messageNotifications.messageReminders =
      req.body.messageReminders ||
      messageNotificationsSettings.messageNotifications.messageReminders;
    messageNotificationsSettings.messageNotifications.screenShotNotification =
      req.body.screenShotNotification ||
      messageNotificationsSettings.messageNotifications.screenShotNotification;
    messageNotificationsSettings.messageNotifications.groupRequest =
      req.body.groupRequest ||
      messageNotificationsSettings.messageNotifications.groupRequest;

    await messageNotificationsSettings.save();

    return res.status(200).json({
      success: true,
      message: "Message notification settings updated successfully",
      result: messageNotificationsSettings.messageNotifications,
    });
  } catch (error) {
    console.log("Error in updateMessageNotificationSettings", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error,
    });
  }
};
