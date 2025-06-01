const { Server } = require("socket.io");
const RoomManager = require("../roomManager");
const GameManager = require("../gameManager");

class GameSocketManager {
  constructor(server) {
    this.io = new Server(server, {
      cors: {
        origin: [
          "https://paddleroyale-winter-sky-6525.fly.dev",
          "http://localhost:3000", // Keep for local development
          "http://localhost:5173"  // Common Vite dev server port
        ],
        methods: ["GET", "POST"],
        credentials: true
      },
      // CRITICAL: Ensure polling is prioritized for Fly.io compatibility
      transports: ["polling", "websocket"], // Polling first, then websocket
      // Add these options for better Fly.io compatibility
      allowEIO3: true,
      pingTimeout: 60000,
      pingInterval: 25000,
      upgradeTimeout: 30000,
      // Force long polling initially to establish connection
      forceNew: true
    });
    
    this.rooms = new Map();
    this.socketToRoom = new Map();
    this.setupSocketEvents();
  }

  setupSocketEvents() {
    this.io.on("connection", (socket) => {
      console.log(`[Socket Connected] New socket ID: ${socket.id}, Transport: ${socket.conn.transport.name}`);
      
      // Log transport upgrades
      socket.conn.on("upgrade", () => {
        console.log(`[Socket ${socket.id}] Upgraded to transport: ${socket.conn.transport.name}`);
      });

      // Add connection error handling
      socket.on("connect_error", (error) => {
        console.error(`[Socket ${socket.id}] Connection error:`, error);
      });

      const roomCode = socket.handshake.query.room;

      if (!roomCode) {
        console.warn(`[Socket ${socket.id}] Connected without a roomCode. Disconnecting.`);
        socket.emit("error", "Room code is missing. Please join via a valid room link.");
        socket.disconnect(true);
        return;
      }

      console.log(`[Socket ${socket.id}] Attempting to join room: ${roomCode}`);

      const room = RoomManager.getRoom(roomCode);
      if (!room) {
        console.warn(`[Socket ${socket.id}] Room ${roomCode} not found. Disconnecting.`);
        socket.emit("roomNotFound", roomCode);
        socket.disconnect(true);
        return;
      }

      if (room.activePlayers >= room.maxPlayers) {
        console.warn(`[Socket ${socket.id}] Room ${roomCode} is full. Disconnecting.`);
        socket.emit("roomFull", roomCode);
        socket.disconnect(true);
        return;
      }

      // Add player to room with better error handling
      try {
        if (!room.players.includes(socket.id)) {
          if (room.players.length < room.maxPlayers) {
            room.addPlayer(socket.id);
            console.log(`[Socket ${socket.id}] Added to room ${roomCode}. Players: ${room.players.length}`);
          } else {
            console.warn(`[Socket ${socket.id}] Room ${roomCode} full during add attempt.`);
            socket.emit("roomFull", roomCode);
            socket.disconnect(true);
            return;
          }
        }
      } catch (error) {
        console.error(`[Socket ${socket.id}] Error adding to room:`, error);
        socket.emit("error", "Failed to join room");
        socket.disconnect(true);
        return;
      }
      
      socket.join(roomCode);
      this.socketToRoom.set(socket.id, room);
      
      // Send confirmation with retry logic
      const confirmJoin = () => {
        socket.emit("youJoined", { 
          playerId: socket.id, 
          roomCode,
          transport: socket.conn.transport.name 
        });
      };
      
      confirmJoin();
      
      // Retry confirmation after short delay if needed
      setTimeout(() => {
        if (socket.connected) {
          socket.emit("connectionStable", { playerId: socket.id });
        }
      }, 1000);

      // GameManager handling with better error checking
      let gameManager = this.rooms.get(roomCode);
      
      try {
        if (!gameManager) {
          console.log(`[Room ${roomCode}] Creating new GameManager.`);
          gameManager = new GameManager(roomCode, socket.id, this.io);
          this.rooms.set(roomCode, gameManager);
        } else {
          console.log(`[Room ${roomCode}] Adding player to existing GameManager.`);
          gameManager.addPlayer(socket.id);
        }
      } catch (error) {
        console.error(`[Room ${roomCode}] GameManager error:`, error);
        socket.emit("error", "Game initialization failed");
        return;
      }
      
      console.log(`[Room ${roomCode}] Status: ${room.gameStatus}, Active: ${room.activePlayers}`);

      if (room.gameStatus === "Ready") {
        console.log(`[Room ${roomCode}] Starting countdown.`);
        this.StartGameCountdown(room);
      }

      // Paddle events with error handling
      const handlePaddleEvent = (eventType, paddleState) => {
        try {
          const currentRoom = this.socketToRoom.get(socket.id);
          if (!currentRoom) {
            console.warn(`[Socket ${socket.id}] No room found for paddle event ${eventType}`);
            return;
          }
          
          const gameManagerInstance = this.rooms.get(currentRoom.roomCode);
          if (!gameManagerInstance) {
            console.warn(`[Socket ${socket.id}] No GameManager for paddle event ${eventType}`);
            return;
          }

          gameManagerInstance.updatePaddle(socket.id, paddleState);
        } catch (error) {
          console.error(`[Socket ${socket.id}] Paddle event ${eventType} error:`, error);
        }
      };

      socket.on("PADDLE_UP", () => {
        handlePaddleEvent("PADDLE_UP", {
          movePaddleUp: true,
          movePaddleDown: false,
        });
      });

      socket.on("PADDLE_DOWN", () => {
        handlePaddleEvent("PADDLE_DOWN", {
          movePaddleUp: false,
          movePaddleDown: true,
        });
      });

      socket.on("PADDLE_STOP", () => {
        handlePaddleEvent("PADDLE_STOP", {
          movePaddleUp: false,
          movePaddleDown: false,
        });
      });

      // Enhanced disconnect handling
      socket.on("disconnect", (reason) => {
        console.log(`[Socket Disconnected] ${socket.id}, Reason: ${reason}`);
        this.handleDisconnect(socket.id, reason);
      });

      // Add error event handler
      socket.on("error", (error) => {
        console.error(`[Socket ${socket.id}] Socket error:`, error);
      });
    });

    // Add server-level error handling
    this.io.engine.on("connection_error", (err) => {
      console.error("Socket.IO connection error:", err);
    });
  }

