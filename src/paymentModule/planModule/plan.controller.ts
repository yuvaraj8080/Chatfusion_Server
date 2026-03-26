import { Request, Response } from "express";
import { PlanModel } from "./plan.model";

// Create a new plan
export const createPlan = async (req: Request, res: Response) => {
  try {
    const {
      name,
      description,
      price,
      durationDays,
      access,
      content,
      rzpPlanId,
      userTier,
    } = req.body;

    const plan = await PlanModel.create({
      name,
      description,
      price,
      durationDays,
      content,
      access,
      rzpPlanId,
      userTier,
    });

    return res.status(201).json({
      success: plan ? true : false,
      message: plan ? "Plan created successfully" : "Failed to create plan",
      result: plan ? plan : null,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      error: error.message,
      message: "Failed to create plan",
    });
  }
};
