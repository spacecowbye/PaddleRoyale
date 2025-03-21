const {Server} = require("socket.io");

class GameSocketManager{
    constructor(server){
        this.io =  new Server(server,{
            cors :{
                origin  : "*",
                methods : ["GET","POST"]
            },
            transports : ["websocket","polling"],
        });
        this.rooms = {};
        this.setupSocketEvents();
    }
    setupSocketEvents() {
        this.io.on("connection", (socket) => {
            console.log("New socket connection made on ", socket.id);
    
            socket.emit("hello", "world");
    
            // Correctly attach the disconnect listener to the socket instance
            socket.on("disconnect", () => {
                console.log("Socket disconnected ", socket.id);
            });
        });
    }
    
}

module.exports = GameSocketManager;