  handleDisconnect(socketId, reason) {
    const roomDisconnectedFrom = this.socketToRoom.get(socketId);
    this.socketToRoom.delete(socketId);

    if (!roomDisconnectedFrom) {
      console.log(`[Socket ${socketId}] Disconnected from unknown room.`);
      return;
    }

    const roomCode = roomDisconnectedFrom.roomCode;
    const gameManager = this.rooms.get(roomCode);

    // Clean up room
    try {
      const playerIndex = roomDisconnectedFrom.players.indexOf(socketId);
      if (playerIndex > -1) {
        roomDisconnectedFrom.players.splice(playerIndex, 1);
        roomDisconnectedFrom.activePlayers = roomDisconnectedFrom.players.length;
        
        if (roomDisconnectedFrom.activePlayers < roomDisconnectedFrom.maxPlayers && 
            roomDisconnectedFrom.gameStatus === "InProgress") {
          roomDisconnectedFrom.gameStatus = "Waiting";
        }
        
        console.log(`[Room ${roomCode}] Player removed. Remaining: ${roomDisconnectedFrom.activePlayers}`);
      }
    } catch (error) {
      console.error(`[Room ${roomCode}] Error removing player:`, error);
    }

    if (!gameManager) {
      console.log(`[Room ${roomCode}] No GameManager found for disconnect.`);
      return;
    }

    // Clear timers
    if (gameManager.countdownInterval) {
      clearInterval(gameManager.countdownInterval);
      gameManager.countdownInterval = null;
    }
    if (gameManager.initialTimeout) {
      clearTimeout(gameManager.initialTimeout);
      gameManager.initialTimeout = null;
    }

    // Remove from GameManager
    try {
      if (typeof gameManager.removePlayer === 'function') {
        gameManager.removePlayer(socketId);
      }
    } catch (error) {
      console.error(`[Room ${roomCode}] Error removing from GameManager:`, error);
    }

    // Handle remaining players
    if (gameManager.players && gameManager.players.length > 0) {
      let opponentId = null;
      if (gameManager.player1 && gameManager.player1 !== socketId) {
        opponentId = gameManager.player1;
      } else if (gameManager.player2 && gameManager.player2 !== socketId) {
        opponentId = gameManager.player2;
      }

      if (opponentId) {
        this.io.to(opponentId).emit("playerLeft", "Your opponent has disconnected. Game ended.");
        console.log(`[Room ${roomCode}] Notified opponent ${opponentId}.`);
        
        // Optional: Don't force disconnect opponent, let them stay in room
        // this.socketToRoom.delete(opponentId);
        // const opponentSocket = this.io.sockets.sockets.get(opponentId);
        // if (opponentSocket) {
        //   opponentSocket.disconnect(true);
        // }
      }
    }
    
    // Clean up if no players remain
    if (roomDisconnectedFrom.activePlayers === 0) {
      try {
        if (gameManager.destroy) {
          gameManager.destroy();
        }
        this.rooms.delete(roomCode);
        RoomManager.deleteRoom(roomCode);
        console.log(`[Room ${roomCode}] Fully cleaned up.`);
      } catch (error) {
        console.error(`[Room ${roomCode}] Cleanup error:`, error);
      }
    } else {
      roomDisconnectedFrom.gameStatus = "Waiting";
      this.io.to(roomCode).emit("opponentDisconnected", "Waiting for another player to join.");
    }
  }

