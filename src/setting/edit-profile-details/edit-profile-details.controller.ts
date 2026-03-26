import { getLocationByCoordinates } from "../../utils/geocoder";
import { UserModel } from "../../user/user.model";
import { Request, Response } from "express";
import { NotificationSettingsModel } from "../../setting/alerts&update/notificationSettings.model";
import { FollowModel } from "../../follow/follow.model";
import { NotificationModel } from "../../notification/notification.model";
import {
  getServerKeyToken,
  sendPushNotification,
} from "../../notification/notification.controller";

// update user profile details (including profile picture)
export const updateUserProfileDetails = async (req: Request, res: Response) => {
  try {
    const { userId } = (req as any).user;
    const { mentionedUserIdsInBio } = req.body;

    console.log(`👤 UPDATE PROFILE REQUEST FOR USER: ${userId}`);
    console.log('📦 REQUEST BODY:', JSON.stringify(req.body, null, 2));

    const user = await UserModel.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: user ? false : true,
        message: "User not found or You are not authorized to update this user",
      });
    }

    // if the field is present in the request body, update the user
    user.fullName = req.body.fullName || user.fullName;
    user.phone = req.body.phone || user.phone;
    user.username = req.body.username || user.username;
    user.gender = req.body.gender || user.gender;
    user.DOB = req.body.DOB || user.DOB;
    user.profession = req.body.profession || user.profession;
    user.email = req.body.email || user.email;
    user.bio = req.body.bio || user.bio;
    user.link = req.body.link || user.link;
    user.profilePicture = req.body.profilePicture || user.profilePicture;
    user.videoProfileUrl = req.body.videoProfileUrl || user.videoProfileUrl;
    user.verificationDocuments =
      req.body.verificationDocuments || user.verificationDocuments;
    user.mentionedUserIdsInBio =
      mentionedUserIdsInBio || user.mentionedUserIdsInBio;

    if (req.body.coordinates) {
      const location = await getLocationByCoordinates(req.body.coordinates);

      //create the user location
      const userLocation = {
        coordinates: [location.longitude, location.latitude],
        formattedAddress: location.formattedAddress || "",
        street: location.streetName || "",
        city: location.city || "",
        state:
          location.state || location.administrativeLevels?.level1long || "",
        zipcode: location.zipcode || "",
        country: location.country || "",
      };

      user.location = userLocation as any;
    }

    // sent notification to the mentioned users in bio
    if (mentionedUserIdsInBio) {
      const settings = await NotificationSettingsModel.find({
        userId: { $in: mentionedUserIdsInBio },
      }).select(
        "userId muteAllNotifications followingAndFollowersNotifications.mentionsInBio"
      );

      for (const setting of settings) {
        if (
          setting?.followingAndFollowersNotifications?.mentionsInBio !==
          "no_one"
        ) {
          const notificationDetails = {
            title: "New Mention",
            message: `${user.username} mentioned you in their bio`,
            senderId: userId,
            receiverId: setting.userId,
            type: "MENTION",
            targetId: user._id,
            mediaType: "image",
            mediaUrl: user.profilePicture,
          };

          const pushNotificationDetails = {
            notification: {
              title: "Genuinest",
              body: `${user.username} mentioned you in their bio`,
            },
            fcmToken: user.fcmToken,
            data: { type: "MENTION", id: user?._id.toString() },
            serverKey: await getServerKeyToken(),
          };

          if (
            setting?.followingAndFollowersNotifications?.mentionsInBio ===
            "everyone"
          ) {
            NotificationModel.create({ ...notificationDetails }).catch(
              console.error
            );

            if (user.fcmToken && !setting?.muteAllNotifications) {
              sendPushNotification(pushNotificationDetails).catch(
                console.error
              );
            }
          } else if (
            setting?.followingAndFollowersNotifications?.mentionsInBio ===
            "followees"
          ) {
            const isFollower = await FollowModel.findOne({
              userId: setting.userId,
              followedUserId: userId,
              isFollowing: true,
            });

            if (isFollower) {
              NotificationModel.create({ ...notificationDetails }).catch(
                console.error
              );

              if (user.fcmToken && !setting?.muteAllNotifications) {
                sendPushNotification(pushNotificationDetails).catch(
                  console.error
                );
              }
            }
          }
        }
      }
    }

    await user.save();

    return res.status(200).json({
      success: user ? true : false,
      message: user ? "User updated successfully" : "Failed to update user",
      result: user ? user : null,
    });
  } catch (error) {
    console.error("Error updating user:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error,
    });
  }
};

// delete profile picture
export const deleteProfilePicture = async (req: Request, res: Response) => {
  try {
    const { userId } = (req as any).user;

    const user = await UserModel.findByIdAndUpdate(
      userId,
      {
        profilePicture: null,
      },
      { new: true }
    );

    return res.status(200).json({
      success: user ? true : false,
      message: user
        ? "Profile picture deleted successfully"
        : "Failed to delete profile picture",
      result: user ? user : null,
    });
  } catch (error) {
    console.error("Error deleting profile picture:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error,
    });
  }
};

// update user location
export const updateUserLocation = async (req: Request, res: Response) => {
  try {
    const { userId } = (req as any).user;
    const { coordinates } = req.body;

    const user = await UserModel.findById(userId);

    if (!user || !coordinates) {
      return res.status(404).json({
        success: user ? false : true,
        message: "User not found or coordinates not found",
      });
    }

    if (coordinates) {
      const location = await getLocationByCoordinates(coordinates);

      //create the user location
      const userLocation = {
        coordinates: [location.longitude, location.latitude],
        formattedAddress: location.formattedAddress || "",
        street: location.streetName || "",
        city: location.city || "",
        state:
          location.state || location.administrativeLevels?.level1long || "",
        zipcode: location.zipcode || "",
        country: location.country || "",
      };

      user.location = userLocation as any;
    }

    await user.save();

    return res.status(200).json({
      success: user ? true : false,
      message: user
        ? "User location updated successfully"
        : "Failed to update user location",
      result: user ? user : null,
    });
  } catch (error) {
    console.error("Error updating user location:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error,
    });
  }
};
