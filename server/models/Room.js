class Room{
    constructor(roomCode){
        this.roomCode = roomCode;
        this.players = [];
        this.gameStatus = "Waiting";
        this.maxPlayers = 2;
        this.activePlayers = 0;
        this.createdAt = new Date().toISOString();

 
    }

    addPlayer(player){
        
        this.players.push(player);
        this.gameStatus = this.players.length > 1 ? 'Ready' : 'Waiting';
        this.activePlayers = this.players.length;
        return this;
        
        }

}
module.exports = Room;