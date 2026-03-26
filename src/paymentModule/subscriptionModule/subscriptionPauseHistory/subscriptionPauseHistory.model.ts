import { getModelForClass, prop } from "@typegoose/typegoose";
import mongoose from "mongoose";

export class SubscriptionPauseHistory {
  readonly updatedAt: Date;

  @prop({ ref: "Subscription", required: true })
  subscriptionId: mongoose.Schema.Types.ObjectId;

  @prop({ ref: "User" })
  user?: mongoose.Schema.Types.ObjectId;

  @prop({ required: true })
  pauseStartDate: Date;

  @prop()
  pauseEndDate?: Date;

  @prop({ default: true })
  isActive: boolean;

  @prop({ default: false })
  isDeleted: boolean;
}

export const SubscriptionPauseHistoryModel = getModelForClass(
  SubscriptionPauseHistory,
  { schemaOptions: { timestamps: true } }
);
