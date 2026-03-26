import { prop, getModelForClass } from "@typegoose/typegoose";
import mongoose from "mongoose";

enum NotificationSettingType {
  EVERYONE = "everyone",
  FOLLOWEES = "followees",
  NO_ONE = "no_one",
}

// post notification settings
class PostNotificationSettings {
  @prop({ enum: NotificationSettingType, default: "everyone" })
  likes!: string;

  @prop({ enum: NotificationSettingType, default: "everyone" })
  comments!: string;

  @prop({ enum: NotificationSettingType, default: "everyone" })
  likesAndCommentsOnPhotosOfYou!: string;

  @prop({ enum: NotificationSettingType, default: "everyone" })
  firstPosts!: string;

  @prop({ enum: NotificationSettingType, default: "everyone" })
  photosOfYou!: string;

  @prop({ enum: NotificationSettingType, default: "everyone" })
  collabartionInvitations!: string;
}

// story notification settings
class StoryNotificationSettings {
  @prop({ enum: NotificationSettingType, default: "everyone" })
  likes!: string;

  @prop({ enum: NotificationSettingType, default: "everyone" })
  comments!: string;

  @prop({ enum: NotificationSettingType, default: "everyone" })
  firstStory!: string;

  @prop({ enum: NotificationSettingType, default: "everyone" })
  mentions!: string;

  // can be shared by whom which are mentioned in the post
  @prop({ default: false })
  canShareWhoAreMentionedInStory!: boolean;

  // stories can be shared in message
  @prop({ default: false })
  canShareStoriesInMessage!: boolean;
}

// following and followers notification settings
class FollowingAndFollowersNotificationSettings {
  @prop({ enum: ["on", "off"], default: "on" })
  followRequests!: string;

  @prop({ enum: ["on", "off"], default: "on" })
  acceptedFollowRequests!: string;

  @prop({ enum: ["on", "off"], default: "on" })
  accountSuggestions!: string;

  @prop({ enum: ["on", "off"], default: "on" })
  mentionsInBio!: string;
}

// message notification settings
class MessageNotificationSettings {
  @prop({ enum: ["on", "off"], default: "on" })
  messageRequests!: string;

  @prop({ enum: ["on", "off"], default: "on" })
  messageFromIndividualsAndGroupChats!: string;

  @prop({ enum: ["on", "off"], default: "on" })
  messageReminders!: string;

  @prop({ enum: ["on", "off"], default: "on" })
  screenShotNotification!: string;

  @prop({ enum: ["on", "off"], default: "on" })
  groupRequest!: string;
}

// notification settings
class NotificationSettings {
  @prop({ required: true, ref: "User", immutable: true, unique: true })
  userId!: mongoose.Schema.Types.ObjectId;

  @prop({ default: false })
  muteAllNotifications!: boolean;

  @prop({ type: () => PostNotificationSettings, _id: false, default: {} })
  postNotifications!: PostNotificationSettings;

  @prop({ type: () => StoryNotificationSettings, _id: false, default: {} })
  storyNotifications!: StoryNotificationSettings;

  @prop({
    type: () => FollowingAndFollowersNotificationSettings,
    _id: false,
    default: {},
  })
  followingAndFollowersNotifications!: FollowingAndFollowersNotificationSettings;

  @prop({ type: () => MessageNotificationSettings, _id: false, default: {} })
  messageNotifications!: MessageNotificationSettings;
}

export const NotificationSettingsModel = getModelForClass(
  NotificationSettings,
  { schemaOptions: { timestamps: true } }
);
