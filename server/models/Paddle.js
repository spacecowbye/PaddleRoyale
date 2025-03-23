class Paddle{
    constructor(x,y,player){
        this.x = x;
        this.y =  y;
        this.player = player;
        this.dy =  0;
        this.width = 15;
        this.length = 100;
    }

    reset(x,y){
        this.x = x;
        this.y =  y;
        this.dy = 0;
    }
}

module.exports = Paddle;