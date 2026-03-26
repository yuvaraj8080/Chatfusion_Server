import { Router } from "express";
import {
  toggleAccountPrivacy,
  getAccountPrivacySettings,
} from "./public-and-postVisibility.controller";

const publicAndPostVisibilityRoutes = Router();

// /api/setting/public-and-postVisibility/toggle-account-privacy
publicAndPostVisibilityRoutes.put(
  "/toggle-account-privacy",
  toggleAccountPrivacy
);

// /api/setting/public-and-postVisibility/get-account-privacy-settings
publicAndPostVisibilityRoutes.get(
  "/get-account-privacy-settings",
  getAccountPrivacySettings
);

export default publicAndPostVisibilityRoutes;
