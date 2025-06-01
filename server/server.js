const express = require("express");
const { createServer } = require("node:http");
const { Server } = require("socket.io");
const dotenv = require("dotenv");
const path = require("path");
const cors = require("cors");
const { v4: uuidv4 } = require("uuid");


const roomManager = require("./roomManager");
const GameSocketManager = require("./config/socket");





dotenv.config();
const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 8080;
const gameSocketManager = new GameSocketManager(server);





app.use(express.json());
app.use(express.static(path.join(__dirname, "../public")));
app.use(cors());

app.post("/create-room", (req, res) => {
  const room = roomManager.createRoom();
  res.status(201).json(room);
});

app.post("/join-room/:roomCode", async(req, res) => {
  const {socketId} = req.body;
  const { roomCode } = req.params;
  
  try {
    const room = roomManager.Rooms.get(roomCode);
    
    if (!room) {
      return res.status(400).json({ error: "No such Room" });
    }

    // Add a lock mechanism to prevent race conditions
    if (room.isJoining) {
      return res.status(409).json({ error: "Room is currently being joined by another player" });
    }

    room.isJoining = true;

    try {
      if (room.activePlayers >= room.maxPlayers) {
        room.isJoining = false;
        return res.status(403).json({ error: "Room is full" });
      }

      // If this is just a pre-validation check
      if (socketId === 'pre-validate') {
        room.isJoining = false;
        return res.status(200).json({ message: "Room exists and is available" });
      }

      // Proceed with actual room joining
      const updatedRoom = roomManager.joinRoom(roomCode, socketId);
      if (!updatedRoom) {
        room.isJoining = false;
        return res.status(500).json({ error: "Failed to join room" });
      }

      console.log(`Player ${socketId} joined room ${roomCode}. Active players: ${updatedRoom.activePlayers}`);
      res.status(201).json(updatedRoom);
    } finally {
      room.isJoining = false;
    }
  } catch (error) {
    console.error('Error joining room:', error);
    res.status(500).json({ error: "Internal server error" });
  }
});


server.listen(PORT, () => {
  console.log(`Server Started on Port ${PORT}`);
});
