class PowerUp {
    constructor() {
        this.isActive = false;
        this.x = Math.floor(Math.random() * (498 - 150 + 1)) + 150;
        this.y = Math.floor(Math.random() * (325 - 75 + 1)) + 75;
        this.width = 32;
        this.height = 32;
        this.timeToLive = 12 * 1000;
        
    }
    
    applyEffect(player) {
        this.isActive = true;
        console.error("applyEffect() must be implemented by child classes");
        throw new Error("Method not implemented");
    }
    deactivate(){
        this.isActive = false;
    }

}
module.exports = PowerUp;