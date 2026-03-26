import { Router } from "express";

import {
  updateUserProfileDetails,
  deleteProfilePicture,
  updateUserLocation,
} from "./edit-profile-details.controller";

const editProfileDetailsRouter = Router();

// /api/setting/edit-profile-details
editProfileDetailsRouter.patch("/", updateUserProfileDetails);

// /api/setting/edit-profile-details/delete-profile-picture
editProfileDetailsRouter.delete(
  "/delete-profile-picture",
  deleteProfilePicture
);

// /api/setting/edit-profile-details/update-user-location
editProfileDetailsRouter.put("/update-user-location", updateUserLocation);

export default editProfileDetailsRouter;
