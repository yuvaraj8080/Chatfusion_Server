import { Router } from "express";

const ReportRoutes = Router();
import { report } from "./report.controller";

// /api/report
ReportRoutes.post("/", report);

export default ReportRoutes;
