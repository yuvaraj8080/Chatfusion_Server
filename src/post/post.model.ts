import { prop, getModelForClass, index } from "@typegoose/typegoose";
import mongoose from "mongoose";

enum MediaType {
  IMAGE = "image",
  VIDEO = "video",
  TEXT = "text",
  GIF = "gif",
}

class TaggedUser {
  @prop({ ref: "User", required: true, immutable: true })
  userId!: mongoose.Schema.Types.ObjectId;
}

class Location {
  @prop({ required: true, default: "Point" })
  type!: string;

  @prop({ required: true, index: "2dsphere" })
  coordinates!: number[];

  @prop({ required: true })
  formattedAddress!: string;

  @prop({ default: null })
  street?: string;

  @prop({ required: true })
  city!: string;

  @prop({ required: true })
  state!: string;

  @prop({ required: true })
  zipcode!: string;

  @prop({ required: true })
  country!: string;
}

class Hashtag {
  @prop({ ref: "Tag", required: true, immutable: true })
  tagId!: mongoose.Schema.Types.ObjectId;
}

class AdjustPreview {
  @prop({ enum: ["fill", "fit"], default: "fill" })
  fillType!: string;

  @prop({ enum: ["white", "black"], default: "white" })
  background!: string;
}

@index({ userId: 1, isDeleted: 1, createdAt: -1 })
@index({ mediaType: 1, isDeleted: 1 })
class Post {
  @prop({ ref: "User", required: true, immutable: true })
  userId!: mongoose.Schema.Types.ObjectId;

  @prop({ default: null })
  caption!: string;

  @prop({ required: true })
  mediaUrl!: string[];

  @prop({ required: true, enum: MediaType })
  mediaType!: MediaType;

  @prop({ default: 0 })
  likesCount!: number;

  @prop({ default: 0 })
  commentsCount!: number;

  @prop({ default: 0 })
  sharesCount!: number;

  @prop({ default: 0 })
  savesCount!: number;

  @prop({ default: false })
  isArchived!: boolean;

  @prop({ default: false })
  isDeleted!: boolean;

  // tagged users ids for @username
  @prop({ default: [], type: () => [TaggedUser], _id: false })
  taggedUsers!: TaggedUser[];

  @prop({ type: () => Location, required: true, _id: false })
  location!: Location;

  @prop({ default: 0 })
  engagementRatio!: number;

  @prop({ default: [], type: () => [Hashtag], _id: false })
  hashtags!: Hashtag[];

  @prop({ default: false })
  hideLikesCount!: boolean;

  @prop({ default: false })
  hideSharesCount!: boolean;

  @prop({ default: false })
  turnOffComments!: boolean;

  @prop({
    type: () => AdjustPreview,
    _id: false,
    default: { fillType: "fit", background: "white" },
  })
  adjustPreview!: AdjustPreview;

  @prop({ enum: ["default", "closeFriends"], default: "default" })
  audience!: string;

  @prop({ ref: "User", default: [] })
  collaborators!: mongoose.Schema.Types.ObjectId[];

  @prop()
  tapeThumbnailUrl?: string;
}

export const PostModel = getModelForClass(Post, {
  schemaOptions: { timestamps: true },
  options: { allowMixed: 0 },
});
