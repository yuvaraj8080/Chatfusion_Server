import { Request, Response } from "express";
import { SubscriptionModel, SubscriptionStatus } from "./subscription.model";
import {
  TransactionFor,
  TransactionModel,
  TransactionStatus,
} from "../transactionModule/transaction.model";
import { rzp_instance } from "./../../config";
import { UserModel } from "../../user/user.model";
import { SubscriptionPauseHistoryModel } from "./subscriptionPauseHistory/subscriptionPauseHistory.model";
import { PlanModel } from "../planModule/plan.model";

export function addDays(date: Date, day: any) {
  return new Date(date.setDate(date.getDate() + day));
}

// Helper function to update user tier based on plan
const updateUserTier = async (userId: any, planId: any) => {
  const plan = await PlanModel.findById(planId);
  await UserModel.findByIdAndUpdate(
    userId,
    {
      planId: planId,
      userTier: plan?.userTier || "Default",
    },
    { new: true }
  );
};

// Helper function to reset user tier to Default
const resetUserTier = async (userId: any) => {
  await UserModel.findByIdAndUpdate(
    userId,
    { userTier: "Default" },
    { new: true }
  );
};

export const createSubscription = async (req: any, res: Response) => {
  try {
    let { user, planId, total }: any = req.body;

    const existingSubscription = await SubscriptionModel.findOne({
      user: user,
      planId: planId,
      status: SubscriptionStatus.ACTIVE,
    });

    if (existingSubscription) {
      return res.status(400).json({
        success: false,
        message: "User already has an active subscription for this plan",
      });
    }

    let subscription: any;

    const plan = await PlanModel.findById(planId);
    subscription = await SubscriptionModel.create({
      user: user,
      planId: planId,
      startDate: new Date(),
      endDate: addDays(new Date(), plan?.durationDays || 30),
      status: SubscriptionStatus.INACTIVE,
    });

    if (total === "0") {
      subscription = await SubscriptionModel.findByIdAndUpdate(
        subscription._id,
        { status: SubscriptionStatus.ACTIVE },
        { new: true }
      );

      // Update user with plan ID and user tier for free subscription
      await updateUserTier(user, planId);
      await UserModel.findByIdAndUpdate(
        user,
        { subscriptionId: subscription._id },
        { new: true }
      );

      return res.status(201).json({
        success: true,
        result: subscription,
        message: "Subscription created successfully with no cost",
      });
    } else {
      if (!rzp_instance) {
        return res.status(503).json({
          success: false,
          message:
            "Payment (Razorpay) is not configured. Set RAZOR_PAY_KEY_ID and RAZOR_PAY_KEY_SECRET in .env to enable payments.",
        });
      }
      var options = {
        amount: Math.round(total * 100),
        currency: "INR",
        receipt: `Genuinest`,
      };

      let result = await rzp_instance.orders.create(options);

      const transaction = await TransactionModel.create({
        user: user,
        rzpOrderId: result.id,
        transactionStatus: TransactionStatus.PENDING,
        transactionFor: TransactionFor.BLUE,
        totalAmount: total,
        cashAmount: total,
        subscriptionId: subscription._id,
        planId: planId,
      });

      if (transaction) {
        return res.status(201).json({
          success: true,
          result: transaction,
          message: "Transaction created successfully",
        });
      } else {
        return res.status(200).json({
          success: false,
          message: "Failed to create transaction",
        });
      }
    }
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      error: error.message,
      message: "Failed to create subscription or transaction",
    });
  }
};

const createOrGetUser = async (email: string, phone: string) => {
  // First try to find user by email
  let user = await UserModel.findOne({
    email: email,
    isActive: true,
    isDeleted: false,
  });

  //  create new user
  if (!user) {
    user = await UserModel.create({
      email: email,
      phone: phone,
    });
  }

  return user;
};

