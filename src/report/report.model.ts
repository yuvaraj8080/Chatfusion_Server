import { getModelForClass, prop } from "@typegoose/typegoose";
import mongoose from "mongoose";

class Report {
  @prop({ ref: "User", required: true, immutable: true })
  userId!: mongoose.Schema.Types.ObjectId;

  @prop({ ref: "Post", immutable: true })
  postId?: mongoose.Schema.Types.ObjectId;

  @prop({ ref: "Story", immutable: true })
  storyId?: mongoose.Schema.Types.ObjectId;

  @prop({ ref: "User", immutable: true })
  profileId?: mongoose.Schema.Types.ObjectId;

  @prop({ required: true })
  content!: string;
}

export const ReportModel = getModelForClass(Report, {
  schemaOptions: { timestamps: true },
});
