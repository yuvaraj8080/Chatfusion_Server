import { Router } from "express";
import {
  savePostsInCollection,
  getAllCollections,
  deleteCollection,
  getAllPostsInCollection,
  removePostsFromCollection,
  createCollection,
} from "./savepost.controller";

const savePostRoutes = Router();

// /api/savePost/createCollection
savePostRoutes.post("/createCollection", createCollection);

// /api/savePost/savePostsInCollection
savePostRoutes.post("/savePostsInCollection", savePostsInCollection);

// /api/savePost/getAllCollections
savePostRoutes.get("/getAllCollections", getAllCollections);

// /api/savePost/deleteCollection/:collectionName
savePostRoutes.delete("/deleteCollection/:collectionName", deleteCollection);

// /api/savePost/getAllPostsInCollection/:collectionName
savePostRoutes.get(
  "/getAllPostsInCollection/:collectionName",
  getAllPostsInCollection
);

// /api/savePost/removePostsFromCollection
savePostRoutes.put("/removePostsFromCollection", removePostsFromCollection);

export default savePostRoutes;