const handlePaymentWebhook = async (
  payload: any,
  isNewCharge = false,
  req: Request
) => {
  const payment = payload.payment.entity;
  const subscription = payload.subscription.entity;
  const order = payload.order?.entity;
  const userAgent: any = req.get("User-Agent");

  // Get the subscription record to access tracking info
  const subscriptionRecord = await SubscriptionModel.findOne({
    rzpSubscriptionId: subscription.id,
  });

  // Create or get user
  const user = await createOrGetUser(payment.email, payment.contact);

  if (isNewCharge) {
    // Create new transaction for recurring charges
    const transaction = await TransactionModel.create({
      rzpSubscriptionId: subscription.id,
      rzpPaymentId: payment.id,
      rzpOrderId: payment.order_id || order?.id,
      email: payment.email,
      phone: payment.contact,
      user: user._id,
      transactionStatus: TransactionStatus.SUCCESS,
      paidSuccesOn: new Date(payment.created_at * 1000),
      totalAmount: payment.amount / 100,
      rzp_source: subscription.source || "",
      transactionFor: TransactionFor.BLUE,
      totalCount: subscription.total_count,
      remainingCount: subscription.remaining_count,
      paidCount: subscription.paid_count,
      planId: subscriptionRecord?.planId,
      campaign: subscriptionRecord?.tracking_info?.utm_campaign,
      medium: subscriptionRecord?.tracking_info?.utm_medium,
      source: subscriptionRecord?.tracking_info?.utm_source,
      url: subscriptionRecord?.tracking_info?.url,
      pixelId: subscriptionRecord?.tracking_info?.pixelId,
    });

    // Update user with the plan ID and user tier from subscription record
    if (subscriptionRecord?.planId) {
      await updateUserTier(user._id, subscriptionRecord.planId);
      await UserModel.findByIdAndUpdate(
        user._id,
        { subscriptionId: subscriptionRecord._id },
        { new: true }
      );
    }

    // Call Facebook API after successful transaction
    // facebookApiCallOnSuccessfulPayment(transaction, userAgent);

    return transaction;
  } else {
    // Update existing transaction for initial subscription activation
    const transaction = await TransactionModel.findOneAndUpdate(
      { rzpSubscriptionId: subscription.id },
      {
        rzpPaymentId: payment.id,
        rzpOrderId: payment.order_id || order?.id,
        email: payment.email,
        phone: payment.contact,
        user: user._id,
        transactionStatus: TransactionStatus.SUCCESS,
        paidSuccesOn: new Date(payment.created_at * 1000),
        totalCount: subscription.total_count,
        remainingCount: subscription.remaining_count,
        paidCount: subscription.paid_count,
        campaign: subscriptionRecord?.tracking_info?.utm_campaign,
        medium: subscriptionRecord?.tracking_info?.utm_medium,
        source: subscriptionRecord?.tracking_info?.utm_source,
        url: subscriptionRecord?.tracking_info?.pixelId,
      },
      { new: true }
    );

    // Update user with the plan ID and user tier from subscription record
    if (subscriptionRecord?.planId) {
      await updateUserTier(user._id, subscriptionRecord.planId);
      await UserModel.findByIdAndUpdate(
        user._id,
        { subscriptionId: subscriptionRecord._id },
        { new: true }
      );
    }

    // Call Facebook API after successful transaction update
    // facebookApiCallOnSuccessfulPayment(transaction, userAgent);

    return transaction;
  }
};

