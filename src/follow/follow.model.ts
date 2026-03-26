import { getModelForClass, index, prop } from "@typegoose/typegoose";
import mongoose from "mongoose";

@index({ userId: 1, followedUserId: 1, isFollowing: 1 })
@index({ followedUserId: 1, isFollowing: 1, createdAt: -1 })
@index({ userId: 1, isFollowing: 1, createdAt: -1 })
export class Follow {
  // user who is following
  @prop({ ref: "User", required: true, immutable: true })
  userId!: mongoose.Schema.Types.ObjectId;

  // user who is being followed
  @prop({ ref: "User", required: true, immutable: true })
  followedUserId!: mongoose.Schema.Types.ObjectId;

  @prop({ default: false, required: true })
  isFollowing!: boolean;
}

export const FollowModel = getModelForClass(Follow, {
  schemaOptions: { timestamps: true },
});
