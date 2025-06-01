const { Server } = require("socket.io");
const RoomManager = require("../roomManager");
const GameManager = require("../gameManager");
const Room = require("../models/Room");
 
const SERVER_URL = "https://paddleroyale-winter-sky-6525.fly.dev";
class GameSocketManager {
  constructor(server) {
    this.io = new Server(server, {
      cors: {
        origin: "https://paddleroyale-winter-sky-6525.fly.dev", // Just the HTTPS origin
        methods: ["GET", "POST"],
        credentials: true
      },
      transports: ["websocket", "polling"],
      path: "/socket.io/", // Explicitly set the path
      pingTimeout: 60000,
      pingInterval: 25000,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      // Additional production-ready settings:
      allowEIO3: true, // For backwards compatibility
      cookie: {
        name: "io",
        path: "/",
        httpOnly: true,
        sameSite: "lax"
      }
    });
    this.rooms = new Map();
    this.socketToRoom = new Map();
    this.setupSocketEvents();
  }
 
  setupSocketEvents() {
    this.io.on("connection", (socket) => {
      console.log("New socket connection made on ", socket.id);
      let room;
 
      // Handle reconnection
      socket.on("reconnect_attempt", () => {
        console.log(`Socket ${socket.id} attempting to reconnect`);
      });
 
      socket.on("reconnect", () => {
        console.log(`Socket ${socket.id} reconnected`);
        // Rejoin room if needed
        const previousRoom = this.socketToRoom.get(socket.id);
        if (previousRoom) {
          socket.join(previousRoom.roomCode);
        }
      });
 
      socket.on("joinRoom", (roomCode) => {
        try {
          console.log(`Socket ${socket.id} attempting to join room: ${roomCode}`);
          room = RoomManager.getRoom(roomCode);
          if (!room) {
            console.warn(`Room ${roomCode} not found for socket ${socket.id}`);
            socket.emit("error", "Room not found");
            return;
          }
 
          // Check if room is full
          if (room.activePlayers >= room.maxPlayers) {
            console.warn(`Room ${roomCode} is full. Socket ${socket.id} cannot join.`);
            socket.emit("error", "Room is full");
            return;
          }
 
          socket.join(roomCode);
          this.socketToRoom.set(socket.id, room);
          socket.emit("youJoined", { playerId: socket.id, roomCode });
          console.log(`Socket ${socket.id} successfully joined room: ${roomCode}`);
          console.log(`Room ${roomCode} game status: ${room.gameStatus}`);
 
          // Initialize GameManager when first player joins
          if (!this.rooms.has(roomCode)) {
            console.log(`Creating new GameManager for room ${roomCode} with player ${socket.id}`);
            const gameManager = new GameManager(roomCode, socket.id, this.io);
            this.rooms.set(roomCode, gameManager);
          } else {
            // Add second player to existing GameManager
            const gameManager = this.rooms.get(roomCode);
            if (gameManager) {
              console.log(`Adding second player ${socket.id} to existing GameManager for room ${roomCode}`);
              gameManager.addPlayer(socket.id);
            } else {
               console.error(`GameManager not found for existing room ${roomCode} when adding second player ${socket.id}`);
               socket.emit("error", "Internal server error: GameManager not found");
            }
          }
 
          if (room.gameStatus === "Ready") {
            console.log(`Room ${roomCode} game is ready with players: ${room.players}`);
            this.StartGameCountdown(room);
          }
        } catch (error) {
          console.error(`Error in joinRoom for socket ${socket.id} and room ${roomCode}:`, error);
          socket.emit("error", "Failed to join room");
        }
      });
 
      // Register paddle movement events for all connected sockets
      socket.on("PADDLE_UP", () => {
        try {
          const room = this.socketToRoom.get(socket.id);
          if (!room) {
            console.warn(`PADDLE_UP received from socket ${socket.id} but no room found in socketToRoom map.`);
            return;
          }
          const roomCode = room.roomCode;
          if (!roomCode) {
             console.warn(`PADDLE_UP received from socket ${socket.id} but roomCode is missing.`);
             return;
          }
 
          const gameManager = this.rooms.get(roomCode);
          if (!gameManager) {
             console.warn(`PADDLE_UP received from socket ${socket.id} for room ${roomCode} but GameManager not found.`);
             return;
          }
 
          let object = {
            movePaddleUp: true,
            movePaddleDown: false,
          };
          gameManager.updatePaddle(socket.id, object);
          // console.log(`PADDLE_UP for socket ${socket.id} in room ${roomCode}`); // Optional: log every paddle move (can be noisy)
        } catch (error) {
           console.error(`Error handling PADDLE_UP for socket ${socket.id}:`, error);
        }
      });
 
      socket.on("PADDLE_DOWN", () => {
        try {
          const room = this.socketToRoom.get(socket.id);
          if (!room) {
            console.warn(`PADDLE_DOWN received from socket ${socket.id} but no room found in socketToRoom map.`);
            return;
          }
          const roomCode = room.roomCode;
          if (!roomCode) {
            console.warn(`PADDLE_DOWN received from socket ${socket.id} but roomCode is missing.`);
            return;
          }
 
          const gameManager = this.rooms.get(roomCode);
          if (!gameManager) {
            console.warn(`PADDLE_DOWN received from socket ${socket.id} for room ${roomCode} but GameManager not found.`);
            return;
          }
 
          let object = {
            movePaddleUp: false,
            movePaddleDown: true,
          };
          gameManager.updatePaddle(socket.id, object);
          // console.log(`PADDLE_DOWN for socket ${socket.id} in room ${roomCode}`); // Optional: log every paddle move (can be noisy)
        } catch (error) {
          console.error(`Error handling PADDLE_DOWN for socket ${socket.id}:`, error);
        }
      });
 
      socket.on("PADDLE_STOP", () => {
        try {
          const room = this.socketToRoom.get(socket.id);
          if (!room) {
            console.warn(`PADDLE_STOP received from socket ${socket.id} but no room found in socketToRoom map.`);
            return;
          }
          const roomCode = room.roomCode;
          if (!roomCode) {
             console.warn(`PADDLE_STOP received from socket ${socket.id} but roomCode is missing.`);
             return;
          }
 
          const gameManager = this.rooms.get(roomCode);
          if (!gameManager) {
             console.warn(`PADDLE_STOP received from socket ${socket.id} for room ${roomCode} but GameManager not found.`);
             return;
          }
 
          let object = {
            movePaddleUp: false,
            movePaddleDown: false,
          };
          gameManager.updatePaddle(socket.id, object);
          // console.log(`PADDLE_STOP for socket ${socket.id} in room ${roomCode}`); // Optional: log every paddle move (can be noisy)
        } catch (error) {
          console.error(`Error handling PADDLE_STOP for socket ${socket.id}:`, error);
        }
      });
 
      socket.on("disconnect", () => {
        console.log(`Socket ${socket.id} disconnected.`);
        const room = this.socketToRoom.get(socket.id);
 
        // Always clean up socketToRoom mapping
        this.socketToRoom.delete(socket.id);
 
        if (!room) {
           console.log(`Socket ${socket.id} disconnected, but was not in a known room.`);
           return;
        }
 
        const roomCode = room.roomCode;
        const gameManager = this.rooms.get(roomCode);
 
        if (!gameManager) {
           console.warn(`Socket ${socket.id} disconnected from room ${roomCode}, but GameManager not found.`);
           return;
        }
 
        console.log(`Socket ${socket.id} disconnected from room ${roomCode}. Cleaning up.`);
 
        // Clear countdown timers BEFORE calling destroy
        if (gameManager.countdownInterval) {
          console.log(`Clearing countdown interval for room ${roomCode}`);
          clearInterval(gameManager.countdownInterval);
          gameManager.countdownInterval = null;
        }
        if (gameManager.initialTimeout) {
          console.log(`Clearing initial timeout for room ${roomCode}`);
          clearTimeout(gameManager.initialTimeout);
          gameManager.initialTimeout = null;
        }
 
        // Notify the remaining player
        const opponentId =
          gameManager.player1 === socket.id
            ? gameManager.player2
            : gameManager.player1;
 
        if (opponentId) {
          console.log(`Notifying opponent ${opponentId} in room ${roomCode} about disconnection.`);
          this.io
            .to(opponentId)
            .emit("playerLeft", "Your opponent has disconnected.");
 
          // Clean up opponent's socketToRoom mapping - This might be problematic if the opponent is still connected but needs their mapping updated.
          // It's usually better to only delete the disconnected socket's mapping.
          // Let's remove this line unless there's a specific reason for it.
          // this.socketToRoom.delete(opponentId);
        }
 
        // Stop the game and clean up
        gameManager.destroy(); // Clears intervals, timeouts, and resets game state
 
        // Remove the game room from active rooms
        this.rooms.delete(roomCode);
        console.log(`Room ${roomCode} deleted after player disconnection. Active Rooms count: ${this.rooms.size}`);
 
      });
    });
  }
 
