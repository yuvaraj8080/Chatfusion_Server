import { prop, getModelForClass, index } from "@typegoose/typegoose";
import mongoose from "mongoose";

class BlockedUserItem {
  @prop({ required: true, ref: "User", immutable: true })
  userId!: mongoose.Schema.Types.ObjectId;

  @prop({ required: true, immutable: true, default: Date.now })
  blockedAt!: Date;
}

@index({ userId: 1, "blockedUserIds.userId": 1 })
export class BlockedUser {
  @prop({ required: true, ref: "User", immutable: true })
  userId!: mongoose.Schema.Types.ObjectId;

  @prop({ required: true, type: () => [BlockedUserItem], _id: false })
  blockedUserIds!: BlockedUserItem[];
}

export const BlockedUserModel = getModelForClass(BlockedUser, {
  schemaOptions: { timestamps: true },
});
