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
    this.rooms = new Map(); // mapping room to Game Managers
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
      socket.on("GameStart",()=>{
        const roomCode = this.socketToRoom.get(socket.id);
        if(!roomCode){
            return ;
        }
        const room = RoomManager.getRoom(roomCode);

        let doesGameManagerExist = this.rooms.get(roomCode);
        if(!doesGameManagerExist){
            const gameManager = new GameManager(room,this.io);
            this.rooms.set(roomCode,gameManager);
            gameManager.setupGameLoop();
        }
      })

      socket.on("PADDLE_UP", () => {
        console.log(`${socket.id} wants the player to go up`);
      });
      socket.on("PADDLE_DOWN", () => {
        console.log(`${socket.id} wants the player to go down`);
      });



      // Correctly attach the disconnect listener to the socket instance
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
