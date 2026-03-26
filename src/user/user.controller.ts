import { Request, Response } from "express";
import { UserModel } from "./user.model";
import { FollowModel } from "../follow/follow.model";
import { createAccessTokenForUser } from "../utils/generic/auth/auth.middleware";
import { getLocationByCoordinates } from "../utils/geocoder";
import { SettingsModel } from "../setting/settings.model";
import { NotificationSettingsModel } from "../setting/alerts&update/notificationSettings.model";
import { isBlockedBetween } from "../utils/isBlockedBetween";
import {
  SubscriptionModel,
  SubscriptionStatus,
} from "../paymentModule/subscriptionModule/subscription.model";

// Helper function to get badge information
const getBadgeInfo = (userTier: string) => {
  const badgeMap = {
    Golden: {
      name: "Golden Badge",
      icon: "🥇",
      color: "#FFD700",
      description: "Premium Golden Member",
    },
    Silver: {
      name: "Silver Badge",
      icon: "🥈",
      color: "#C0C0C0",
      description: "Silver Member",
    },
    Blue: {
      name: "Blue Badge",
      icon: "🔵",
      color: "#0066CC",
      description: "Blue Member",
    },
    Default: {
      name: "Default Badge",
      icon: "⚪",
      color: "#808080",
      description: "Free Member",
    },
  };

  return badgeMap[userTier as keyof typeof badgeMap] || badgeMap.Default;
};

// create a user
export const createUser = async (req: Request, res: Response) => {
  try {
    // Check if username already exists
    const existingUser = await UserModel.findOne({
      username: req.body.username,
    });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "User already exists with this username",
      });
    }

    // ✅ Check phone usage limit (max 5 accounts per phone number)
    const phoneCount = await UserModel.countDocuments({
      phone: req.body.phone,
    });
    if (phoneCount >= 5) {
      return res.status(400).json({
        success: false,
        message: "Maximum 5 accounts allowed per phone number",
      });
    }

    if (!req.body.coordinates) {
      return res.status(400).json({
        success: false,
        message: "Coordinates are required",
      });
    }

    // get location
    const location = await getLocationByCoordinates(req.body.coordinates);
    if (!location) {
      return res.status(400).json({
        success: false,
        message: "Invalid coordinates or failed to get location",
      });
    }

    const userLocation = {
      coordinates: [location.longitude, location.latitude],
      formattedAddress: location.formattedAddress || "—",
      street: location.streetName || "",
      city: location.city || "—",
      state:
        location.state ||
        location.administrativeLevels?.level1long ||
        "—",
      zipcode: location.zipcode || "—",
      country: location.country || "—",
    };

    // Create the user
    const user = await UserModel.create({
      fullName: req.body.fullName,
      username: req.body.username,
      gender: req.body.gender,
      DOB: req.body.DOB,
      phone: req.body.phone,
      email: req.body.email,
      isPrivate: req.body.isPrivate,
      profession: req.body.profession,
      profilePicture: req.body.profilePicture,
      bio: req.body.bio,
      link: req.body.link,
      location: userLocation,
      fcmToken: req.body.fcmToken,
    });

    if (user) {
      await Promise.all([
        SettingsModel.create({ userId: user._id }),
        NotificationSettingsModel.create({ userId: user._id }),
      ]);
    }

    return res.status(201).json({
      success: !!user,
      message: user ? "User created successfully" : "Failed to create user",
      result: user || null,
      accessToken: user ? createAccessTokenForUser(user._id) : null,
    });
  } catch (error) {
    console.error("Error creating user:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error,
    });
  }
};

// get all users except the ones the current user is following
export const getUsersExceptFollowing = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;

    // Step 1: Get all users the current user is following
    const following = await FollowModel.find({
      userId: userId,
      isFollowing: true,
    }).select("followedUserId");

    const followingIds = following.map((follow) => follow.followedUserId);

    // Step 2: Get all users except the ones the current user is following and the current user itself
    const users = await UserModel.find({
      _id: {
        $nin: followingIds,
        $ne: userId,
      },
      isDeleted: false,
    });

    return res.status(200).json({
      success: users ? true : false,
      message: users ? "Users fetched successfully" : "No users found",
      count: users ? users.length : 0,
      result: users ? users : null,
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error,
    });
  }
};

