const { Server } = require("socket.io");
const RoomManager = require("../roomManager");
const GameManager = require("../gameManager");
const Room = require("../models/Room");

class GameSocketManager {
  constructor(server) {
    this.io = new Server(server, {
      cors: {
        origin: process.env.CLIENT_URL || "*",
        methods: ["GET", "POST"],
        credentials: true
      },
      transports: ["websocket"],
      pingTimeout: 60000,
      pingInterval: 25000,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
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
          room = RoomManager.getRoom(roomCode);
          if (!room) {
            socket.emit("error", "Room not found");
            return;
          }

          // Check if room is full
          if (room.activePlayers >= room.maxPlayers) {
            socket.emit("error", "Room is full");
            return;
          }

          socket.join(roomCode);
          this.socketToRoom.set(socket.id, room);
          socket.emit("youJoined", { playerId: socket.id, roomCode });
          console.log(`${room.gameStatus} is the status of ${roomCode}`);

          // Initialize GameManager when first player joins
          if (!this.rooms.has(roomCode)) {
            console.log(`Creating new GameManager for room ${roomCode}`);
            const gameManager = new GameManager(roomCode, socket.id, this.io);
            this.rooms.set(roomCode, gameManager);
          } else {
            // Add second player to existing GameManager
            const gameManager = this.rooms.get(roomCode);
            if (gameManager) {
              gameManager.addPlayer(socket.id);
            }
          }

          if (room.gameStatus === "Ready") {
            console.log(`${roomCode} game is ready with ${room.players}`);
            this.StartGameCountdown(room);
          }
        } catch (error) {
          console.error("Error in joinRoom:", error);
          socket.emit("error", "Failed to join room");
        }
      });

      // Register paddle movement events for all connected sockets
      socket.on("PADDLE_UP", () => {
        const room = this.socketToRoom.get(socket.id);
        if (!room) {
          return;
        }
        const roomCode = room.roomCode;
        if (!roomCode) return;

        const gameManager = this.rooms.get(roomCode);
        if (!gameManager) return;

        let object = {
          movePaddleUp: true,
          movePaddleDown: false,
        };
        gameManager.updatePaddle(socket.id, object);
      });

      socket.on("PADDLE_DOWN", () => {
        const room = this.socketToRoom.get(socket.id);
        if (!room) {
          return;
        }
        const roomCode = room.roomCode;
        if (!roomCode) return;

        const gameManager = this.rooms.get(roomCode);
        if (!gameManager) return;

        let object = {
          movePaddleUp: false,
          movePaddleDown: true,
        };
        gameManager.updatePaddle(socket.id, object);
      });

      socket.on("PADDLE_STOP", () => {
        const room = this.socketToRoom.get(socket.id);
        if (!room) {
          return;
        }
        const roomCode = room.roomCode;
        if (!roomCode) return;

        const gameManager = this.rooms.get(roomCode);
        if (!gameManager) return;

        let object = {
          movePaddleUp: false,
          movePaddleDown: false,
        };
        gameManager.updatePaddle(socket.id, object);
      });

      socket.on("disconnect", () => {
        const room = this.socketToRoom.get(socket.id);

        // Always clean up socketToRoom mapping
        this.socketToRoom.delete(socket.id);

        if (!room) return;

        const roomCode = room.roomCode;
        const gameManager = this.rooms.get(roomCode);
        
        if (!gameManager) return;

        console.log(`Socket ${socket.id} disconnected from ${roomCode}`);

        // Clear countdown timers BEFORE calling destroy
        if (gameManager.countdownInterval) {
          clearInterval(gameManager.countdownInterval);
          gameManager.countdownInterval = null;
        }
        if (gameManager.initialTimeout) {
          clearTimeout(gameManager.initialTimeout);
          gameManager.initialTimeout = null;
        }

        // Notify the remaining player
        const opponentId =
          gameManager.player1 === socket.id
            ? gameManager.player2
            : gameManager.player1;

        if (opponentId) {
          this.io
            .to(opponentId)
            .emit("playerLeft", "Your opponent has disconnected.");
          
          // Clean up opponent's socketToRoom mapping
          this.socketToRoom.delete(opponentId);
        }

        // Stop the game and clean up
        gameManager.destroy(); // Clears intervals, timeouts, and resets game state

        // Remove the game room from active rooms
        this.rooms.delete(roomCode);
        
        
        ("Active Rooms -> ", this.rooms);  
        console.log(`Room ${roomCode} deleted after player disconnection.`);
        
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