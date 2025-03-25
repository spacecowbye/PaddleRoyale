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

      socket.on("joinRoom", (roomCode) => {
        const room = RoomManager.getRoom(roomCode);
        if (!room) {
          return;
        }
        socket.join(roomCode);

        this.socketToRoom.set(socket.id, roomCode);
        socket.emit("youJoined", { playerId: socket.id, roomCode });
        console.log(`${room.gameStatus} is the status of ${roomCode}`);

        if (room.gameStatus === "Ready") {
          console.log(`${roomCode} game is ready with ${room.players}`);
          this.io.to(roomCode).emit("GameStatus", "Ready");
        }
      });

      socket.on("GameStart", () => {
        const roomCode = this.socketToRoom.get(socket.id);
        if (!roomCode) {
          return;
        }
        const room = RoomManager.getRoom(roomCode);

        // Ensure only one game manager per room
        let gameManager = this.rooms.get(roomCode);
        if (!gameManager) {
          gameManager = new GameManager(room, this.io);
          this.rooms.set(roomCode, gameManager);
          gameManager.setupGameLoop();
        }

        // Paddle movement events outside of GameStart
        socket.on("PADDLE_UP", () => {
          let object = {
            movePaddleUp: true,
            movePaddleDown: false,
          };
          gameManager.updatePaddle(socket.id, object);
        });

        socket.on("PADDLE_DOWN", () => {
          let object = {
            movePaddleUp: false,
            movePaddleDown: true,
          };
          gameManager.updatePaddle(socket.id, object);
        });

        socket.on("PADDLE_STOP", () => {
          let object = {
            movePaddleUp: false,
            movePaddleDown: false,
          };
          gameManager.updatePaddle(socket.id, object);
        });
      });

      socket.on("disconnect", () => {
        console.log("Socket disconnected ", socket.id);

        let roomToDelete = this.socketToRoom.get(socket.id);
        this.io
          .to(roomToDelete)
          .emit("playerLeft", `${socket.id} left ${roomToDelete}`);

        this.io.to(roomToDelete).emit("GameStatus", "Abandoned");
        RoomManager.deleteRoom(roomToDelete);
      });
    });
  }
}

module.exports = GameSocketManager;