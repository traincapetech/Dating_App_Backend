import express from "express";
import { likeUser } from "../controllers/likeController.js";
import { passUser } from "../controllers/passController.js";

const router = express.Router();

router.post("/like", likeUser);
router.post("/pass", passUser);

export default router;