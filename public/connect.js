const socket = io(); 
socket.on("connect", () => {
    console.log(" Connected to WebSocket server:", socket.id);
    socket.on("disconnect", () => {
        console.log(" Disconnected from WebSocket server");
    });
});


