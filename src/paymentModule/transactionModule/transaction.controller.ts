import { Request, Response, NextFunction } from "express";
import { UserModel } from "../../user/user.model";
import { rzp_instance } from "../../config";
import Razorpay from "razorpay";
import {
  TransactionFor,
  TransactionModel,
  TransactionStatus,
  TransactionType,
} from "./transaction.model";
const axios = require("axios").default;
import crypto from "crypto";
import {
  SubscriptionModel,
  SubscriptionStatus,
} from "../subscriptionModule/subscription.model";
const cron = require("node-cron");
import FormData from "form-data";
import { ObjectId } from "mongodb";

let transactionCronRunning = false;

// Function to get the current Unix timestamp in seconds
const getUnixTimeStamp = () => {
  const currentDate = new Date();
  const unixTimestamp = Math.floor(currentDate.getTime() / 1000);
  return unixTimestamp;
};

const hashEmail = (email: string): string => {
  const normalizedEmail = email.trim().toLowerCase();
  return crypto.createHash("sha256").update(normalizedEmail).digest("hex");
};

const hashPhone = (phone: string): string => {
  // Remove symbols, letters, and leading zeros
  const digitsOnly = phone.replace(/\D/g, "").replace(/^0+/, "");
  return crypto.createHash("sha256").update(digitsOnly).digest("hex");
};

// export const facebookApiCallOnSuccessfulPayment = async (
//   orderDetails: any,
//   userAgent: string
// ) => {
//   console.log("Sending Facebook API request with order details:", orderDetails);
//   const id = "792905308407123";
//   const api = `https://graph.facebook.com/v21.0/${id}/events`;
//   const access_token =
//     "EAAjCDyVVKgcBO88FOZAseJjstXZCZCKjNW1wfj6mQMsqZAe1pZC5rNWiMSkw9t1E5rvO0mlLnnmWTankZAFuNrE77KVrZAyezelWucUckQFnfZBC9GDWx4gnZCV5xYoutp7j5zaiCJGMvvmbIIYPwUrorLRFmaX6wBS6F6VnNlE34KM7krhoyRAIoYrEfFJxfQA0B6gZDZD";
//   const test_event_code = "TEST90487";
//   const event_time = getUnixTimeStamp();

//   const hashedEmail = hashEmail(orderDetails.email);
//   const hashedPhone = hashPhone(orderDetails.phone);

//   // Prepare the event data to send to Facebook
//   const event_data = {
//     event_name: "Purchase",
//     event_time,
//     user_data: {
//       em: [hashedEmail],
//       ph: [hashedPhone],
//       client_ip_address: orderDetails?.userIp,
//       client_user_agent: userAgent,
//     },
//     custom_data: {
//       currency: "INR",
//       value: orderDetails.totalAmount,
//       contents: [
//         {
//           id: `${orderDetails.rzpOrderId}`, // Razorpay Order ID
//           quantity: 1,
//         },
//       ],
//     },
//     event_source_url: "https://workshop.9andbeyond.com/garbh-sanskar", // Source URL of the purchase
//     action_source: "website",
//   };

//   const formData = new FormData();
//   formData.append("data", JSON.stringify([event_data]));

//   formData.append("access_token", access_token);

//   try {
//     const response = await axios.post(api, formData, {
//       headers: {
//         ...formData.getHeaders(),
//       },
//     });
//     console.log("Facebook API response:", response.data);
//   } catch (error) {
//     console.error("Error in Facebook API call:", error);
//     if (error.response) {
//       console.error("Response data:", error.response.data);
//       console.error("Response status:", error.response.status);
//       console.error("Response headers:", error.response.headers);
//     }
//   }
// };

export const createTransaction = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { amount, transactionFor, slug, url, userIp, planId } = req.body;

    // extract searchParams from url
    const parsedUrl = url && new URL(url);
    const pathSegments = parsedUrl?.pathname?.split("/").filter(Boolean);
    const searchParams = parsedUrl?.searchParams;

    //extract searchParams values
    const source = searchParams?.get("utm_source");
    const campaign = searchParams?.get("utm_campaign");
    const medium = searchParams?.get("utm_medium");

    if (!rzp_instance) {
      return res.status(503).json({
        success: false,
        message:
          "Payment (Razorpay) is not configured. Set RAZOR_PAY_KEY_ID and RAZOR_PAY_KEY_SECRET in .env to enable payments.",
        result: null,
      });
    }
    const options = {
      amount: Math.round(amount * 100),
      currency: "INR",
      receipt: "Workshop",
    };

    const result = await rzp_instance.orders.create(options);

    // Convert planId string to ObjectId if it exists
    const planObjectId = planId ? new ObjectId(planId) : undefined;

    const transaction = await TransactionModel.create({
      source,
      campaign,
      medium,
      url,
      slug,
      userIp,
      transactionFor,
      rzpOrderId: result.id,
      transactionStatus: TransactionStatus.PENDING,
      transactionType: TransactionType.CREDIT,
      totalAmount: amount,
      planId: planObjectId, // Store as ObjectId
    });

    return res.status(200).json({
      message: transaction != null ? "" : "purchaseFailed",
      success: transaction != null,
      result: transaction,
    });
  } catch (error) {
    console.log(error);
    console.log(error.message);
    return res.status(400).json({
      message: "purchaseFailed",
      success: false,
    });
  }
};

