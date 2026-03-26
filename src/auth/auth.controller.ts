import { Request, Response } from "express";
import OTP, { OTPStatus } from "./otp.model";
import axios from "axios";
import { UserModel } from "../user/user.model";
import { createAccessTokenForUser } from "../utils/generic/auth/auth.middleware";
import { SettingsModel } from "../setting/settings.model";
import { NotificationSettingsModel } from "../setting/alerts&update/notificationSettings.model";

// send OTP
export const sendOTP = async (req: Request, res: Response) => {
  try {
    const { mobileNo, cc = "91" } = req.body;
    let URL;
    let defaultOtp = "123456";

    // If it's a test number, don't even call MSG91 API
    if (
      mobileNo == "8899221111" ||
      mobileNo == "8899331111" ||
      mobileNo == "8899441111" ||
      mobileNo == "8080737803"
    ) {
      console.log("Bypassing MSG91 for test number:", mobileNo);
      await OTP.create({
        mobile_number: mobileNo,
        status: OTPStatus.SUCCESS,
        requestId: "TEST_BYPASS_ID",
        otp: defaultOtp,
        log: "Bypassed MSG91 for testing",
      });
      return res.status(200).send({
        success: true,
        result: { message: "OTP sent successfully (Bypassed)", type: "success" },
      });
    }

    URL = `https://api.msg91.com/api/v5/otp?template_id=${process.env.MSG91TEMPLATEID}&mobile=+${cc}${mobileNo}&authkey=${process.env.MSG91AUTHKEY}&otp_length=6`;

    return axios
      .get(URL)
      .then(async function (response: any) {
        console.log("MSG91 OTP Success Response:", response.data);
        await OTP.create({
          mobile_number: mobileNo,
          status: OTPStatus.SUCCESS,
          requestId: response.data.request_id || "TEST_REQUEST_ID",
          otp: defaultOtp,
          log: JSON.stringify(response.data),
        });
        res.status(200).send({
          success: true,
          result: response.data,
        });
      })
      .catch(async function (error: any) {
        console.error("MSG91 OTP Error Response:", error.response?.data || error.message);
        await OTP.create({
          mobile_number: mobileNo,
          status: OTPStatus.FAILED,
          requestId: "FAILED_REQUEST_ID",
          otp: "000000",
          log: JSON.stringify(error.response?.data || error.message),
        });
        res.status(400).send({
          success: false,
          error: error.response?.data || error.message,
        });
      });
  } catch (error) {
    console.error("OTP Send Error:", error);
    res.status(500).send({
      success: false,
      result: error,
    });
  }
};

// resend OTP
export const resendOTP = async (req: Request, res: Response) => {
  try {
    const { mobileNo, type = "text", cc = "91" } = req.body;
    let URL;
    let defaultOtp = "123456";
    if (
      mobileNo == "8899221111" ||
      mobileNo == "8899331111" ||
      mobileNo == "8899441111" ||
      mobileNo == "8080737803"
    ) {
      URL = `https://api.msg91.com/api/v5/otp/retry?authkey=${process.env.MSG91AUTHKEY}&retrytype=${type}&mobile=+${cc}${mobileNo}&otp=123456`;
    } else {
      URL = `https://api.msg91.com/api/v5/otp/retry?authkey=${process.env.MSG91AUTHKEY}&retrytype=${type}&mobile=+${cc}${mobileNo}`;
    }

    axios
      .get(URL)
      .then(async function (response: any) {
        let detail = await OTP.findOne({ mobile_number: mobileNo }).sort({
          createdAt: -1,
        });
        if (detail) {
          await OTP.updateOne(
            { _id: detail._id },
            {
              $inc: { resendCount: 1 },
              $set: {
                requestId: response.data.request_id || "RESEND_REQUEST_ID",
                otp: defaultOtp,
              },
            }
          );
        } else {
          await OTP.create({
            mobile_number: mobileNo,
            status: OTPStatus.SUCCESS,
            requestId: response.data.request_id || "RESEND_REQUEST_ID",
            otp: defaultOtp,
            log: JSON.stringify(response.data),
          });
        }
        res.status(200).send({ success: true, result: response.data });
      })
      .catch(async function (error: any) {
        await OTP.create({
          mobile_number: mobileNo,
          status: OTPStatus.FAILED,
          requestId: "FAILED_REQUEST_ID",
          otp: "000000",
          log: JSON.stringify(error),
        });
        res.status(200).send({
          success: true,
          error: error,
        });
      });
  } catch (error) {
    res.status(500).send({
      success: false,
      result: error,
    });
  }
};

