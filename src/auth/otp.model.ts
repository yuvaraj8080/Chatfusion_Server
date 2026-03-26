import { getModelForClass, prop } from "@typegoose/typegoose";

export enum OTPStatus {
  SUCCESS = "SUCCESS",
  FAILED = "FAILED",
}

export class OTP {
  @prop({ required: true })
  mobile_number!: string;

  @prop({ required: true })
  requestId!: string;

  @prop({ required: true })
  otp!: string;

  @prop({ enum: OTPStatus, required: true })
  status!: OTPStatus;

  @prop({ default: false })
  isVerified!: boolean;

  @prop({ default: 0 })
  resendCount!: number;

  @prop()
  log?: string;
}

const OTPModel = getModelForClass(OTP, {
  schemaOptions: { timestamps: true },
});

export default OTPModel;
