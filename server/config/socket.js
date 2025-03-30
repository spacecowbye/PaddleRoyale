const { Server } = require("socket.io");
const RoomManager = require("../roomManager");
const GameManager = require("../gameManager");
const Room = require("../models/Room");

class GameSocketManager {
  constructor(server) {
    this.io = new Server(server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"],
      },
      transports: ["websocket", "polling"],
    });
    this.rooms = new Map();
    this.socketToRoom = new Map();
    this.setupSocketEvents();
  }

  setupSocketEvents() {
    this.io.on("connection", (socket) => {
      console.log("New socket connection made on ", socket.id);
      let room;
      socket.on("joinRoom", (roomCode) => {
        room = RoomManager.getRoom(roomCode);
        if (!room) {
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
          const playerId = socket.id;
          gameManager.addPlayer(playerId);
        }

        if (room.gameStatus === "Ready") {
          console.log(`${roomCode} game is ready with ${room.players}`);
          this.StartGameCountdown(room);
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
        if (!room) return;

        const roomCode = room.roomCode;
        const gameManager = this.rooms.get(roomCode);
        if (!gameManager) return;

        console.log(`Socket ${socket.id} disconnected from ${roomCode}`);

        // Notify the remaining player
        const opponentId =
          gameManager.player1 === socket.id
            ? gameManager.player2
            : gameManager.player1;

        if (opponentId) {
          this.io
            .to(opponentId)
            .emit("playerLeft", "Your opponent has disconnected.");
        }

        // Stop the game and clean up
        gameManager.destroy(); // Clears intervals, timeouts, and resets game state

        // Remove the game room from active rooms
        this.rooms.delete(roomCode);
        this.socketToRoom.delete(socket.id);

        console.log(`Room ${roomCode} deleted after player disconnection.`);
      });
    });
  }

  StartGameCountdown(room) {
    console.log("Inside Start Game Countdown");

    let roomCode = room.roomCode;
    this.io.to(roomCode).emit("CountDownUpdate", "May the best player Win");
    let countdown = 3;
    setTimeout(() => {
      const countdownInterval = setInterval(() => {
        this.io.to(roomCode).emit("CountDownUpdate", countdown);
        countdown--;

        if (countdown < 0) {
          clearInterval(countdownInterval);
          let gameManager = this.rooms.get(roomCode);
          if (gameManager) {
            gameManager.setupGameLoop();
          }
        }
      }, 700);
    }, 900);
  }
}

module.exports = GameSocketManager;