// verify OTP
export const verifyOTP = async (req: Request, res: Response) => {
  try {
    const { mobileNo, otp, cc = "91" } = req.body;

    // discard the default otp, unless it's a test number
    if (
      otp === "123456" &&
      mobileNo !== "8899221111" &&
      mobileNo !== "8899331111" &&
      mobileNo !== "8899441111" &&
      mobileNo !== "8080737803"
    ) {
      return res.status(200).send({
        success: false,
        result: "OTP verification failed",
      });
    }

    const URL = `https://api.msg91.com/api/v5/otp/verify?authkey=${process.env.MSG91AUTHKEY}&mobile=+${cc}${mobileNo}&otp=${otp}`;

    return axios
      .get(URL)
      .then(async function (response: any) {
        if (response.data["message"] == "OTP verified success") {
          await OTP.findOneAndUpdate(
            { mobile_number: mobileNo },
            { isVerified: true },
            { sort: { createdAt: -1 } }
          );

          const phoneCount = await UserModel.countDocuments({
            phone: mobileNo,
          });

          if (phoneCount >= 5) {
            return res.status(400).json({
              success: false,
              result: "Maximum 5 accounts allowed per phone number",
            });
          }
        }
        return res.status(200).send({
          success: true,
          result: response.data,
        });
      })
      .catch(function (error: any) {
        return res.status(200).send({
          success: true,
          error: error,
        });
      });
  } catch (error) {
    return res.status(500).send({
      success: false,
      result: error,
    });
  }
};

// login with phone number
// export const login = async (req: Request, res: Response) => {
//   try {
//     const { phoneNumber, selectedUserId, fcmToken } = req.body;

//     // ✅ Step 1: Find all accounts for this phone
//     const users = await UserModel.find({ phone: phoneNumber });

//     // ✅ Step 2: If no users, send error
//     if (!users || users.length === 0) {
//       return res.status(404).json({
//         success: false,
//         login: false,
//         message: "No account found with this phone number",
//       });
//     }

//     // ✅ Step 3: If user selects specific account
//     if (selectedUserId) {
//       const user = users.find((u) => u._id.toString() === selectedUserId);
//       if (!user) {
//         return res
//           .status(400)
//           .json({ success: false, message: "Invalid account selected" });
//       }

//       const [settings, notificationSettings] = await Promise.all([
//         SettingsModel.findOneAndUpdate(
//           { userId: user._id },
//           {},
//           { upsert: true, new: true }
//         ),
//         NotificationSettingsModel.findOneAndUpdate(
//           { userId: user._id },
//           {},
//           { upsert: true, new: true }
//         ),
//       ]);

//       if (fcmToken) {
//         user.fcmToken = fcmToken;
//         await user.save();
//       }

//       return res.status(200).json({
//         success: true,
//         login: true,
//         message: "Login successful",
//         data: user,
//         accessToken: createAccessTokenForUser(user._id.toString()),
//       });
//     }

//     // ✅ Step 4: If multiple users, return account list
//     if (users.length > 1) {
//       return res.status(200).json({
//         success: true,
//         login: false,
//         message: "Multiple accounts found. Please select one.",
//         accounts: users.map((user) => ({
//           _id: user._id,
//           username: user.username,
//           fullName: user.fullName,
//           profilePicture: user.profilePicture,
//         })),
//       });
//     }

//     // ✅ Step 5: Single account, login directly
//     const user = users[0];

//     const [settings, notificationSettings] = await Promise.all([
//       SettingsModel.findOneAndUpdate(
//         { userId: user._id },
//         {},
//         { upsert: true, new: true }
//       ),
//       NotificationSettingsModel.findOneAndUpdate(
//         { userId: user._id },
//         {},
//         { upsert: true, new: true }
//       ),
//     ]);

//     if (fcmToken) {
//       user.fcmToken = fcmToken;
//       await user.save();
//     }

//     return res.status(200).json({
//       success: true,
//       login: true,
//       message: "Login successful",
//       data: user,
//       accessToken: createAccessTokenForUser(user._id.toString()),
//     });
//   } catch (error: any) {
//     console.error("Login error:", error);
//     return res.status(500).json({
//       success: false,
//       login: false,
//       error: "Failed to process login request",
//       details: error.message,
//     });
//   }
// };

export const login = async (req: Request, res: Response) => {
  try {
    const { phoneNumber } = req.body;

    const user = await UserModel.findOne({ phone: phoneNumber });

    if (user) {
      const [settings, notificationSettings] = await Promise.all([
        SettingsModel.exists({ userId: user._id }),
        NotificationSettingsModel.exists({ userId: user._id }),
      ]);

      // if not then create settings for the user
      if (!settings) {
        await SettingsModel.create({ userId: user._id });
      }

      // if not then create notification settings for the user
      if (!notificationSettings) {
        await NotificationSettingsModel.create({ userId: user._id });
      }

      if (req.body.fcmToken) {
        user.fcmToken = req.body.fcmToken;
        await user.save();
      }
    }

    return res.status(200).json({
      success: user ? true : false,
      login: user ? true : false,
      data: user ? user : null,
      accessToken: user ? createAccessTokenForUser(user._id.toString()) : null,
      message: user ? "Login successfull" : "User not found",
    });
  } catch (error: any) {
    console.error("Login error:", error);
    return res.status(500).json({
      success: false,
      login: false,
      error: "Failed to process login request",
      details: error.message,
    });
  }
};
