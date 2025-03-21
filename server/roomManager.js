// RoomManager.js
const Room = require("./models/Room");
class RoomManager {
    constructor() {
        this.adjectives = [
            "Big", "Tiny", "Smelly", "Angry", "Sleepy", "Wobbly",
            "Jolly", "Grumpy", "Lazy", "Funky", "Tired", "Smart"
        ];
        this.nouns = [
            "Fart", "Pickle", "Sandwich", "Jelly", "Banana", "Donut",
            "Penguin", "Waffle", "Muffin", "Monkey", "Cookie", "Taco"
        ];
        this.Rooms = new Map();
    }   

    generateRoomCode() {
        let roomCode = "";
        do {
            const adjectiveIndex = Math.floor(Math.random() * this.adjectives.length);
            const nounIndex = Math.floor(Math.random() * this.nouns.length);
            roomCode = this.adjectives[adjectiveIndex] + this.nouns[nounIndex];
        }while(this.Rooms.has(roomCode)); 

        return roomCode;
    }
    createRoom(){
        const roomCode = this.generateRoomCode();
        const room = new Room(roomCode);
        this.Rooms.set(roomCode,room);
        console.log(this.Rooms.keys());
        return room;
    }
    joinRoom(roomCode, player) {
        const room = this.Rooms.get(roomCode);
        if (!room) {
            return null;  
        }
        if (room.activePlayers === 2) {
            return null;  
        }
        room.addPlayer(player);
        console.log(`Player ${player} joined room: ${roomCode}`);
        return room;  
    }
    getRoom(roomCode){
        return this.Rooms.get(roomCode);
    }
}

module.exports = RoomManager;
