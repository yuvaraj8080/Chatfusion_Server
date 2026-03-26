import { prop, getModelForClass } from "@typegoose/typegoose";
import mongoose from "mongoose";

enum MediaType {
  IMAGE = "image",
  VIDEO = "video",
}

class Snap {
  @prop({ required: true, ref: "User" })
  userId!: mongoose.Schema.Types.ObjectId;

  @prop({ required: true, enum: MediaType })
  mediaType!: MediaType;

  @prop({ required: true })
  mediaUrl!: string;

  @prop({ default: 0 })
  viewCount!: number;

  // time of image snap to be visible in seconds
  @prop({ default: 0 })
  timerDuration?: number;
}

export const SnapModel = getModelForClass(Snap, {
  schemaOptions: { timestamps: true },
});
