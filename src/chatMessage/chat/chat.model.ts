import { prop, getModelForClass, index } from "@typegoose/typegoose";
import mongoose from "mongoose";

export enum ChatType {
  SINGLE = "single",
  GROUP = "group",
}

class Participant {
  @prop({ ref: "User", required: true, immutable: true })
  userId!: mongoose.Schema.Types.ObjectId;

  @prop({ default: false })
  hasSeen!: boolean;

  @prop({ default: false })
  hasRequestAccepted!: boolean;
}

class DeletedBy {
  @prop({ ref: "User", required: true, immutable: true })
  userId!: mongoose.Schema.Types.ObjectId;

  @prop({ default: Date.now })
  deletedAt!: Date;
}

@index({ type: 1, isDeleted: 1, "participants.userId": 1 })
@index({ "participants.userId": 1, isDeleted: 1, updatedAt: 1 })
@index({ "deletedBy.userId": 1, isDeleted: 1, updatedAt: 1 })
export class Chat {
  @prop({ default: null })
  groupName!: string;

  @prop({ enum: ChatType, required: true })
  type!: ChatType;

  @prop({ ref: "User", required: true, immutable: true })
  createdBy!: mongoose.Schema.Types.ObjectId;

  @prop({ type: () => [Participant], _id: false, required: true })
  participants!: Participant[];

  @prop({ type: () => [DeletedBy], _id: false, default: [] })
  deletedBy!: DeletedBy[];

  @prop({ default: false })
  isDeleted!: boolean;

  @prop({ default: 0 })
  snapStreak!: number;

  @prop({ default: null })
  lastSnapStreakDate!: Date;
}

export const ChatModel = getModelForClass(Chat, {
  schemaOptions: { timestamps: true },
});
