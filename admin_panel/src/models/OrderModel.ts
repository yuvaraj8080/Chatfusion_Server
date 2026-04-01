export interface Order {
  _id: string;
  user: string;
  totalAmount: number;
  cashAmount: number;
  transactionStatus: string;
  transactionFor: string;
  rzpOrderId: string;
  subscriptionId: string;
  planId: string;
  createdAt: string;
  updatedAt: string;
  __v: number;
  paidSuccesOn: string;
  isApproved?: boolean; // We will use this to manage the tick / approval state
}
