import { getModelForClass, index, prop } from "@typegoose/typegoose";
import mongoose from "mongoose";

class Stories {
  @prop({ ref: "Story", immutable: true })
  storyId!: mongoose.Schema.Types.ObjectId;
}

@index({ userId: 1, storyTitle: 1, isDeleted: 1 })
@index({ userId: 1, isDeleted: 1 })
export class StoryHighlights {
  @prop({ ref: "User", required: true, immutable: true })
  userId!: mongoose.Schema.Types.ObjectId;

  @prop({ required: true })
  storyTitle!: string;

  // This is an array of storyIds
  @prop({ type: () => [Stories], required: true, _id: false })
  storyIds!: Stories[];

  @prop({ default: false })
  isDeleted!: boolean;

  @prop({ default: null })
  thumbnail!: string;
}

export const StoryHighlightsModel = getModelForClass(StoryHighlights, {
  schemaOptions: { timestamps: true },
});
