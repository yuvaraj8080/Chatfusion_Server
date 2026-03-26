import { Request, Response } from "express";
import { UserModel } from "../../user/user.model";

// toggle account privacy
export const toggleAccountPrivacy = async (req: Request, res: Response) => {
  try {
    const { userId } = (req as any).user;
    const user = await UserModel.findById(userId, "isPrivate");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    user.isPrivate = !user.isPrivate;
    await user.save();

    return res.status(200).json({
      success: true,
      message: "Account privacy toggled successfully",
      result: {
        isPrivate: user.isPrivate,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error,
    });
  }
};

// get account privacy settings
export const getAccountPrivacySettings = async (
  req: Request,
  res: Response
) => {
  try {
    const { userId } = (req as any).user;
    const user = await UserModel.findById(userId, "isPrivate").lean();

    return res.status(200).json({
      success: user ? true : false,
      message: user
        ? "Account privacy settings fetched successfully"
        : "User not found",
      result: {
        isPrivate: user?.isPrivate || false,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error,
    });
  }
};
