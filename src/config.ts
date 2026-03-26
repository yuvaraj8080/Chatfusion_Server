import Razorpay from "razorpay";

const keyId = process.env.RAZOR_PAY_KEY_ID?.trim();
const keySecret = process.env.RAZOR_PAY_KEY_SECRET?.trim();
const isRazorpayConfigured =
  Boolean(keyId) && Boolean(keySecret);

export const rzp_instance: Razorpay | null = isRazorpayConfigured
  ? new Razorpay({
      key_id: keyId!,
      key_secret: keySecret!,
      headers: {},
    })
  : null;
