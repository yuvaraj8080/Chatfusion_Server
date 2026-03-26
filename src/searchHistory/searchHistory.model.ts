import { getModelForClass, prop, index } from "@typegoose/typegoose";
import mongoose from "mongoose";

class SearchItem {
  // What the user typed in the search bar
  @prop({ required: true })
  searchedText!: string;

  // The profile user tapped on
  @prop({ required: true, ref: "User", immutable: true })
  searchedUserId!: mongoose.Schema.Types.ObjectId;

  @prop({ required: true, immutable: true, default: Date.now })
  searchedAt!: Date;
}

@index({ userId: 1, isDeleted: 1 })
export class SearchHistory {
  @prop({ ref: "User", required: true, immutable: true })
  userId!: mongoose.Schema.Types.ObjectId;

  @prop({ type: () => [SearchItem], required: true, _id: false })
  queries!: SearchItem[];

  @prop({ default: false })
  isDeleted!: boolean;
}

export const SearchHistoryModel = getModelForClass(SearchHistory, {
  schemaOptions: { timestamps: true },
});
