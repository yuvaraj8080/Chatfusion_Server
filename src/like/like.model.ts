import { prop, getModelForClass, index } from "@typegoose/typegoose";
import mongoose from "mongoose";

@index({ userId: 1, postId: 1, isDeleted: 1 })
@index({ userId: 1, commentId: 1, isDeleted: 1 })
@index({ userId: 1, storyId: 1, isDeleted: 1 })
class Like {
  @prop({ ref: "User", required: true, immutable: true })
  userId!: mongoose.Schema.Types.ObjectId;

  @prop({ ref: "Post", default: null, immutable: true })
  postId!: mongoose.Schema.Types.ObjectId;

  @prop({ ref: "Comment", default: null, immutable: true })
  commentId!: mongoose.Schema.Types.ObjectId;

  @prop({ ref: "Story", default: null, immutable: true })
  storyId!: mongoose.Schema.Types.ObjectId;

  @prop({ default: false })
  isDeleted!: boolean;
}

export const LikeModel = getModelForClass(Like, {
  schemaOptions: { timestamps: true },
});
