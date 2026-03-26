import { SnapModel } from "./snap.model";
import { Request, Response } from "express";
import { MessageModel } from "../message/message.model";

// create a snap
export const createSnap = async (req: Request, res: Response) => {
  try {
    const { mediaType, mediaUrl, timerDuration } = req.body;
    const { userId } = (req as any).user;

    if (!mediaType || !mediaUrl) {
      return res
        .status(400)
        .json({ success: false, message: "Missing required fields" });
    }

    const snap = await SnapModel.create({
      userId,
      mediaType,
      mediaUrl,
      timerDuration,
    });

    return res.status(201).json({
      success: snap ? true : false,
      message: snap ? "Snap created successfully" : "Error creating snap",
      data: snap ? snap : null,
    });
  } catch (error) {
    console.log("Error creating snap", error);
    return res
      .status(500)
      .json({ success: false, message: "Error creating snap", error: error });
  }
};

// view a snap
export const viewSnap = async (req: Request, res: Response) => {
  try {
    const { snapId, chatId, messageId } = req.body;
    const seenBy = (req as any).user.userId;

    const [snap, _] = await Promise.all([
      // update snap view count
      SnapModel.findByIdAndUpdate(snapId, {
        $inc: { viewCount: 1 },
      }),

      // update message viewed by
      MessageModel.updateOne(
        {
          _id: messageId,
          chatId,
          "viewedBy.userId": { $ne: seenBy },
        },
        {
          $push: { viewedBy: { userId: seenBy } },
        }
      ),
    ]);

    if (!snap) {
      return res.status(404).json({
        success: false,
        message: "Snap not found or expired",
      });
    }

    return res.status(200).json({
      success: snap ? true : false,
      message: snap ? "Snap viewed successfully" : "Error viewing snap",
    });
  } catch (error) {
    console.log("Error viewing snap", error);
    return res
      .status(500)
      .json({ success: false, message: "Error viewing snap", error: error });
  }
};
