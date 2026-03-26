import { prop, getModelForClass, index } from "@typegoose/typegoose";
import mongoose from "mongoose";

enum MediaType {
  IMAGE = "image",
  VIDEO = "video",
  TEXT = "text",
  GIF = "gif",
}

enum StickerType {
  LOCATION = "location",
  MENTION = "mention",
  HASHTAG = "hashtag",
  TEXT = "text",
  LINK = "link",
  PHOTO = "photo",
  EMOJI = "emoji",
}

class StickerData {
  // auto generated id for sticker
  @prop({ required: true })
  id!: string;

  // for location
  @prop()
  name?: string;

  @prop()
  latitude?: number;

  @prop()
  longitude?: number;

  // for mention
  @prop()
  username?: string;

  @prop()
  userId?: string;

  // for hashtag & text
  @prop()
  text?: string;

  @prop()
  style?: string;

  // for link
  @prop()
  url?: string;

  // for image
  @prop()
  mediaUrl?: string;

  // for photo sticker
  @prop({ enum: ["circle", "square", "rounded-square"] })
  shape?: string;
}

class Sticker {
  @prop({ enum: StickerType, required: true })
  type!: StickerType;

  @prop({ required: true })
  x!: number;

  @prop({ required: true })
  y!: number;

  @prop({ required: true })
  scale!: number;

  @prop({ required: true })
  rotation!: number;

  @prop({ _id: false })
  data!: StickerData;
}

class Mention {
  @prop({ ref: "User", required: true, immutable: true })
  userId!: mongoose.Schema.Types.ObjectId;
}

class SharedPost {
  @prop({ ref: "Post", required: true, immutable: true })
  postId!: mongoose.Schema.Types.ObjectId;

  @prop({ default: false })
  isCaptionVisible!: boolean;

  // for sticker position
  @prop({ required: true })
  x!: number;

  @prop({ required: true })
  y!: number;
}

class StoryReshared {
  @prop({ ref: "User", required: true, immutable: true })
  userId!: mongoose.Schema.Types.ObjectId;

  @prop({ required: true })
  username!: string;

  @prop({ required: true })
  profilePicture!: string;
}

@index({ userId: 1, isDeleted: 1, expiresAt: 1 })
export class Story {
  @prop({ required: true, ref: "User", immutable: true })
  userId!: mongoose.Schema.Types.ObjectId;

  @prop({ enum: MediaType })
  mediaType!: MediaType;

  @prop()
  mediaUrl!: string;

  // for shared post
  @prop({ type: () => SharedPost, _id: false })
  sharedPost?: SharedPost;

  @prop({ default: false })
  isArchived!: boolean;

  @prop({ default: false })
  isDeleted!: boolean;

  @prop({ default: () => new Date(Date.now() + 24 * 60 * 60 * 1000) })
  expiresAt!: Date;

  @prop({ type: () => [Sticker], default: [], _id: false })
  stickers!: Sticker[];

  @prop({ default: false })
  isCloseFriendsOnly!: boolean;

  // mention user ids for @username
  @prop({ default: [], type: () => [Mention], _id: false })
  mentionUserIds!: Mention[];

  @prop({ default: false })
  turnOffComments!: boolean;

  @prop({ type: () => StoryReshared, _id: false })
  storyReshared?: StoryReshared;
}

export const StoryModel = getModelForClass(Story, {
  schemaOptions: { timestamps: true },
});
