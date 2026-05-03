import pool from "../config/db.js";

async function getAllRooms(req, res) {
  try {
    const result = await pool.query(`
      SELECT id, room_code, building, capacity, is_active
      FROM rooms
      ORDER BY room_code ASC
    `);

    return res.status(200).json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error("Get rooms error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch rooms",
      error: error.message,
    });
  }
}

async function getRoomById(req, res) {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      SELECT id, room_code, building, capacity, is_active
      FROM rooms
      WHERE id = $1
      `,
      [id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Room not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Get room by id error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch room",
      error: error.message,
    });
  }
}

async function createRoom(req, res) {
  try {
    const {
      room_code: roomCode,
      building = "",
      capacity,
      is_active: isActive = true,
    } = req.body ?? {};

    if (!roomCode || !String(roomCode).trim()) {
      return res.status(400).json({
        success: false,
        message: "room_code is required",
      });
    }

    const parsedCapacity = Number.parseInt(capacity, 10);

    if (Number.isNaN(parsedCapacity) || parsedCapacity <= 0) {
      return res.status(400).json({
        success: false,
        message: "capacity must be a positive number",
      });
    }

    const result = await pool.query(
      `
      INSERT INTO rooms (room_code, building, capacity, is_active)
      VALUES ($1, $2, $3, $4)
      RETURNING id, room_code, building, capacity, is_active
      `,
      [
        String(roomCode).trim(),
        String(building).trim(),
        parsedCapacity,
        Boolean(isActive),
      ],
    );

    return res.status(201).json({
      success: true,
      message: "Room created successfully",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Create room error:", error);

    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "Room code already exists",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to create room",
      error: error.message,
    });
  }
}

async function updateRoom(req, res) {
  try {
    const { id } = req.params;
    const {
      room_code: roomCode,
      building = "",
      capacity,
      is_active: isActive = true,
    } = req.body ?? {};

    if (!roomCode || !String(roomCode).trim()) {
      return res.status(400).json({
        success: false,
        message: "room_code is required",
      });
    }

    const parsedCapacity = Number.parseInt(capacity, 10);

    if (Number.isNaN(parsedCapacity) || parsedCapacity <= 0) {
      return res.status(400).json({
        success: false,
        message: "capacity must be a positive number",
      });
    }

    const result = await pool.query(
      `
      UPDATE rooms
      SET room_code = $1,
          building = $2,
          capacity = $3,
          is_active = $4,
          updated_at = NOW()
      WHERE id = $5
      RETURNING id, room_code, building, capacity, is_active
      `,
      [
        String(roomCode).trim(),
        String(building).trim(),
        parsedCapacity,
        Boolean(isActive),
        id,
      ],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Room not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Room updated successfully",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Update room error:", error);

    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "Room code already exists",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to update room",
      error: error.message,
    });
  }
}

async function toggleRoomActive(req, res) {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      UPDATE rooms
      SET is_active = NOT is_active,
          updated_at = NOW()
      WHERE id = $1
      RETURNING id, room_code, building, capacity, is_active
      `,
      [id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Room not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Room active status updated successfully",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Toggle room active error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to toggle room status",
      error: error.message,
    });
  }
}

async function deleteRoom(req, res) {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      DELETE FROM rooms
      WHERE id = $1
      RETURNING id, room_code
      `,
      [id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Room not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Room deleted successfully",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Delete room error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete room",
      error: error.message,
    });
  }
}

export {
  getAllRooms,
  getRoomById,
  createRoom,
  updateRoom,
  toggleRoomActive,
  deleteRoom,
};
