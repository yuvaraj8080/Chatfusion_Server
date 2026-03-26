import { Router } from "express";
import {
  createSubscription,
  updateSubscriptionStatus,
} from "./subscription.controller";

const SubscriptionRoutes = Router();

// api/subscription/createSubscription
SubscriptionRoutes.post("/createSubscription", createSubscription);

// api/subscription/updateSubscriptionStatus
SubscriptionRoutes.post("/updateSubscriptionStatus", updateSubscriptionStatus);

export default SubscriptionRoutes;