export const runPhonePeTransactionStatusCron = async () => {
  if (!transactionCronRunning) {
    transactionCronRunning = true;
    console.log("Check transaction status Cron Started at", new Date());

    const pendingTransactions = await TransactionModel.find({
      transactionStatus: TransactionStatus.PENDING,
    });

    if (pendingTransactions.length > 0) {
      for (let i = 0; i < pendingTransactions.length; i++) {
        const fetchedAgainTrans = await TransactionModel.findById(
          pendingTransactions[i]._id
        );
        if (fetchedAgainTrans) {
          await checkPhonePeTransactionStatus(fetchedAgainTrans._id.toString());
        }
      }
    }

    console.log("Transaction status check done");
    transactionCronRunning = false;

    return;
  } else {
    console.log("Transaction Cron Running already running");
    return;
  }
};

// cron.schedule("*/10 * * * * *", async () => {
//     runPhonePeTransactionStatusCron();
// });

// Helper function to create or get a user
const createOrGetUser = async (email: string, phone: string) => {
  // First try to find user by email
  let user = await UserModel.findOne({
    email: email,
    isActive: true,
    isDeleted: false,
  });

  // If user doesn't exist, create a new one
  if (!user) {
    user = await UserModel.create({
      email: email,
      phone: phone.replace("+", ""), // Remove '+' prefix if present
    });
  }

  return user;
};

export const updateTransactionStatus = async (
  req: any,
  res: Response,
  next: NextFunction
) => {
  try {
    console.log("updateTransactionStatus START");
    const secret: any = process.env.RAZOR_PAY_WEBHOOKS_SECRET;
    const reqBody = JSON.stringify(req.body);
    const signature = req.headers["x-razorpay-signature"];
    console.log("payment started");
    // console.log(JSON.stringify(req.body, null, 2));
    console.log(signature);
    console.log(Razorpay.validateWebhookSignature(reqBody, signature, secret));

    // CHECK FOR VALID REQUEST
    if (!Razorpay.validateWebhookSignature(reqBody, signature, secret)) {
      return res.status(200).json("Not a valid razorpay request");
    }

    if (
      req.body.event.includes("payment") ||
      req.body.event.includes("order")
    ) {
      const entity = req.body.payload.payment.entity;

      if (entity == undefined || entity == null) {
        return res.status(200).json("Invalid Response. NO Entity received");
      }

      //CHECK DUPLICATE REQUEST
      const transactionResponse: any = await TransactionModel.findOne({
        rzpPaymentId: entity.id,
      });

      if (transactionResponse) {
        console.log("duplicate request");
        return res.status(200).json("duplicate request");
      }

      // CHECK PAYMENT AUTHORIZED
      if (entity.status != "authorized") {
        console.log("error response");
        return res.status(200).json("Bad request");
      }

      // SAVE Transaction DATA
      const transaction = await TransactionModel.findOne({
        rzpOrderId: entity.order_id,
      });

      if (!transaction) {
        console.log("transaction not found");
        return res.status(200).json("transaction not found");
      }

      // Get or create user from email and phone
      const email = entity.email;
      const phone = entity.contact?.replace("+", ""); // Remove + prefix if present
      const user = await createOrGetUser(email, phone);

      // Add user to transaction if not already set
      if (!transaction.user) {
        (transaction as any).user = user._id;
      }

      if (transaction.transactionFor == TransactionFor.GOLDEN) {
        const previousTransaction = await TransactionModel.findOne(
          {
            user: transaction.user,
            transactionStatus: TransactionStatus.SUCCESS,
            transactionFor: TransactionFor.GOLDEN,
          },
          { walletBalance: 1 }
        ).sort({ paidSuccesOn: -1 });

        console.log(previousTransaction);

        transaction.walletBalance =
          (previousTransaction != null
            ? previousTransaction.walletBalance
            : 0) + transaction.rechargeAmount;
        await UserModel.findByIdAndUpdate(
          transaction.user,
          { gptCredits: transaction.walletBalance },
          { new: true }
        );
      } else if (transaction.transactionFor == TransactionFor.BLUE) {
        const subscription = await SubscriptionModel.findByIdAndUpdate(
          transaction.subscriptionId,
          {
            status: SubscriptionStatus.ACTIVE,
            user: user._id, // Also update subscription with user ID
          },
          { new: true }
        );
        await UserModel.findByIdAndUpdate(
          user._id,
          { planId: transaction.planId },
          { new: true }
        );
      } else if (transaction.transactionFor == TransactionFor.SILVER) {
        await UserModel.findByIdAndUpdate(
          user._id,
          { planId: transaction.planId, transactionId: transaction._id },
          { new: true }
        );
      }

      transaction.rzpPaymentId = entity.id;
      transaction.transactionStatus = TransactionStatus.SUCCESS;
      transaction.paidSuccesOn = new Date();
      transaction.email = entity.email;
      transaction.phone = entity.contact;

      await transaction.save();
      const userAgent = req.get("User-Agent");
      // await facebookApiCallOnSuccessfulPayment(transaction, userAgent);

      console.log("transaction: " + transaction);
    }

    console.log("updateTransactionStatus END");

    return res.status(200).json("payment saved");
  } catch (error) {
    console.error("Error in updateTransactionStatus:", error);
    return res.status(200).json("payment saved");
  }
};

