import { getModelForClass, prop } from "@typegoose/typegoose";

export class Plan {
  @prop({ required: true, unique: true })
  name!: string;

  @prop()
  description: string;

  @prop({ required: true })
  price!: string;

  @prop({ required: true, unique: true })
  rzpPlanId!: string;

  @prop({ required: true })
  durationDays!: number;

  @prop()
  access?: string[];

  @prop()
  content?: string[];

  @prop({ enum: ["Golden", "Silver", "Blue", "Default"], default: "Default" })
  userTier!: string;

  @prop({ default: true })
  isActive!: boolean;

  @prop({ default: false })
  isDeleted!: boolean;
}

export const PlanModel = getModelForClass(Plan, {
  schemaOptions: { timestamps: true },
  options: { allowMixed: 0 },
});
