
class PowerUp{

    constructor(x, y, ttl, type, sprite) {
        this.x = x;
        this.y = y;
        this.timeToLive = ttl;
        this.isActive = false;
        this.type = type; 
        this.sprite = sprite || 'assets/default_sprite.png'
    }
    activate(player){
        this.isActive = true;
        this.applyEffect(player);
        console.log("Sprite picked up by ",player);
    }
    applyEffect(){
        console.log("Each child class implement this");
    }
    deactivate(player){
        this.isActive = false;
        this.timeToLive = 0;
    }



}



module.exports = PowerUp;