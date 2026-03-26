import { Router } from "express";
import {
  fetchCreditHistory,
  phonePeUpdateTransactionStatus,
  updateTransactionStatusToFailed,
  createTransaction,
  updateTransactionStatus,
} from "./transaction.controller";

const TransactionRouter = Router();

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

export default TransactionRouter;
