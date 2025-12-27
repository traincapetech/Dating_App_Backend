import express from "express";
import { getUserMatches, getMatchById, createMatch, unmatch } from "../controllers/matchController.js";

const router = express.Router();

// Get all matches for a user
router.get("/:userId", getUserMatches);

// Get a specific match by ID
router.get("/detail/:matchId", getMatchById);

// Create a new match
router.post("/", createMatch);

// Unmatch (disable chat)
router.post("/:matchId/unmatch", unmatch);

export default router;
