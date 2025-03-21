const express = require("express");
const { createServer } = require("node:http");
const { Server } = require("socket.io");
const dotenv = require("dotenv");
const path = require("path");
const cors = require("cors");
const { v4: uuidv4 } = require("uuid");


const RoomManager = require("./roomManager");
const GameSocketManager = require("./config/socket");





dotenv.config();
const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 8080;
const roomManager = new RoomManager();
const gameSocketManager = new GameSocketManager(server);





app.use(express.json());
app.use(express.static(path.join(__dirname, "../public")));
app.use(cors());

app.post("/create-room", (req, res) => {
  const room = roomManager.createRoom();
  res.status(201).json(room);
});

app.post("/join-room/:roomCode", (req, res) => {
  const player = uuidv4();
  const { roomCode } = req.params;
  const room = roomManager.Rooms.get(roomCode);
  
  if (!room) {
    return res.status(400).json({ error: "No such Room" });
  }
  if (room.activePlayers === room.maxPlayers) {
    return res.status(403).json({ error: "Room is full" });
  }
  const updatedRoom = roomManager.joinRoom(roomCode, player);

  if (!updatedRoom) {
    return res.status(500).json({ error: "Failed to join room" });
  }

  console.log(updatedRoom);
  res.status(201).json(updatedRoom);
});


server.listen(PORT, () => {
  console.log(`Server Started on Port ${PORT}`);
});
