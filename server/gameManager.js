//import the ball and the paddle and the fucking mind that is supposed to build this
const Ball = require("./models/Ball");
const Paddle = require("./models/Paddle");

class GameManager {
  constructor(room, io) {
    // ROOM CONSTANTS
    console.log("New Game manager created");
    this.ROOM_CODE = room.roomCode;
    this.player1 = room.players[0];
    this.player2 = room.players[1];


    //PHYSICS STUFF CONTSTANTS
    this.RETURN_ANGLES = [-5, -3, -1, 1, 3, 5];
    this.MAX_SPEED = 12;
    this.PAUSE_DURATION = 1500;

    this.CANVAS_WIDTH = 652;
    this.CANVAS_HEIGHT = 404;
    this.LEFT_PADDLE_INITIAL_X = 10;
    this.PADDLE_INITAL_Y = 152;
    this.RIGHT_PADDLE_INITIAL_X = 627;
    this.FPS = 60;
    this.TICK_RATE = 1000 / this.FPS;

    // Game state
    this.io = io;
    this.gameStarted = false;
    this.gameInitialized = false;
    this.gamePaused = false;
    this.player1Score = 0;
    this.player2Score = 0;

    this.ball = new Ball(this.CANVAS_WIDTH / 2, this.CANVAS_HEIGHT / 2);
    this.leftPaddle = new Paddle(
      this.LEFT_PADDLE_INITIAL_X,
      this.PADDLE_INITAL_Y,
      this.player1
    );
    this.rightPaddle = new Paddle(
      this.RIGHT_PADDLE_INITIAL_X,
      this.PADDLE_INITAL_Y,
      this.player2
    );
  }
  updateScore(player){
    this.gamePaused = true;
    this.ball.reset(this.CANVAS_WIDTH / 2, this.CANVAS_HEIGHT / 2);

    if (player === this.player1) {
        this.player1Score += 1;
    } else {
        this.player2Score += 1;
    }

    this.io.to(this.ROOM_CODE).emit("ScoreUpdate", {
        leftPlayerScore: this.player1Score,
        rightPlayerScore: this.player2Score
    });
    

    setTimeout(()=>{
      this.gamePaused = false;
    },2000);
  }
  setupGameLoop() {
    if (!this.gameStarted) {
      this.gameStarted = true;
      console.log(`setting up interval at tick rate of ${this.TICK_RATE}`);

      setInterval(() => {
        if(!this.gamePaused){
          const gameState = this.updateGame();
          this.io.to(this.ROOM_CODE).emit("GameUpdate", gameState);
        }
      }, this.TICK_RATE);
    }
  }
  updateBall() {
    if (this.ball.x + this.ball.radius >= this.CANVAS_WIDTH) {
      this.updateScore(this.player1);
    }
    
    if (this.ball.x - this.ball.radius <= 0) {
      this.updateScore(this.player2);
    }
    if(this.ball.y + this.ball.radius >= this.CANVAS_HEIGHT){
      this.ball.y = this.CANVAS_HEIGHT-this.ball.radius;
      this.ball.dy = -this.ball.dy;
    }
    if(this.ball.y <= this.ball.radius){
      this.ball.y = this.ball.radius
      this.ball.dy = -this.ball.dy;
    }

    this.ball.x += this.ball.dx;
    this.ball.y += this.ball.dy;
    
  }
  updatePaddle(player) {
      
  }
  updateGame() {
    this.updateBall();

    let GameState = {
      Ball: this.ball,
      Paddle1 : this.leftPaddle,
      Paddle2 : this.rightPaddle
    };
    return GameState;
  }
}

module.exports = GameManager;
