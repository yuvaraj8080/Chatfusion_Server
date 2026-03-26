import { getModelForClass, prop } from "@typegoose/typegoose";
import mongoose from "mongoose";

class TimeSpent {
  @prop({ ref: "User", required: true, immutable: true })
  userId!: mongoose.Schema.Types.ObjectId;

  @prop({ default: Date.now })
  startTime!: Date;

  @prop()
  endTime!: Date;

  @prop({ default: 0 })
  duration!: number; // in seconds
}

export const TimeSpentModel = getModelForClass(TimeSpent, {
  schemaOptions: { timestamps: true },
});
