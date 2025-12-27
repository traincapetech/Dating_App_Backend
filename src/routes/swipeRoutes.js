import express from "express";
import { likeUser, getLikesReceived, getLikesCount, getDailyLikeInfo } from "../controllers/likeController.js";
import { passUser } from "../controllers/passController.js";

const router = express.Router();

// Swipe actions
router.post("/like", likeUser);
router.post("/pass", passUser);

// Likes received
router.get("/likes/:userId", getLikesReceived);
router.get("/likes-count/:userId", getLikesCount);

// Daily like info
router.get("/daily-likes/:userId", getDailyLikeInfo);

export default router;
