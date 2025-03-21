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
  const player1 = uuidv4();
  const room = roomManager.createRoom(player1);

  room.status = "Success";
  res.status(201).json(room);
});

app.post("/join-room", (req, res) => {
  const player2 = uuidv4();
  const { roomCode } = req.body;
  const room = roomManager.joinRoom(roomCode,player2);
  console.log(room);
  if(room){
    room.status = "Success"
    res.status(201).json(room);
  }
  else{
    res.status(400).json({
        error : "No such Room"
    })
  }

});

app.get("/validate-room/:roomCode",(req,res) => {
    const {roomCode} = req.params;

    const room = roomManager.getRoom(roomCode);
    if(!room){
        return res.status(400).json({
            valid : false,
            error : "Room Does not exist"
        })
    }
    else if(room.activePlayers >= 2){
        return res.status(400).json({
            valid : false,
            error : "Room Does not exist"
        })
    }
    else{
        return res.status(200).json(
            {valid : true}
        );
    }
}
   
    
)


server.listen(PORT, () => {
  console.log(`Server Started on Port ${PORT}`);
});
