const express = require('express');
const {createServer} = require('node:http');
const dotenv = require('dotenv');
const path = require('path');
const cors = require('cors');
const { generateRoomCode } = require("./roomManager");  // Import function


const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 8080;

app.use(express.static(path.join(__dirname,"../public")));
app.use(cors());

app.get('/create-room',(req,res) =>{
    const roomCode = generateRoomCode();
    const object = {roomCode : roomCode};
    res.send(object);
})

function setupSocketIO(server) {
    // Set up Socket.IO with server
  }
  
  function setupRoutes(app) {
    // Set up Express routes
  }
  
  function startServer(server, port) {
    // Start the HTTP server
  }
  
  // config/socket.js
  function setupSocketHandlers(io) {
    // Register main Socket.IO event handlers
  }
  
  function handleConnection(socket, io) {
    // Handle new socket connection
  }
  
  function handleDisconnection(socket, io) {
    // Handle socket disconnection
  }
  
server.listen(PORT,()=>{
    console.log(`Server Started on Port ${PORT}`);
})