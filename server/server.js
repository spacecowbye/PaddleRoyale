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
app.use(express.static(path.join(__dirname, 'public')));
app.use(cors());

app.post("/create-room", (req, res) => {
  const room = roomManager.createRoom();
  res.status(201).json(room);
});

app.post("/join-room/:roomCode", (req, res) => {
  const {socketId} = req.body;
  const { roomCode } = req.params;
  const room = roomManager.Rooms.get(roomCode);
  
  if (!room) {
    return res.status(400).json({ error: "No such Room" });
  }
  if (room.activePlayers === room.maxPlayers) {
    return res.status(403).json({ error: "Room is full" });
  }

  // If this is just a pre-validation check (socketId is 'pre-validate')
  if (socketId === 'pre-validate') {
    return res.status(200).json({ message: "Room exists and is available" });
  }

  // Otherwise, proceed with actual room joining
  const updatedRoom = roomManager.joinRoom(roomCode, socketId);
  if (!updatedRoom) {
    return res.status(500).json({ error: "Failed to join room" });
  }

  console.log(updatedRoom);
  res.status(201).json(updatedRoom);
});


server.listen(PORT, () => {
  console.log(`Server Started on Port ${PORT}`);
});
