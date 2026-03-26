import { prop, getModelForClass, index } from "@typegoose/typegoose";
import mongoose from "mongoose";

export enum NotificationType {
  LIKE = "LIKE",
  COMMENT = "COMMENT",
  FOLLOW = "FOLLOW",
  FOLLOW_REQUEST = "FOLLOW_REQUEST",
  FOLLOW_BACK = "FOLLOW_BACK",
  GROUP_REQUEST = "GROUP_REQUEST",
  MESSAGE_REQUEST = "MESSAGE_REQUEST",
  COLLABORATION_REQUEST = "COLLABORATION_REQUEST",
  COLLABORATION_COLLECTION_REQUEST = "COLLABORATION_COLLECTION_REQUEST",
  SCREENSHOT_TAKEN = "SCREENSHOT_TAKEN",
  GROUP_MESSAGE = "GROUP_MESSAGE",
  SINGLE_MESSAGE = "SINGLE_MESSAGE",
  MENTION = "MENTION",
  STORY = "STORY",
  TAG = "TAG",
  POST = "POST",
}

@index({ receiverId: 1, isDeleted: 1, createdAt: -1 })
@index({ receiverId: 1, isRead: 1, isDeleted: 1 })
export class Notification {
  @prop({ required: true, ref: "User", immutable: true })
  senderId!: mongoose.Schema.Types.ObjectId;

  @prop({ required: true, ref: "User", immutable: true })
  receiverId!: mongoose.Schema.Types.ObjectId;

  @prop({ required: true, enum: NotificationType })
  type!: NotificationType;

  @prop({ required: true })
  title!: string;

  @prop({ required: true })
  message!: string;

  @prop({ default: true })
  isActive!: boolean;

  @prop({ default: false })
  isDeleted!: boolean;

  @prop({ default: false })
  isRead!: boolean;

  // targetId is the id of the target object
  @prop({ required: true, immutable: true })
  targetId!: mongoose.Schema.Types.ObjectId;

  @prop()
  mediaType!: string;

  // mediaUrl is the url of the image or video to be displayed in the notification
  @prop()
  mediaUrl!: string;
}

export const NotificationModel = getModelForClass(Notification, {
  schemaOptions: { timestamps: true },
});
