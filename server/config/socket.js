const { Server } = require("socket.io");
const RoomManager = require("../roomManager"); // Singleton instance
const GameManager = require("../gameManager");
// const Room = require("../models/Room"); // Not directly used in GameSocketManager, used by RoomManager

class GameSocketManager {
  constructor(server) {
    this.io = new Server(server, {
      cors: {
        origin: "*", // Consider replacing '*' with your Fly.io app domain in production
        methods: ["GET", "POST"],
      },
      transports: ["websocket", "polling"], // Explicitly define transports
    });
    this.rooms = new Map(); // Stores GameManager instances per roomCode
    this.socketToRoom = new Map(); // Maps socket.id to the Room object (from RoomManager.Rooms)

    this.setupSocketEvents();
  }

  setupSocketEvents() {
    this.io.on("connection", (socket) => {
      console.log(`[Socket Connected] New socket ID: ${socket.id}`);

      // --- CRITICAL: Extract roomCode from initial handshake query ---
      const roomCode = socket.handshake.query.room;

      if (!roomCode) {
        console.warn(`[Socket ${socket.id}] Connected without a roomCode. Disconnecting.`);
        socket.emit("error", "Room code is missing. Please join via a valid room link.");
        socket.disconnect(true); // Disconnect immediately if no room code
        return;
      }

      console.log(`[Socket ${socket.id}] Attempting to join room: ${roomCode}`);

      // Get the room object from RoomManager
      const room = RoomManager.getRoom(roomCode);
      if (!room) {
        console.warn(`[Socket ${socket.id}] Room ${roomCode} not found in RoomManager. Disconnecting.`);
        socket.emit("roomNotFound", roomCode); // Inform client that room doesn't exist
        socket.disconnect(true); // Disconnect if the room doesn't exist
        return;
      }

      // Check if room is already full *before* adding player via socket
      // Your RoomManager.joinRoom handles activePlayers, but we also check here for socket connection
      if (room.activePlayers >= room.maxPlayers) {
        console.warn(`[Socket ${socket.id}] Room ${roomCode} is full. Disconnecting.`);
        socket.emit("roomFull", roomCode); // Inform client that room is full
        socket.disconnect(true);
        return;
      }

      // If RoomManager.joinRoom (HTTP API) has already added the player ID,
      // we need to ensure we don't double-add here.
      // Assuming 'socket.id' is the 'player' identifier.
      if (!room.players.includes(socket.id)) {
        // Only add if not already present (e.g., if direct socket connection without HTTP join)
        // Note: Your Room.addPlayer handles this length check, but adding it here for clarity
        if (room.players.length < room.maxPlayers) {
             room.addPlayer(socket.id); // Update the Room object's player list and activePlayers count
             console.log(`[Socket ${socket.id}] Added to RoomManager's room ${roomCode}. Players: ${room.players.length}`);
        } else {
             // This branch should ideally not be reached if the activePlayers check above is correct
             console.warn(`[Socket ${socket.id}] Tried to add to full room ${roomCode}.`);
             socket.emit("roomFull", roomCode);
             socket.disconnect(true);
             return;
        }
      } else {
          console.log(`[Socket ${socket.id}] Already recorded in RoomManager's room ${roomCode}.`);
      }
      
      // Join the socket to the socket.io room
      socket.join(roomCode);
      this.socketToRoom.set(socket.id, room); // Map socket.id to the Room object
      console.log(`[Socket ${socket.id}] Successfully joined Socket.IO room: ${roomCode}`);
      socket.emit("youJoined", { playerId: socket.id, roomCode }); // Inform the client they've joined

      // --- Handle GameManager initialization/player addition ---
      let gameManager = this.rooms.get(roomCode);

      if (!gameManager) {
        console.log(`[Room ${roomCode}] Creating new GameManager for room.`);
        gameManager = new GameManager(roomCode, socket.id, this.io);
        this.rooms.set(roomCode, gameManager);
      } else {
        // This path is for the second player joining an existing GameManager
        console.log(`[Room ${roomCode}] Adding player ${socket.id} to existing GameManager.`);
        gameManager.addPlayer(socket.id); // Add to GameManager's internal player list
      }
      
      console.log(`[Room ${roomCode}] Game status: ${room.gameStatus}, Current active players in RoomManager: ${room.activePlayers}`);

      // Start countdown if room is ready
      if (room.gameStatus === "Ready") { // This status is set by Room.addPlayer when players.length becomes 2
        console.log(`[Room ${roomCode}] Game is ready. Starting countdown.`);
        this.StartGameCountdown(room);
      }

      // --- Paddle Movement Events ---
      socket.on("PADDLE_UP", () => {
        const currentRoom = this.socketToRoom.get(socket.id);
        if (!currentRoom) return; // Should not happen if socketToRoom is managed correctly
        const gameManagerInstance = this.rooms.get(currentRoom.roomCode);
        if (!gameManagerInstance) return;

        gameManagerInstance.updatePaddle(socket.id, {
          movePaddleUp: true,
          movePaddleDown: false,
        });
      });

      socket.on("PADDLE_DOWN", () => {
        const currentRoom = this.socketToRoom.get(socket.id);
        if (!currentRoom) return;
        const gameManagerInstance = this.rooms.get(currentRoom.roomCode);
        if (!gameManagerInstance) return;

        gameManagerInstance.updatePaddle(socket.id, {
          movePaddleUp: false,
          movePaddleDown: true,
        });
      });

      socket.on("PADDLE_STOP", () => {
        const currentRoom = this.socketToRoom.get(socket.id);
        if (!currentRoom) return;
        const gameManagerInstance = this.rooms.get(currentRoom.roomCode);
        if (!gameManagerInstance) return;

        gameManagerInstance.updatePaddle(socket.id, {
          movePaddleUp: false,
          movePaddleDown: false,
        });
      });

      // --- Disconnect Event ---
      socket.on("disconnect", () => {
        console.log(`[Socket Disconnected] Socket ID: ${socket.id}`);
        const roomDisconnectedFrom = this.socketToRoom.get(socket.id);

        // Always clean up socketToRoom mapping immediately
        this.socketToRoom.delete(socket.id);

        if (!roomDisconnectedFrom) {
          console.log(`[Socket ${socket.id}] Disconnected from an unknown or already cleaned-up room.`);
          return;
        }

        const roomCode = roomDisconnectedFrom.roomCode;
        const gameManager = this.rooms.get(roomCode);

        // --- IMPORTANT: Handle player removal from the Room object directly ---
        // Since Room.js doesn't have removePlayer, we'll manipulate the players array directly
        const playerIndex = roomDisconnectedFrom.players.indexOf(socket.id);
        if (playerIndex > -1) {
            roomDisconnectedFrom.players.splice(playerIndex, 1); // Remove player from Room.players
            roomDisconnectedFrom.activePlayers = roomDisconnectedFrom.players.length; // Update activePlayers
            // Update gameStatus based on remaining players
            if (roomDisconnectedFrom.activePlayers < roomDisconnectedFrom.maxPlayers && roomDisconnectedFrom.gameStatus === "InProgress") {
                roomDisconnectedFrom.gameStatus = "Waiting"; // Or 'Ended' if game cannot continue
            }
            console.log(`[Room ${roomCode}] Player ${socket.id} removed from RoomManager's room. Remaining: ${roomDisconnectedFrom.activePlayers}`);
        }

        if (!gameManager) {
          console.log(`[Room ${roomCode}] No GameManager found for disconnected socket ${socket.id}.`);
          return;
        }

        console.log(`[Room ${roomCode}] Socket ${socket.id} disconnected.`);

        // Clear countdown timers if they are active
        if (gameManager.countdownInterval) {
          clearInterval(gameManager.countdownInterval);
          gameManager.countdownInterval = null;
          console.log(`[Room ${roomCode}] Cleared countdownInterval.`);
        }
        if (gameManager.initialTimeout) {
          clearTimeout(gameManager.initialTimeout);
          gameManager.initialTimeout = null;
          console.log(`[Room ${roomCode}] Cleared initialTimeout.`);
        }

        // Remove player from GameManager (assuming GameManager has a removePlayer method)
        // If GameManager doesn't have removePlayer, you'd need to manipulate its internal player list directly
        if (typeof gameManager.removePlayer === 'function') {
            gameManager.removePlayer(socket.id); 
        } else {
            console.warn(`[Room ${roomCode}] GameManager does not have a 'removePlayer' method.`);
            // You might need to directly modify gameManager.players here if no method exists
            // Example: gameManager.players = gameManager.players.filter(id => id !== socket.id);
        }
        

        // Notify the remaining player if any
        if (gameManager.players.length > 0) { // Check if any player remains in GameManager after removal
            const remainingPlayerId = gameManager.player1 === socket.id ? gameManager.player2 : gameManager.player1;
            // The above needs careful handling if GameManager.player1/player2 are just references
            // It's better to iterate gameManager.players if it's an array of current players
            // Or if you only have 2 players max, then the other one is the opponent
            let opponentId = null;
            if(gameManager.player1 && gameManager.player1 !== socket.id) opponentId = gameManager.player1;
            else if(gameManager.player2 && gameManager.player2 !== socket.id) opponentId = gameManager.player2;

            if (opponentId) {
                this.io.to(opponentId).emit("playerLeft", "Your opponent has disconnected. Game ended.");
                console.log(`[Room ${roomCode}] Notified opponent ${opponentId} about disconnection.`);
                // Clean up opponent's socketToRoom mapping as well if their game also ends
                this.socketToRoom.delete(opponentId);
                 // Disconnect opponent if the game requires two players and one left
                const opponentSocket = this.io.sockets.sockets.get(opponentId);
                if (opponentSocket) {
                    opponentSocket.disconnect(true);
                    console.log(`[Room ${roomCode}] Disconnected opponent socket ${opponentId}.`);
                }
            }
        }
        
        // Clean up room and GameManager if no players remain based on RoomManager's room object
        if (roomDisconnectedFrom.activePlayers === 0) {
            gameManager.destroy(); // Clears intervals, timeouts, and resets game state in GameManager
            this.rooms.delete(roomCode); // Remove GameManager from this.rooms map
            RoomManager.deleteRoom(roomCode); // Delete the room from the global RoomManager map
            console.log(`[Room ${roomCode}] GameManager and Room deleted from all managers as no players remain.`);
        } else {
            // If one player remains, the game might go into a waiting state or reset
            console.log(`[Room ${roomCode}] One player remaining. Room status set to 'Waiting'.`);
            roomDisconnectedFrom.gameStatus = "Waiting"; // Set room status back to waiting
            this.io.to(roomCode).emit("opponentDisconnected", "Waiting for another player to join.");
        }
      });
    });
  }

