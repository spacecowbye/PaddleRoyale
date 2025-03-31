class PowerUp {
    constructor(newType) {
        this.isActive = false;
        this.x = Math.floor(Math.random() * (498 - 150 + 1)) + 150;
        this.y = Math.floor(Math.random() * (325 - 75 + 1)) + 75;
        this.width = 32;
        this.height = 32;
        this.timeToLive = 13*1000;
        this.type = newType;
        
    }
    

}
module.exports = PowerUp;