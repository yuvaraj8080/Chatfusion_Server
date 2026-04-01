import { Router } from "express";
import {
  fetchCreditHistory,
  phonePeUpdateTransactionStatus,
  updateTransactionStatusToFailed,
  createTransaction,
  updateTransactionStatus,
  approveTransaction,
  getTransactions,
} from "./transaction.controller";

const TransactionRouter = Router();

// api/transaction/getTransactions
TransactionRouter.get("/getTransactions", getTransactions);

// api/transaction/createTransaction
TransactionRouter.post("/createTransaction", createTransaction);

// api/transaction/updateTransactionStatus
TransactionRouter.post("/updateTransactionStatus", updateTransactionStatus);

// api/transaction/phonePeUpdateTransactionStatus
TransactionRouter.post(
  "/phonePeUpdateTransactionStatus",
  phonePeUpdateTransactionStatus
);

// api/transaction/fetchCreditHistory
TransactionRouter.get("/fetchCreditHistory", fetchCreditHistory);

// api/transaction/updateTransactionStatusToFailed
TransactionRouter.put(
  "/updateTransactionStatusToFailed/:transactionId",
  updateTransactionStatusToFailed
);

// api/transaction/approve/:transactionId
TransactionRouter.post("/approve/:transactionId", approveTransaction);

export default TransactionRouter;
