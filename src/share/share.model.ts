import { getModelForClass, index, prop } from "@typegoose/typegoose";
import mongoose from "mongoose";

@index({ userId: 1, postId: 1 }, { unique: true })
class Share {
  @prop({ ref: "User", required: true, immutable: true })
  userId!: mongoose.Schema.Types.ObjectId;

  @prop({ ref: "Post", required: true, immutable: true })
  postId!: mongoose.Schema.Types.ObjectId;

  @prop()
  caption?: string;
}

export const ShareModel = getModelForClass(Share, {
  schemaOptions: { timestamps: true },
});
