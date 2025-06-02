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

// --- GLOBAL UNHANDLED EXCEPTION HANDLER ---
process.on('uncaughtException', (err) => {
    console.error('--- UNCAUGHT EXCEPTION ---');
    console.error('Error stack:', err.stack); // Log the stack trace
    console.error('Error message:', err.message); // Log the error message
    // If you have Winston/Bunyan, use that for logging here.
    // For debugging, keep the process alive briefly to flush logs, then exit.
    setTimeout(() => {
        process.exit(1);
    }, 1000); // Give 1 second for logs to flush
});

// --- GLOBAL UNHANDLED REJECTION HANDLER (for Promises) ---
process.on('unhandledRejection', (reason, promise) => {
    console.error('--- UNHANDLED REJECTION ---');
    console.error('Reason:', reason);
    console.error('Promise:', promise);
    // Again, log and consider a graceful shutdown or exit.
    setTimeout(() => {
        process.exit(1);
    }, 1000); // Give 1 second for logs to flush
});
// --- END GLOBAL ERROR HANDLERS ---

const gameSocketManager = new GameSocketManager(server); // This is a common place for an error to occur if 'server' isn't what GameSocketManager expects


app.use(express.json());
app.use(express.static(path.join(__dirname, "public"), { index: 'index.html' }));
app.use(cors());


// --- TEMPORARY DEBUG ROUTE (Re-add this for now to confirm routing after service stays alive) ---
// If you see this in the browser, it means index.html is still not being served by static.
app.get('/', (req, res) => {
  console.log('--- DEBUG: GET / request hit fallback route. express.static did not serve index.html. ---');
  res.status(200).send('<h1>DEBUG: Server is running! express.static did not serve index.html.</h1><p>Check public folder contents, permissions, or if index.html is truly at the root of public.</p>');
});
// --- END TEMPORARY DEBUG ROUTE ---


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
  console.log("Please work"); // This will definitely be logged if the server starts.
  // Add a small delay to see if the process stays alive.
  setTimeout(() => {
      console.log('Server process is still alive after 10 seconds.');
  }, 10000); // Check after 10 seconds
});

// Also consider adding an error listener to the server itself
server.on('error', (error) => {
    console.error('--- HTTP Server Error from server.on("error") listener ---');
    console.error(error);
});