import { getModelForClass, prop } from "@typegoose/typegoose";
import mongoose from "mongoose";

export enum TransactionType {
  CREDIT = "Credit",
  DEBIT = "Debit",
}

export enum TransactionStatus {
  SUCCESS = "Success",
  PENDING = "Pending",
  FAILED = "Failed",
  REFUNDED = "Refunded",
}

// export enum TransactionMedium {
//     WALLET = "Wallet",
//     CASH = "Cash",
//     HYBRID = "Hybrid"
// }

export enum TransactionFor {
  GOLDEN = "GOLDEN",
  SILVER = "SILVER",
  BLUE = "BLUE",
}

export class Transaction {
  readonly updatedAt: Date;

  @prop({ ref: "User" })
  user: mongoose.Schema.Types.ObjectId;

  @prop()
  rechargeAmount: number;

  @prop()
  totalAmount: number;

  @prop()
  cashAmount: number;

  @prop()
  walletAmount: number;

  @prop()
  walletBalance: number;

  @prop({ enum: TransactionType })
  transactionType: TransactionType;

  @prop({ enum: TransactionStatus })
  transactionStatus: TransactionStatus;

  // @prop({ enum: TransactionMedium })
  // transactionMedium: TransactionMedium;

  @prop({ enum: TransactionFor })
  transactionFor: TransactionFor;

  @prop()
  phonePeTransactionId: string;

  @prop()
  paymentInstrument: string;

  @prop()
  rzpOrderId: string;

  @prop()
  rzpPaymentId: string;

  @prop()
  rzpRefundId: string;

  @prop()
  paidSuccesOn: Date;

  // new parameters
  @prop()
  slug: string; // complete url from workshop.9andBeyond.com with query/utm parameter

  @prop()
  source: string;

  @prop()
  campaign: string;

  @prop()
  medium: string;

  @prop()
  url: string;

  @prop()
  email: string;

  @prop()
  phone: string;

  @prop()
  userIp: string;

  @prop({ ref: "Subscription" })
  subscriptionId: mongoose.Schema.Types.ObjectId;

  @prop()
  rzpSubscriptionId: string;

  @prop({ ref: "Plan" })
  planId: mongoose.Schema.Types.ObjectId;

  @prop()
  totalCount: number;

  @prop()
  remainingCount: number;

  @prop()
  rzp_source: string;

  @prop()
  paidCount: number;

  @prop()
  pixelId: string;

  @prop({ default: false })
  isApproved: boolean;
}

export const TransactionModel = getModelForClass(Transaction, {
  schemaOptions: { timestamps: true },
});
