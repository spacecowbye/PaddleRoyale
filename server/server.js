const express = require('express');
const {createServer} = require('node:http');
const {Server} = require('socket.io');
const dotenv = require('dotenv');
const path = require('path');
const cors = require('cors');
const { generateRoomCode } = require("./roomManager");  // Import function


dotenv.config();
const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 8080;
const io = new Server(server);


app.use(express.static(path.join(__dirname,"../public")));
app.use(cors());

app.get('/create-room',(req,res) =>{
    const roomCode = generateRoomCode();
    const object = {roomCode : roomCode};
    res.send(object);
})

io.on('connection',(socket) => {
    console.log("A new user connected");
})

  
server.listen(PORT,()=>{
    console.log(`Server Started on Port ${PORT}`);
})