  StartGameCountdown(room) {
    const roomCode = room.roomCode;
    const gameManager = this.rooms.get(roomCode);
    
    if (!gameManager) {
      console.warn(`[Countdown] No GameManager for room ${roomCode}.`);
      return;
    }

    console.log(`[Room ${roomCode}] Starting countdown.`);
    
    // Use more reliable emit with acknowledgment
    this.io.to(roomCode).emit("CountDownUpdate", "May the best player Win");
    
    let countdown = 3;

    gameManager.initialTimeout = setTimeout(() => {
      const currentRoomInRm = RoomManager.getRoom(roomCode);
      
      if (!this.rooms.has(roomCode) || !gameManager || !currentRoomInRm || currentRoomInRm.activePlayers < 2) {
        console.warn(`[Room ${roomCode}] Aborting countdown: insufficient players.`);
        gameManager.initialTimeout = null;
        
        if (currentRoomInRm && currentRoomInRm.players.length > 0) {
          this.io.to(roomCode).emit("countdownAborted", "Not enough players to start game.");
        }
        return;
      }

      const countdownInterval = setInterval(() => {
        const currentRoomInRm = RoomManager.getRoom(roomCode);
        
        if (!this.rooms.has(roomCode) || !gameManager || !currentRoomInRm || currentRoomInRm.activePlayers < 2) {
          clearInterval(countdownInterval);
          gameManager.countdownInterval = null;
          console.warn(`[Room ${roomCode}] Aborting countdown interval.`);
          
          if (currentRoomInRm && currentRoomInRm.players.length > 0) {
            this.io.to(roomCode).emit("countdownAborted", "Not enough players to continue game.");
          }
          return;
        }

        this.io.to(roomCode).emit("CountDownUpdate", countdown);
        console.log(`[Room ${roomCode}] Countdown: ${countdown}`);
        countdown--;

        if (countdown < 0) {
          clearInterval(countdownInterval);
          gameManager.countdownInterval = null;
          console.log(`[Room ${roomCode}] Starting game loop.`);
          
          try {
            gameManager.setupGameLoop();
          } catch (error) {
            console.error(`[Room ${roomCode}] Game loop setup error:`, error);
          }
        }
      }, 1000);

      gameManager.countdownInterval = countdownInterval;
    }, 1000);
  }
}

module.exports = GameSocketManager;