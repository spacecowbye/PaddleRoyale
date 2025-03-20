const express = require('express');
const {createServer} = require('node:http');
const {Server} = require('socket.io');
const dotenv = require('dotenv');
const path = require('path');
const cors = require('cors');
const RoomManager = require('./RoomManager');


dotenv.config();
const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 8080;
const io = new Server(server);
const roomManager = new RoomManager();
const lobbyNamespace = io.of("/lobby");


app.use(express.json());
app.use(express.static(path.join(__dirname,"../public")));
app.use(cors());

app.post('/create-room', (req, res) => {
    console.log(req.body);
    const roomCode = roomManager.generateRoomCode(); 
    res.json({ roomCode });
    roomManager.activeRooms.add(roomCode);
    
});

app.post('/join-room', (req, res) => {
    const { roomCode } = req.body;
    // Validate room code exists
    // Send appropriate response
    if(roomManager.activeRooms.has(roomCode)){
        res.status(200).json({isActve : true});
    }
    else{
        res.status(400).json({isActive : false});
        
    }
    
});

lobbyNamespace.on("connection",(socket)=>{
    console.log(socket.id);
})

server.listen(PORT,()=>{
    console.log(`Server Started on Port ${PORT}`);
})

