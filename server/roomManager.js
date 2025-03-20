let adjectives = [
    "Big", "Tiny", "Smelly", "Angry", "Sleepy", "Wobbly", 
    "Jolly", "Grumpy", "Lazy", "Funky", "Tired", "Smart"
];

let nouns  = [
    "Fart", "Pickle", "Sandwich", "Jelly", "Banana", "Donut", 
    "Penguin", "Waffle", "Muffin", "Monkey", "Cookie", "Taco"
];

let roomNameSet = new Set();

function generateRoomCode(){

    let roomName = "";
    do{
    let adjectiveIndex = Math.floor(Math.random()*(adjectives.length))
    let nounIndex = Math.floor(Math.random()*(adjectives.length));
    roomName = adjectives[adjectiveIndex] + nouns[nounIndex];

    }
    while(roomNameSet.has(roomName));
    
    roomNameSet.add(roomName);
    console.log(roomName);
    console.log(roomNameSet.size);
    return roomName;
}



module.exports = { generateRoomCode };