// get user details by id
export const getUserById = async (req: Request, res: Response) => {
  try {
    const userId = req.params.userId;
    const currentUserId = (req as any).user.userId;

    const [user, isBlocked] = await Promise.all([
      UserModel.findOne({
        _id: userId,
        isDeleted: false,
      })
        .populate("planId")
        .lean(),

      isBlockedBetween(currentUserId, userId),
    ]);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (isBlocked) {
      return res.status(403).json({
        success: false,
        message: "You cannot view this user due to a block relationship",
      });
    }

    // Get badge information
    const badgeInfo = getBadgeInfo(user.userTier);

    // Check if user has active subscription
    let subscriptionStatus = null;

    if (user.subscriptionId) {
      const subscription = await SubscriptionModel.findById(
        user.subscriptionId
      ).lean();

      subscriptionStatus = subscription
        ? {
            status: subscription.status,
            startDate: subscription.startDate,
            endDate: subscription.endDate,
            isActive: subscription.status === SubscriptionStatus.ACTIVE,
          }
        : null;
    }

    const userWithBadge = {
      ...user,
      badge: badgeInfo,
      subscriptionStatus,
    };

    return res.status(200).json({
      success: true,
      message: "User fetched successfully",
      result: userWithBadge,
    });
  } catch (error) {
    console.error("Error fetching user:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error,
    });
  }
};

// save user name
export const saveUserName = async (req: Request, res: Response) => {
  try {
    const { phone, username } = req.body;

    // ✅ Check phone usage limit (max 5 accounts per phone number)
    const phoneCount = await UserModel.countDocuments({
      phone,
    });

    if (phoneCount >= 5) {
      return res.status(400).json({
        success: false,
        message: "Maximum 5 accounts allowed per phone number",
      });
    }

    // Check if username already exists
    const existingUser = await UserModel.findOne({ username });

    if (existingUser) {
      // Generate 2 alternative usernames
      const suggestions: string[] = [];
      let attempts = 0;

      while (suggestions.length < 2 && attempts < 10) {
        const randomNum = Math.floor(10 + Math.random() * 90); // two-digit random number
        const alt1 = `${username}${randomNum}`;
        const alt2 = `${randomNum}_${username}`;
        const candidates = [alt1, alt2];

        for (const candidate of candidates) {
          const exists = await UserModel.exists({ username: candidate });
          if (!exists && !suggestions.includes(candidate)) {
            suggestions.push(candidate);
          }
          if (suggestions.length === 2) break;
        }

        attempts++;
      }

      const suggestionText = suggestions.join(", ");
      return res.status(409).json({
        success: false,
        message: `The name ${username} is already taken. Try: ${suggestionText}`,
      });
    }

    // Create user if username is available
    const user = await UserModel.create({ username, phone });

    return res.status(201).json({
      success: true,
      message: `User created successfully. You can register up to 5 usernames with this ${phone} number. ${
        5 - (phoneCount + 1)
      } slots are still available.`,
      result: user,
    });
  } catch (error) {
    console.error("Error creating user:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// suggest users
export const suggestUsers = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const lastUserId = req.query.lastUserId as string;
    const limit = parseInt(req.query.limit as string) || 10;

    const following = await FollowModel.find({
      userId: userId,
      isFollowing: true,
    }).select("followedUserId");

    const followingIds = following.map((follow) => follow.followedUserId);

    const query: any = {
      _id: {
        $nin: [...followingIds, userId],
      },
      isDeleted: false,
    };

    // If lastUserId is provided, get users after that ID
    if (lastUserId) {
      query._id.$lt = lastUserId;
    }

    const users = await UserModel.find(query)
      .sort({ _id: -1 }) // Sort by ID descending
      .limit(limit);

    return res.status(200).json({
      success: true,
      message: "Suggested users fetched successfully",
      count: users.length,
      lastUserId: users.length > 0 ? users[users.length - 1]._id : null,
      hasMore: users.length === limit,
      result: users.map((user) => ({
        _id: user._id,
        fullName: user.fullName,
        username: user.username ?? null,
        profilePicture: user.profilePicture ?? null,
      })),
    });
  } catch (error) {
    console.error("Error fetching suggested users:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error,
    });
  }
};

// get user subscription and badge details
export const getUserSubscriptionDetails = async (
  req: Request,
  res: Response
) => {
  try {
    const userId = (req as any).user.userId;

    const user = await UserModel.findById(userId)
      .populate("planId")
      .populate("subscriptionId")
      .lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Get badge information
    const badgeInfo = getBadgeInfo(user.userTier);

    // Get subscription details
    let subscriptionDetails = null;

    if (user.subscriptionId) {
      const subscription = await SubscriptionModel.findById(
        user.subscriptionId
      ).lean();

      if (subscription) {
        subscriptionDetails = {
          id: subscription._id,
          status: subscription.status,
          startDate: subscription.startDate,
          endDate: subscription.endDate,
          isActive: subscription.status === SubscriptionStatus.ACTIVE,
          planDetails: user.planId,
        };
      }
    }

    return res.status(200).json({
      success: true,
      message: "Subscription details fetched successfully",
      result: {
        userTier: user.userTier,
        badge: badgeInfo,
        subscription: subscriptionDetails,
        planId: user.planId,
      },
    });
  } catch (error) {
    console.error("Error fetching subscription details:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error,
    });
  }
};