async function checkAndUpdatePhonePeTransaction(data: any) {
  const transaction = await TransactionModel.findById(
    data["merchantTransactionId"]
  );
  if (
    !transaction ||
    transaction.transactionStatus == TransactionStatus.SUCCESS ||
    transaction.transactionStatus == TransactionStatus.FAILED
  ) {
    return {
      success: false,
      message: "Transaction not found or is already marked completed",
    };
  }

  const user = await UserModel.findById(transaction.user);
  if (!user) {
    console.log("Webhook user not found");
    return {
      success: false,
      message: "User not found",
    };
  }

  transaction.phonePeTransactionId = data["transactionId"];
  transaction.transactionStatus =
    data["state"] == "COMPLETED"
      ? TransactionStatus.SUCCESS
      : data["state"] == "FAILED"
      ? TransactionStatus.FAILED
      : TransactionStatus.PENDING;
  if (transaction.transactionStatus == TransactionStatus.SUCCESS) {
    transaction.paymentInstrument = data["paymentInstrument"]["type"];
    transaction.paidSuccesOn = new Date();
  }

  if (transaction.transactionFor == TransactionFor.GOLDEN) {
    const previousTransaction = await TransactionModel.findOne(
      {
        user: transaction.user,
        transactionStatus: TransactionStatus.SUCCESS,
        transactionFor: TransactionFor.GOLDEN,
      },
      { walletBalance: 1 }
    ).sort({ paidSuccesOn: -1 });

    // transaction.walletBalance =
    //   (previousTransaction != null
    //     ? previousTransaction.walletBalance
    //     : user.gptCredits) + transaction.rechargeAmount;
    // user.gptCredits = transaction.walletBalance;
    user.save();
  }

  await transaction.save();

  return { success: true, message: "Payment webhook saved" };
}

export const phonePeUpdateTransactionStatus = async (
  req: any,
  res: Response,
  next: NextFunction
) => {
  try {
    console.log("payment webhook received");

    // req.body = { response: "eyJzdWNjZXNzIjp0cnVlLCJjb2RlIjoiUEFZTUVOVF9TVUNDRVNTIiwibWVzc2FnZSI6IllvdXIgcGF5bWVudCBpcyBzdWNjZXNzZnVsLiIsImRhdGEiOnsibWVyY2hhbnRJZCI6IlBHVEVTVFBBWVVBVCIsIm1lcmNoYW50VHJhbnNhY3Rpb25JZCI6IjY1NDIzZGVjNDY2ODdjNzc4OTIzMjNkMSIsInRyYW5zYWN0aW9uSWQiOiJUMjMxMTAxMTczMDUwNTYzOTYzMjA5NiIsImFtb3VudCI6NTkwMDAsInN0YXRlIjoiQ09NUExFVEVEIiwicmVzcG9uc2VDb2RlIjoiU1VDQ0VTUyIsInBheW1lbnRJbnN0cnVtZW50Ijp7InR5cGUiOiJORVRCQU5LSU5HIiwicGdUcmFuc2FjdGlvbklkIjoiMTk5NTQ2NDc3MyIsInBnU2VydmljZVRyYW5zYWN0aW9uSWQiOiJQRzIyMTIyOTE2MDcwODMzNDQ5MzQzMDAiLCJiYW5rVHJhbnNhY3Rpb25JZCI6bnVsbCwiYmFua0lkIjoiIn19fQ==" };

    const { response } = req.body;

    const base64Decoded: string = Buffer.from(response, "base64").toString(
      "utf8"
    );
    const decodedResponse = JSON.parse(base64Decoded);

    if (!decodedResponse["success"]) {
      console.log("Webhook encoded data not proper");
      return res.status(200).json("Encoded data not proper");
    }

    const statusResponse = await checkAndUpdatePhonePeTransaction(
      decodedResponse["data"]
    );

    return res
      .status(statusResponse["success"] ? 200 : 400)
      .json(statusResponse["message"]);
    // return res.status(200).json("payment saved");
  } catch (error) {
    console.log("payment webhook error");
    return res.status(400).json("webhook error");
  }
};

