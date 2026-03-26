import { prop, getModelForClass, index } from "@typegoose/typegoose";
import mongoose from "mongoose";

export enum ContentType {
  IMG = "image",
  VIDEO = "video",
  TXT = "text",
  AUDIO = "audio",
  STORY = "story",
  SNAP = "snap",
  POST = "post",
  SSCALBACK = "screenshot_callback",
  USERPROFILE = "profile",
  TAPE = "tape",
}

class MessageContent {
  @prop({ enum: ContentType, required: true })
  type!: ContentType;

  @prop({ default: null })
  text!: string;

  @prop({ default: null })
  audioDuration!: string;

  @prop({ default: null })
  videoThumbnail!: string;

  // url of the media file
  @prop({ default: null })
  mediaUrl!: string;

  // caption of the media file
  @prop({ default: null })
  caption!: string;

  @prop({ ref: "Story", default: null })
  storyId!: mongoose.Schema.Types.ObjectId;

  @prop({ ref: "Snap", default: null })
  snapId!: mongoose.Schema.Types.ObjectId;

  @prop({ ref: "Post", default: null })
  postId!: mongoose.Schema.Types.ObjectId;

  @prop({ ref: "User", default: null })
  userProfileId!: mongoose.Schema.Types.ObjectId;
}

class ViewedBy {
  @prop({ ref: "User", required: true, immutable: true })
  userId!: mongoose.Schema.Types.ObjectId;

  @prop({ default: Date.now })
  viewedAt!: Date;
}

class DeletedBy {
  @prop({ ref: "User", required: true, immutable: true })
  userId!: mongoose.Schema.Types.ObjectId;

  @prop({ default: Date.now })
  deletedAt!: Date;
}

class MentionedUser {
  @prop({ ref: "User", required: true, immutable: true })
  userId!: mongoose.Schema.Types.ObjectId;
}

@index({ chatId: 1, isDeleted: 1 })
export class Message {
  @prop({ ref: "User", required: true, immutable: true })
  sentBy!: mongoose.Schema.Types.ObjectId;

  @prop({ ref: "User", immutable: true })
  receiver!: mongoose.Schema.Types.ObjectId;

  @prop({ type: () => [DeletedBy], _id: false, default: [] })
  deletedBy!: DeletedBy[];

  @prop({ ref: "Chat", required: true, immutable: true })
  chatId!: mongoose.Schema.Types.ObjectId;

  @prop({ type: () => MessageContent, required: true, _id: false })
  content!: MessageContent;

  @prop({ type: () => [ViewedBy], _id: false, default: [] })
  viewedBy!: ViewedBy[];

  @prop({ default: false })
  isViewed!: boolean;

  @prop({ default: true })
  isActive!: boolean;

  @prop({ default: false })
  isDeleted!: boolean;

  // message id of the message that this message is replying to
  @prop({ ref: "Message", default: null })
  replyTo!: mongoose.Schema.Types.ObjectId;

  // users mentioned in the message
  @prop({ type: () => [MentionedUser], _id: false, default: [] })
  mentionedUsers!: MentionedUser[];

  @prop({ required: true, enum: ["counter", "infinite"], default: "infinite" })
  viewType!: string;

  @prop({ default: 0 })
  viewCount!: number;

  @prop({ default: 1, min: 1, max: 10 })
  viewLimit!: number;

  @prop({ default: 0 })
  timerDuration!: number; // seconds

  @prop({ default: false })
  isOneTimeViewMessage!: boolean;

  @prop({ default: false })
  isExpired!: boolean; // true if counter limit reached OR timer ended
}

export const MessageModel = getModelForClass(Message, {
  schemaOptions: { timestamps: true },
});
