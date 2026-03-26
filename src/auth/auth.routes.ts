import express from "express";
import { login, resendOTP, sendOTP, verifyOTP } from "./auth.controller";

const AuthRoutes = express.Router();

// /api/auth/verifyOTP
AuthRoutes.post("/verifyOTP", verifyOTP);

// /api/auth/sendOTP
AuthRoutes.post("/sendOTP", sendOTP);

// /api/auth/resendOTP
AuthRoutes.post("/resendOTP", resendOTP);

// /api/auth/login
AuthRoutes.post("/login", login);

export default AuthRoutes;
