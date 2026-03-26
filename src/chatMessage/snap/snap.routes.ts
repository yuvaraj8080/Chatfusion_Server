import { Router } from "express";
import { createSnap, viewSnap } from "./snap.controller";
const snapRoutes = Router();

// /api/snap/createSnap
snapRoutes.post("/createSnap", createSnap);

// /api/snap/viewSnap
snapRoutes.post("/viewSnap", viewSnap);

export default snapRoutes;
