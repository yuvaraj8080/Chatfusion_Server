import { prop, getModelForClass, index } from "@typegoose/typegoose";
import mongoose from "mongoose";

class PostIds {
  @prop({ ref: "Post", required: true, immutable: true })
  postId!: mongoose.Schema.Types.ObjectId;
}

@index({ userId: 1, collectionName: 1, isDeleted: 1 })
@index({ userId: 1, "postIds.postId": 1, isDeleted: 1 })
export class SavePost {
  // collection name
  @prop({ default: "All Posts", required: true })
  collectionName!: string;

  @prop({ ref: "User", required: true, immutable: true })
  userId!: mongoose.Schema.Types.ObjectId;

  // array of post ids
  @prop({ required: true, type: () => [PostIds], _id: false })
  postIds!: PostIds[];

  @prop({ default: false })
  isDeleted!: boolean;

  @prop({ ref: "User", default: [] })
  collaborators!: mongoose.Schema.Types.ObjectId[];
}

export const SavePostModel = getModelForClass(SavePost, {
  schemaOptions: { timestamps: true },
});
