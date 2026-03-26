import { Router } from "express";
import {
  getAllChatsOfUser,
  deleteChatRoom,
  searchChatRoomByParticipants,
  acceptChatRequest,
  deleteChatRequest,
  createChat,
  addUsersToGroupChat,
  clearChatMessages,
  getAChat,
  pinChat,
  unpinChat,
  getChatProfileData,
  toggleMuteChat,
  leaveGroupChat,
  removeUserFromGroupChat,
} from "./chat.controller";

const ChatRoutes = Router();

// /api/chat/createChat
ChatRoutes.post("/createChat", createChat);

// /api/chat/getAllChatsOfUser
ChatRoutes.get("/getAllChatsOfUser", getAllChatsOfUser);

// /api/chat/deleteChat/:chatId
ChatRoutes.delete("/deleteChat/:chatId", deleteChatRoom);

// /api/chat/searchChatRoomByParticipants
ChatRoutes.post("/searchChatRoomByParticipants", searchChatRoomByParticipants);

// /api/chat/acceptChatRequest/:chatId
ChatRoutes.post("/acceptChatRequest/:chatId", acceptChatRequest);

// /api/chat/deleteChatRequest/:chatId
ChatRoutes.delete("/deleteChatRequest/:chatId", deleteChatRequest);

// /api/chat/addUsersToGroupChat/:chatId
ChatRoutes.post("/addUsersToGroupChat/:chatId", addUsersToGroupChat);

// /api/chat/removeUserFromGroupChat
ChatRoutes.put("/removeUserFromGroupChat", removeUserFromGroupChat);

// /api/chat/clearChatMessages/:chatId
ChatRoutes.delete("/clearChatMessages/:chatId", clearChatMessages);

// /api/chat/getAChat/:chatId
ChatRoutes.get("/getAChat/:chatId", getAChat);

// /api/chat/pinChat/:chatId
ChatRoutes.put("/pinChat/:chatId", pinChat);

// /api/chat/unpinChat/:chatId
ChatRoutes.put("/unpinChat/:chatId", unpinChat);

// /api/chat/getChatProfileData
ChatRoutes.post("/getChatProfileData", getChatProfileData);

// /api/chat/toggleMuteChat/:chatId
ChatRoutes.put("/toggleMuteChat/:chatId", toggleMuteChat);

// /api/chat/leaveGroupChat/:chatId
ChatRoutes.put("/leaveGroupChat/:chatId", leaveGroupChat);

export default ChatRoutes;