export const fetchCreditHistory = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    let { skip }: any = req.query;
    let { user } = req.body;

    const transactionsAggregate = await TransactionModel.aggregate([
      {
        $match: {
          user: user,
          transactionFor: TransactionFor.GOLDEN,
          transactionStatus: TransactionStatus.SUCCESS,
        },
      },
      {
        $addFields: {
          date: {
            $dateToString: { format: "%Y-%m-%d", date: "$paidSuccesOn" },
          },
        },
      },
      {
        $group: {
          _id: { date: "$date", transactionType: "$transactionType" },
          totalAmount: {
            $sum: {
              $cond: {
                if: { $eq: ["$transactionType", TransactionType.CREDIT] },
                then: "$rechargeAmount",
                else: "$totalAmount",
              },
            },
          },
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          date: "$_id.date",
          transactionType: "$_id.transactionType",
          totalAmount: "$totalAmount",
          count: "$count",
          _id: "$_id.date",
        },
      },
      {
        $sort: { date: -1 },
      },
    ]);

    return res.status(200).json({
      message: transactionsAggregate != null ? "" : "failedToGetCredHist",
      success: transactionsAggregate != null,
      result: transactionsAggregate,
    });
  } catch (e) {
    return res.status(200).json({
      message: "failedToGetCredHist",
      success: false,
    });
  }
};

async function checkPhonePeTransactionStatus(merchantTransactionId: string) {
  try {
    const transaction = await TransactionModel.findById(merchantTransactionId);
    if (
      !transaction ||
      transaction.transactionStatus == TransactionStatus.SUCCESS ||
      transaction.transactionStatus == TransactionStatus.FAILED
    ) {
      return {
        success: true,
        message: "Transaction not found OR Payment already saved",
      };
    }

    const URL = `https://api-preprod.phonepe.com/apis/pg-sandbox/pg/v1/status/${process.env.PHONEPE_MERCHANT_ID}/${merchantTransactionId}`;

    const options = {
      method: "GET",
      url: URL,
      headers: {
        "Content-Type": "application/json",
        "X-VERIFY":
          crypto
            .createHash("sha256")
            .update(
              `/pg/v1/status/${process.env.PHONEPE_MERCHANT_ID}/${merchantTransactionId}` +
                process.env.SALT_KEY
            )
            .digest("hex") +
          "###" +
          process.env.SALT_INDEX,
        "X-MERCHANT-ID": process.env.PHONEPE_MERCHANT_ID,
      },
    };

    let putItem = new Promise(async (resolve, reject) => {
      try {
        axios
          .request(options)
          .then(function (response: any) {
            resolve(response.data);
          })
          .catch(function (error: any) {
            resolve(null);
          });
      } catch (error) {
        resolve(null);
      }
    });

    const result: any = await putItem;
    let statusResponse: any;

    if (!result) {
      return { success: false, message: "PhonePe transaction not found" };
    }

    statusResponse = await checkAndUpdatePhonePeTransaction(result["data"]);
    return statusResponse;
  } catch (e) {
    return { success: false, message: "Internal server error" };
  }
}

export const updateTransactionStatusToFailed = async (
  req: any,
  res: Response,
  next: NextFunction
) => {
  try {
    const { transactionId }: any = req.params;

    const failedTransaction = await TransactionModel.findByIdAndUpdate(
      transactionId,
      {
        transactionStatus: TransactionStatus.FAILED,
      }
    );

    if (!failedTransaction) {
      return res.status(200).json({
        message: "failedToUpdateTransaction",
        success: false,
      });
    }

    return res.status(200).json({
      message: "transactionUpdated",
      success: true,
    });
  } catch (error) {
    return res.status(400).json({
      message: "failedToUpdateTransaction",
      success: false,
    });
  }
};
