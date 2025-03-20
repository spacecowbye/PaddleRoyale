class Room{
    constructor(roomCode,player1){
        this.roomCode = roomCode;
        this.player1 = player1;
        this.player2 = null;
        this.gameStatus = "Waiting";
        this.maxPlayers = 2;
        this.activePlayers = 1;
        this.createdAt = new Date().toISOString();

 
    }

    addPlayer(player2){
        if(this.player2){
                return {error : "Room already has 2 players"};
            }
        
        this.player2 = player2;
        this.gameStatus = "Ready";
        this.activePlayers = 2;
        return this;
        
        }

}
module.exports = Room;