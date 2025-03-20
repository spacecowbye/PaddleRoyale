// RoomManager.js
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
        this.activeRooms = new Set();
    }

    generateRoomCode() {
        let roomName = "";
        do {
            const adjectiveIndex = Math.floor(Math.random() * this.adjectives.length);
            const nounIndex = Math.floor(Math.random() * this.nouns.length);
            roomName = this.adjectives[adjectiveIndex] + this.nouns[nounIndex];
        } while (this.activeRooms.has(roomName));

        this.activeRooms.add(roomName);
        console.log(roomName);
        console.log(this.activeRooms.size);
        return roomName;
    }
}

module.exports = RoomManager;
