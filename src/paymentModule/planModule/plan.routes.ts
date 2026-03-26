import { Router } from "express";
import { createPlan } from "./plan.controller";

const PlanRoutes = Router();

// api/plan/createPlan
PlanRoutes.post("/createPlan", createPlan);

export default PlanRoutes;
