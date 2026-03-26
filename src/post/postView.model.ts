import { prop, getModelForClass, index } from "@typegoose/typegoose";
import mongoose from "mongoose";

@index({ userId: 1, postId: 1 })
class PostView {
  @prop({ required: true, ref: "User", immutable: true })
  userId!: mongoose.Schema.Types.ObjectId;

  @prop({ required: true, ref: "Post", immutable: true })
  postId!: mongoose.Schema.Types.ObjectId;
}

export const PostViewModel = getModelForClass(PostView, {
  schemaOptions: { timestamps: true },
});
