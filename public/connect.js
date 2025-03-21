const socket = io(); 

socket.on("connect", async() => {
    console.log(" Connected to WebSocket server:", socket.id);
    let socketId = socket.id;
    await validateRoom(socketId)
    socket.on("disconnect", () => {
        console.log(" Disconnected from WebSocket server");
    });
});


async function validateRoom(socketId){
    try{
    
      const URLparams = new URLSearchParams(window.location.search);
      const roomCode = URLparams.get('room');
      const response = await axios.post(`http://localhost:8080/join-room/${roomCode}`,{socketId});
      


    }
    catch(err){
        if(err.response && err.response.data && err.response.data.error){
          window.alert( err.response.data.error);
        }
        else{
          window.alert("Something Bad Happpened");
        }
        
        window.location.href = `http://localhost:8080/`
    }

    
  }

  