const handleSubscriptionWebhook = async (
  event: string,
  payload: any,
  req: Request
) => {
  const subscription = payload.subscription.entity;
  const payment = payload.payment?.entity;

  const updateData: any = {
    rzpStatus: subscription.status,
    startDate: new Date(subscription.current_start * 1000),
    endDate: new Date(subscription.current_end * 1000),
  };

  if (payment) {
    const user = await createOrGetUser(payment.email, payment.contact);
    updateData.user = user._id;
  }

  switch (event) {
    case "subscription.charged":
      if (payment) {
        const transaction = await handlePaymentWebhook(payload, true, req);
      }
      updateData.status = SubscriptionStatus.ACTIVE;
      break;

    case "subscription.activated":
      updateData.nextBillingPaused = false;
      updateData.pausedAt = null;
      updateData.status = SubscriptionStatus.ACTIVE;
      if (payment) {
        const transaction = await handlePaymentWebhook(payload, false, req);
      }
      break;

    case "subscription.paused":
      updateData.nextBillingPaused = true;
      updateData.pausedAt = new Date();
      // Set pause start date to one day after current_end
      const pauseStartDate = new Date(subscription.current_end * 1000);
      pauseStartDate.setDate(pauseStartDate.getDate() + 1);
      updateData.pauseStartDate = pauseStartDate;
      updateData.pauseEndDate = null;
      updateData.status = SubscriptionStatus.PAUSED;

      const subscriptionResponse = await SubscriptionModel.findOne({
        rzpSubscriptionId: subscription.id,
      });
      await SubscriptionPauseHistoryModel.create({
        subscriptionId: subscriptionResponse?._id,
        user: updateData.user,
        pauseStartDate: pauseStartDate,
        pauseEndDate: null,
      });
      break;

    case "subscription.resumed":
      updateData.nextBillingPaused = false;
      updateData.pausedAt = null;
      updateData.pauseStartDate = null;
      updateData.pauseEndDate = null;
      updateData.status = SubscriptionStatus.RESUMED;
      break;

    case "subscription.halted":
      updateData.status = SubscriptionStatus.INACTIVE;
      // Reset user tier to Default when subscription is halted
      if (updateData.user) {
        await resetUserTier(updateData.user);
      }
      break;

    case "subscription.cancelled":
      updateData.status = SubscriptionStatus.CANCELLED;
      // Reset user tier to Default when subscription is cancelled
      if (updateData.user) {
        await resetUserTier(updateData.user);
      }
      break;

    default:
      updateData.status = SubscriptionStatus.PENDING;
  }

  return await SubscriptionModel.findOneAndUpdate(
    { rzpSubscriptionId: subscription.id },
    updateData,
    { new: true }
  );
};

// for cron job
export const checkPausedSubscriptions = async () => {
  const pausedSubscriptions = await SubscriptionModel.find({
    nextBillingPaused: true,
    isActive: true,
    endDate: { $lt: new Date() },
  });

  for (const sub of pausedSubscriptions) {
    await SubscriptionModel.findByIdAndUpdate(sub._id, {
      isActive: false,
    });
  }
};

export const updateSubscriptionStatus = async (req: any, res: Response) => {
  try {
    const signature = req.headers["x-razorpay-signature"];
    const reqBody = JSON.stringify(req.body);

    console.log("Webhook received:", {
      event: req.body.event,
      status: req.body.payload?.subscription?.entity?.status,
      subscriptionId: req.body.payload?.subscription?.entity?.id,
    });

    // if (!Razorpay.validateWebhookSignature(reqBody, signature, secret)) {
    //   console.log('Invalid webhook signature');
    //   return res.status(400).json({
    //     success: false,
    //     message: 'Invalid webhook signature'
    //   });
    // }

    const event = req.body.event;
    const payload = req.body.payload;

    let result;
    const validEvents = [
      "subscription.charged",
      "subscription.activated",
      "subscription.halted",
      "subscription.paused",
      "subscription.resumed",
      "subscription.cancelled",
    ];

    if (validEvents.includes(event)) {
      result = await handleSubscriptionWebhook(event, payload, req);
    }

    return res.status(200).json({
      success: true,
      message: "Webhook processed successfully",
      result,
    });
  } catch (error: any) {
    console.error("Subscription Webhook Error:", error);
    return res.status(200).json({
      success: false,
      error: error.message,
      message: "Failed to process webhook",
    });
  }
};

// Check and reset expired subscriptions
export const checkExpiredSubscriptions = async () => {
  try {
    const expiredSubscriptions = await SubscriptionModel.find({
      status: SubscriptionStatus.ACTIVE,
      endDate: { $lt: new Date() },
      isActive: true,
    });

    for (const subscription of expiredSubscriptions) {
      // Update subscription status
      await SubscriptionModel.findByIdAndUpdate(subscription._id, {
        status: SubscriptionStatus.INACTIVE,
        isActive: false,
      });

      // Reset user tier to Default
      if (subscription.user) {
        await resetUserTier(subscription.user);

        // Clear planId and subscriptionId from user
        await UserModel.findByIdAndUpdate(subscription.user, {
          planId: null,
          subscriptionId: null,
        });
      }
    }

    console.log(`Reset ${expiredSubscriptions.length} expired subscriptions`);
  } catch (error) {
    console.error("Error checking expired subscriptions:", error);
  }
};
