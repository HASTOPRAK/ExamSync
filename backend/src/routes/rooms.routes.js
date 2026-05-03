import express from "express";
import {
  getAllRooms,
  getRoomById,
  createRoom,
  updateRoom,
  toggleRoomActive,
  deleteRoom,
} from "../controllers/rooms.controller.js";

const router = express.Router();

router.get("/", getAllRooms);
router.get("/:id", getRoomById);
router.post("/", createRoom);
router.put("/:id", updateRoom);
router.patch("/:id/toggle-active", toggleRoomActive);
router.delete("/:id", deleteRoom);

export default router;
