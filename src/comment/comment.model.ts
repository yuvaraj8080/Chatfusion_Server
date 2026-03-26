import { prop, getModelForClass, index } from "@typegoose/typegoose";
import mongoose from "mongoose";

class Mention {
  @prop({ ref: "User", required: true, immutable: true })
  userId!: mongoose.Schema.Types.ObjectId;
}

@index({ postId: 1, parentCommentId: 1, isDeleted: 1, createdAt: -1 })
@index({ parentCommentId: 1, isDeleted: 1, createdAt: -1 })
@index({ storyId: 1, isDeleted: 1, createdAt: -1 })
class Comment {
  @prop({ ref: "User", required: true, immutable: true })
  userId!: mongoose.Schema.Types.ObjectId;

  @prop({ ref: "Post", immutable: true })
  postId!: mongoose.Schema.Types.ObjectId;

  @prop({ ref: "Story", immutable: true })
  storyId!: mongoose.Schema.Types.ObjectId;

  @prop({ required: true })
  content!: string;

  // mention user ids for @username
  @prop({ default: [], type: () => [Mention], _id: false })
  mentionUserIds!: Mention[];

  // parent comment id for nested comments or replies
  @prop({ ref: "Comment", default: null, immutable: true })
  parentCommentId?: mongoose.Schema.Types.ObjectId;

  @prop({ default: 0 })
  likesCount!: number;

  @prop({ default: 0 })
  repliesCount!: number;

  @prop({ default: false })
  isDeleted!: boolean;
}

export const CommentModel = getModelForClass(Comment, {
  schemaOptions: { timestamps: true },
});
