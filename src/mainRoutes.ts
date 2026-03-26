import express from "express";
import userRoutes from "./user/user.routes";
import followRoutes from "./follow/follow.routes";
import storyRoutes from "./stories/stories.routes";
import commentRoutes from "./comment/comment.routes";
import postRoutes from "./post/post.routes";
import authRoutes from "./auth/auth.routes";
import likeRoutes from "./like/like.routes";
import shareRoutes from "./share/share.routes";
import savePostRoutes from "./savePost/savepost.routes";
import SettingRoutes from "./setting/setting.routes";
import searchHistoryRoutes from "./searchHistory/searchHistory.routes";
import storyHighlightsRoutes from "./storyHighlights/storyHighlights.routes";
import blockedUserRoutes from "./blockUser/blockedUser.routes";
import FileUploadRoutes from "./config/fileUpload.routes";
import SnapRoutes from "./chatMessage/snap/snap.routes";
import MessageRoutes from "./chatMessage/message/message.routes";
import ChatRoutes from "./chatMessage/chat/chat.routes";
import NotificationRoutes from "./notification/notification.routes";
import ReportRoutes from "./report/report.routes";
import PlanRoutes from "./paymentModule/planModule/plan.routes";
import SubscriptionRoutes from "./paymentModule/subscriptionModule/subscription.routes";
import { verifyAccessToken } from "./utils/generic/auth/auth.middleware";

const mainRoutes = express.Router();

// /api/users
mainRoutes.use("/users", userRoutes);

// /api/auth
mainRoutes.use("/auth", authRoutes);

// /api/follow
mainRoutes.use("/follow", verifyAccessToken, followRoutes);

// /api/stories
mainRoutes.use("/stories", verifyAccessToken, storyRoutes);

// /api/comments
mainRoutes.use("/comments", verifyAccessToken, commentRoutes);

// /api/posts
mainRoutes.use("/posts", verifyAccessToken, postRoutes);

// /api/likes
mainRoutes.use("/likes", verifyAccessToken, likeRoutes);

// /api/shares
mainRoutes.use("/shares", verifyAccessToken, shareRoutes);

// /api/savePost
mainRoutes.use("/savePost", verifyAccessToken, savePostRoutes);

// /api/setting
mainRoutes.use("/setting", verifyAccessToken, SettingRoutes);

// /api/search
mainRoutes.use("/search", verifyAccessToken, searchHistoryRoutes);

// /api/storyHighlights
mainRoutes.use("/storyHighlights", verifyAccessToken, storyHighlightsRoutes);

// /api/blocked-user
mainRoutes.use("/blocked-user", verifyAccessToken, blockedUserRoutes);

// /api/fileUpload
mainRoutes.use("/fileUpload", FileUploadRoutes);

// /api/snap
mainRoutes.use("/snap", verifyAccessToken, SnapRoutes);

// /api/message
mainRoutes.use("/message", verifyAccessToken, MessageRoutes);

// /api/chat
mainRoutes.use("/chat", verifyAccessToken, ChatRoutes);

// /api/notification
mainRoutes.use("/notification", verifyAccessToken, NotificationRoutes);

// /api/report
mainRoutes.use("/report", verifyAccessToken, ReportRoutes);

// /api/plan
mainRoutes.use("/plan", PlanRoutes);

// /api/subscription
mainRoutes.use("/subscription", SubscriptionRoutes);

export default mainRoutes;