  StartGameCountdown(room) {
    const roomCode = room.roomCode;
    // Ensure room exists in this.rooms (GameManager is present)
    const gameManager = this.rooms.get(roomCode);
    if (!gameManager) {
        console.warn(`[Countdown] GameManager not found for room ${roomCode}. Cannot start countdown.`);
        return;
    }

    console.log(`[Room ${roomCode}] Starting game countdown.`);
    this.io.to(roomCode).emit("CountDownUpdate", "May the best player Win");
    let countdown = 3;

    // Store the initial timeout reference on the GameManager
    gameManager.initialTimeout = setTimeout(() => {
      // Double-check room/gameManager still exists before starting countdown interval
      // And ensure there are enough active players according to the RoomManager's Room object
      const currentRoomInRm = RoomManager.getRoom(roomCode);
      if (!this.rooms.has(roomCode) || !gameManager || !currentRoomInRm || currentRoomInRm.activePlayers < 2) {
        console.warn(`[Room ${roomCode}] Aborting countdown: Room/GameManager not found or not enough active players (${currentRoomInRm ? currentRoomInRm.activePlayers : 'N/A'}).`);
        gameManager.initialTimeout = null; // Clear reference if aborted
        // Potentially emit an update to remaining player if countdown is aborted
        if(currentRoomInRm && currentRoomInRm.players.length > 0) {
            this.io.to(roomCode).emit("countdownAborted", "Not enough players to start game.");
        }
        return;
      }

      const countdownInterval = setInterval(() => {
        // Check if room/gameManager still exists (players might have left)
        const currentRoomInRm = RoomManager.getRoom(roomCode);
        if (!this.rooms.has(roomCode) || !gameManager || !currentRoomInRm || currentRoomInRm.activePlayers < 2) {
          clearInterval(countdownInterval);
          gameManager.countdownInterval = null; // Clear reference if aborted
          console.warn(`[Room ${roomCode}] Aborting countdown interval: Room/GameManager not found or not enough active players.`);
          if(currentRoomInRm && currentRoomInRm.players.length > 0) {
              this.io.to(roomCode).emit("countdownAborted", "Not enough players to continue game.");
          }
          return;
        }

        this.io.to(roomCode).emit("CountDownUpdate", countdown);
        console.log(`[Room ${roomCode}] Countdown: ${countdown}`);
        countdown--;

        if (countdown < 0) {
          clearInterval(countdownInterval);
          gameManager.countdownInterval = null; // Clear reference since countdown finished
          console.log(`[Room ${roomCode}] Countdown finished. Starting game loop.`);
          gameManager.setupGameLoop();
        }
      }, 1000); // Changed to 1000ms for clearer 1-second countdown

      // Store the countdown interval reference on the GameManager
      gameManager.countdownInterval = countdownInterval;
    }, 1000); // Changed initial timeout to 1000ms for a consistent delay
  }
}

module.exports = GameSocketManager;