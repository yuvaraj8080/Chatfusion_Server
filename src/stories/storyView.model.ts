import { prop, getModelForClass, index } from "@typegoose/typegoose";
import mongoose from "mongoose";

@index({ userId: 1, storyId: 1 })
class StoryView {
  @prop({ required: true, ref: "User", immutable: true })
  userId!: mongoose.Schema.Types.ObjectId;

  @prop({ required: true, ref: "Story", immutable: true })
  storyId!: mongoose.Schema.Types.ObjectId;

  @prop({ required: true, default: Date.now, immutable: true })
  viewedAt!: Date;

  @prop({ default: false })
  hasTakenScreenshot!: boolean;
}

export const StoryViewModel = getModelForClass(StoryView, {
  schemaOptions: { timestamps: true },
});
