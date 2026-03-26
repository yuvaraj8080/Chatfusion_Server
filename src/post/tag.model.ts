import { prop, getModelForClass } from "@typegoose/typegoose";

class Tag {
  @prop({ required: true, unique: true })
  name!: string;

  // number of posts using this tag
  @prop({ required: true, default: 1 })
  tagUsageCount!: number;
}

export const TagModel = getModelForClass(Tag, {
  schemaOptions: { timestamps: true },
});
