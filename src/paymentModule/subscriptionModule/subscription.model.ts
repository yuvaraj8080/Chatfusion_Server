import { getModelForClass, prop } from "@typegoose/typegoose";
import mongoose from "mongoose";

export enum SubscriptionStatus {
  ACTIVE = "ACTIVE",
  INACTIVE = "INACTIVE",
  CANCELLED = "CANCELLED",
  RESUMED = "RESUMED",
  PENDING = "PENDING",
  PAUSED = "PAUSED",
}

export class Subscription {
  @prop({ ref: "User" })
  user?: mongoose.Schema.Types.ObjectId;

  @prop({ ref: "Plan" })
  planId: mongoose.Schema.Types.ObjectId;

  @prop()
  rzpSubscriptionId: string;

  @prop()
  rzpPlanId: string;

  @prop()
  rzpStatus: string;

  @prop()
  startDate?: Date;

  @prop()
  endDate?: Date;

  @prop({ enum: SubscriptionStatus })
  status: SubscriptionStatus;

  @prop()
  pausedAt?: Date;

  @prop()
  pauseStartDate?: Date; // When the pause period starts

  @prop()
  pauseEndDate?: Date; // When the pause period ends

  @prop()
  nextBillingPaused: boolean;

  @prop({ default: true })
  isActive: boolean;

  @prop({ default: false })
  isDeleted: boolean;

  @prop()
  tracking_info?: any; // Will store UTM params and pixel ID
}

export const SubscriptionModel = getModelForClass(Subscription, {
  schemaOptions: { timestamps: true },
  options: { allowMixed: 0 },
});
