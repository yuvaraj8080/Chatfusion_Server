import { Request, Response } from "express";
import { UserModel } from "../../user/user.model";

// update hide story from list
export const updateHideStoryFromList = async (req: Request, res: Response) => {
  try {
    const { userId } = (req as any).user;
    const { hideStoryFrom } = req.body;

    if (!hideStoryFrom) {
      return res.status(400).json({
        success: false,
        message: "Hide story from list is required",
      });
    }

    const user = await UserModel.findByIdAndUpdate(
      userId,
      {
        $set: { hideStoryFrom: hideStoryFrom },
      },
      { new: true }
    )
      .select("hideStoryFrom")
      .populate("hideStoryFrom", "username fullName profilePicture")
      .lean();

    return res.status(200).json({
      success: user ? true : false,
      message: user
        ? "Hide story from list updated successfully"
        : "Failed to update hide story from list",
      result: user ? user?.hideStoryFrom : null,
    });
  } catch (error) {
    console.log("Error in addUserToHideStory", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error,
    });
  }
};

// get hide story from list
export const getHideStoryFromList = async (req: Request, res: Response) => {
  try {
    const { userId } = (req as any).user;

    const user = await UserModel.findById(userId)
      .select("hideStoryFrom")
      .populate("hideStoryFrom", "username fullName profilePicture")
      .lean();

    return res.status(200).json({
      success: user ? true : false,
      message: user
        ? "Hide story from list fetched successfully"
        : "Failed to fetch hide story from list",
      result: user ? user?.hideStoryFrom : null,
    });
  } catch (error) {
    console.log("Error in getHideStoryFromList", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error,
    });
  }
};
