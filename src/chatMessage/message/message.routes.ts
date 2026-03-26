import { Router } from "express";
import {
  getAllMessagesOfChat,
  deleteMessage,
  createNewMessage,
} from "./message.controller";

const MessageRoutes = Router();

// /api/message/createNewMessage
MessageRoutes.post("/createNewMessage", createNewMessage);

// /api/message/markMessagesAsViewed
// MessageRoutes.post("/markMessagesAsViewed", markMessagesAsViewed);

// /api/message/getAllMessagesOfChat/:chatId
MessageRoutes.get("/getAllMessagesOfChat/:chatId", getAllMessagesOfChat);

// /api/message/deleteMessage/:messageId
MessageRoutes.delete("/deleteMessage/:messageId", deleteMessage);

export default MessageRoutes;
