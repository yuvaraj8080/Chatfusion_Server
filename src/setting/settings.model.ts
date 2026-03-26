import mongoose from "mongoose";
import { getModelForClass, prop } from "@typegoose/typegoose";

export class Settings {
  @prop({ required: true, ref: "User", immutable: true, unique: true })
  userId!: mongoose.Schema.Types.ObjectId;

  // intersted posts
  @prop({ ref: "Post", default: [] })
  interestedPosts!: mongoose.Schema.Types.ObjectId[];

  // not interested posts
  @prop({ ref: "Post", default: [] })
  notInterestedPosts!: mongoose.Schema.Types.ObjectId[];

  // Who can tag you in post
  @prop({ enum: ["everyone", "followees", "no_one"], default: "everyone" })
  whoCanTag!: string;

  // Who can mention you
  @prop({ enum: ["everyone", "followees", "no_one"], default: "everyone" })
  whoCanMention!: string;

  // manually approve tags (if true, then tags will be approved manually by the user)
  @prop({ default: false })
  manuallyApproveTags!: boolean;

  // posts that are not approved by the user (if manuallyApproveTags is true, then this will be used to store the posts that are not approved by the user)
  @prop({ ref: "Post", default: [] })
  notApprovedPosts!: mongoose.Schema.Types.ObjectId[];

  @prop({ ref: "Post", default: [] })
  hiddenTaggedPosts!: mongoose.Schema.Types.ObjectId[];

  // pinned posts on profile page
  @prop({ ref: "Post", default: [] })
  pinnedPosts!: mongoose.Schema.Types.ObjectId[];

  // pinned chats of the user
  @prop({ ref: "Chat", default: [] })
  pinnedChats!: mongoose.Schema.Types.ObjectId[];

  // muted chats of the user
  @prop({ ref: "Chat", default: [] })
  mutedChats!: mongoose.Schema.Types.ObjectId[];
}

export const SettingsModel = getModelForClass(Settings, {
  schemaOptions: { timestamps: true },
});
