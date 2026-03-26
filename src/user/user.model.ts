import { prop, getModelForClass } from "@typegoose/typegoose";
import mongoose from "mongoose";

class Link {
  @prop({ default: null })
  url!: string;

  @prop({ default: null })
  title!: string;
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

class CloseFriend {
  @prop({ required: true, ref: "User", immutable: true })
  userId!: mongoose.Schema.Types.ObjectId;
}

export class User {
  @prop()
  fullName!: string;

  @prop({ required: true, trim: true, lowercase: true, unique: true })
  username!: string;

  @prop({ enum: ["male", "female", "other"], default: "male" })
  gender!: string;

  @prop({ enum: ["Golden", "Silver", "Blue", "Default"], default: "Default" })
  userTier!: string;

  @prop()
  DOB!: Date;

  @prop({ required: true, trim: true })
  phone!: string;

  @prop({ trim: true, lowercase: true, match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ })
  email?: string;

  @prop({ default: false })
  isDeleted!: boolean;

  @prop({ default: false })
  isPrivate!: boolean;

  @prop()
  profession?: string;

  @prop()
  profilePicture?: string;

  @prop()
  bio?: string;

  @prop({ type: () => [Link], default: [], _id: false })
  link!: Link[];

  @prop({ default: 0 })
  followersCount!: number;

  @prop({ default: 0 })
  followingCount!: number;

  @prop({ type: () => Location, _id: false })
  location?: Location;

  @prop({ default: null })
  fcmToken!: string;

  @prop()
  videoProfileUrl?: string;

  // close friends of user
  @prop({ type: () => [CloseFriend], default: [], _id: false })
  closeFriends!: CloseFriend[];

  // hide story from users
  @prop({ ref: "User", default: [] })
  hideStoryFrom!: mongoose.Schema.Types.ObjectId[];

  // muted stories of user
  @prop({ ref: "User", default: [] })
  mutedStoryUserIds!: mongoose.Schema.Types.ObjectId[];

  // mentioned users in bio
  @prop({ ref: "User", default: [] })
  mentionedUserIdsInBio!: mongoose.Schema.Types.ObjectId[];

  // Subscription and Plan tracking
  @prop({ ref: "Plan" })
  planId?: mongoose.Schema.Types.ObjectId;

  @prop({ ref: "Subscription" })
  subscriptionId?: mongoose.Schema.Types.ObjectId;

  // documents for verification
  @prop()
  verificationDocuments?: string[];
}

export const UserModel = getModelForClass(User, {
  schemaOptions: { timestamps: true },
  options: { allowMixed: 0 },
});
