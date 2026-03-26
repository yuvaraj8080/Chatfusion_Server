import { UserModel } from "../../user/user.model";
import { Request, Response } from "express";

// add users to close friends list
export const addUsersToCloseFriends = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { userIds } = req.body;

    const userIdsObjectArray = userIds.map((id: string) => ({ userId: id }));

    const user = await UserModel.findByIdAndUpdate(
      userId,
      {
        $addToSet: { closeFriends: userIdsObjectArray },
      },
      { new: true }
    ).populate("closeFriends.userId", "fullName username profilePicture");

    return res.status(200).json({
      success: user ? true : false,
      message: user
        ? "Close friends list updated successfully"
        : "Failed to update close friends list",
      result: user ? user.closeFriends : null,
    });
  } catch (error) {
    console.error("Error adding user to close friends:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error,
    });
  }
};

// remove users from close friends list
export const removeUsersFromCloseFriends = async (
  req: Request,
  res: Response
) => {
  try {
    const userId = (req as any).user.userId;
    const { userIds } = req.body;

    const user = await UserModel.findByIdAndUpdate(
      userId,
      {
        $pull: { closeFriends: { userId: { $in: userIds } } },
      },
      { new: true }
    ).populate("closeFriends.userId", "fullName username profilePicture");

    return res.status(200).json({
      success: user ? true : false,
      message: user
        ? "Close friends list updated successfully"
        : "Failed to update close friends list",
      result: user ? user.closeFriends : null,
    });
  } catch (error) {
    console.error("Error removing user from close friends:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error,
    });
  }
};

// get close friends list
export const getCloseFriendsList = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;

    const user = await UserModel.findById(userId)
      .select("closeFriends")
      .populate("closeFriends.userId", "fullName username profilePicture")
      .lean();

    return res.status(200).json({
      success: user ? true : false,
      message: user
        ? "Close friends list fetched successfully"
        : "Failed to fetch close friends list",
      result: user ? user.closeFriends : null,
    });
  } catch (error) {
    console.error("Error getting close friends list:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error,
    });
  }
};