  StartGameCountdown(room) {
    let roomCode = room.roomCode;
    this.io.to(roomCode).emit("CountDownUpdate", "May the best player Win");
    let countdown = 3;
 
    const initialTimeout = setTimeout(() => {
      // Double-check room still exists before starting countdown
      if (!this.rooms.has(roomCode)) {
        return;
      }
 
      const countdownInterval = setInterval(() => {
        // Check if room still exists (players might have left)
        if (!this.rooms.has(roomCode)) {
          clearInterval(countdownInterval);
          return;
        }
 
        this.io.to(roomCode).emit("CountDownUpdate", countdown);
        countdown--;
 
        if (countdown < 0) {
          clearInterval(countdownInterval);
          let gameManager = this.rooms.get(roomCode);
          if (gameManager) {
            // Clear the reference since we're done with it
            gameManager.countdownInterval = null;
            gameManager.setupGameLoop();
          }
        }
      }, 700);
 
      // Store for cleanup on disconnect
      const gameManager = this.rooms.get(roomCode);
      if (gameManager) {
        gameManager.countdownInterval = countdownInterval;
      }
    }, 900);
 
    // Store the timeout reference
    const gameManager = this.rooms.get(roomCode);
    if (gameManager) {
      gameManager.initialTimeout = initialTimeout;
    }
  }
}
 
module.exports = GameSocketManager;