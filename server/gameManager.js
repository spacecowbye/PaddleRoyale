//import the ball and the paddle and the fucking mind that is supposed to build this
const Ball = require("./models/Ball");
const Paddle = require("./models/Paddle");
const PowerUp = require("./models/Collectible");

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
    this.PowerUp = null;

    this.gameLoopInterval = null;
    this.powerUpTimeout = null;
    this.powerUpInterval = null;
  }
  updateScore(player) {
    this.gamePaused = true;
    this.ball.reset(this.CANVAS_WIDTH / 2, this.CANVAS_HEIGHT / 2);

    if (player === this.player1) {
      this.player1Score += 1;
      if (this.player1Score === 10) {
        this.io.to(this.ROOM_CODE).emit("GameOver", {
          winner: this.player1,
        });
      }
    } else {
      this.player2Score += 1;
      if (this.player2Score === 10) {
        this.io.to(this.ROOM_CODE).emit("GameOver", {
          winner: this.player2,
        });
      }
    }

    this.io.to(this.ROOM_CODE).emit("ScoreUpdate", {
      leftPlayerScore: this.player1Score,
      rightPlayerScore: this.player2Score,
    });

    setTimeout(() => {
      this.gamePaused = false;
    }, 2000);
  }
  setupGameLoop() {
    if (!this.gameStarted) {
      this.gameStarted = true;
      console.log(`Setting up interval at tick rate of ${this.TICK_RATE}`);

      this.powerUpTimeout = setTimeout(() => {
        this.managePowerUps();
      }, 2500);

      this.gameLoopInterval = setInterval(() => {
        if (!this.gamePaused) {
          const gameState = this.updateGame();
          this.io.to(this.ROOM_CODE).emit("GameUpdate", gameState);
        }
      }, this.TICK_RATE);
    }
  }

  managePowerUps() {
    if (!this.PowerUp) {
      this.spawnPowerUp();
      this.powerUpInterval = setInterval(() => {
        if (this.PowerUp) {
          console.log("PowerUp wasn't collected and exhausted its lifetime.");
          this.PowerUp = null;
          setTimeout(() => {
            this.spawnPowerUp();
          }, Math.random() * (3000 - 1000) + 1500);
        } else {
          this.spawnPowerUp();
        }
      }, 15 * 1000);
    }
  }
  spawnPowerUp() {
    this.PowerUp = new PowerUp();
    console.log(this.PowerUp);
  }
  updateBall() {
    //POWERUP LOGIC
    
    if (
      this.ball &&
      this.PowerUp &&
      this.ball.lastHitBy !== null &&
      this.ball.x + this.ball.radius >= this.PowerUp.x &&  // Ball's right edge past PowerUp's left edge
      this.ball.x - this.ball.radius <= this.PowerUp.x + this.PowerUp.width &&  // Ball's left edge before PowerUp's right edge
      this.ball.y + this.ball.radius >= this.PowerUp.y &&  // Ball's bottom edge past PowerUp's top edge
      this.ball.y - this.ball.radius <= this.PowerUp.y + this.PowerUp.height  // Ball's top edge before PowerUp's bottom edge
    ){
      console.log("POWERUP HIT");
    }
  


    // Scoring logic
    if (this.ball.x + this.ball.radius >= this.CANVAS_WIDTH) {
      this.updateScore(this.player1);
    }

    if (this.ball.x - this.ball.radius <= 0) {
      this.updateScore(this.player2);
    }

    // Vertical boundary collisions
    if (this.ball.y + this.ball.radius >= this.CANVAS_HEIGHT) {
      this.ball.y = this.CANVAS_HEIGHT - this.ball.radius;
      this.ball.dy = -this.ball.dy;
    }
    if (this.ball.y - this.ball.radius <= 0) {
      this.ball.y = this.ball.radius;
      this.ball.dy = -this.ball.dy;
    }
    
    // Right paddle collision
    if (
      this.ball.x + this.ball.radius >= this.rightPaddle.x &&
      this.ball.x + this.ball.radius <=
        this.rightPaddle.x + this.rightPaddle.width &&
      this.ball.y + this.ball.radius >= this.rightPaddle.y &&
      this.ball.y - this.ball.radius <=
        this.rightPaddle.y + this.rightPaddle.length
    ) {
      this.ball.lastHitBy = this.player2;
      const hitPosition = this.ball.y - this.rightPaddle.y;
      const segmentSize = this.rightPaddle.length / 6;
      const segment = Math.floor(hitPosition / segmentSize);
      const clampedSegment = Math.max(0, Math.min(5, segment));

      // Ensure dx is negative (moving left) when hitting right paddle
      this.ball.dx = Math.max(
        -this.MAX_SPEED,
        Math.min(this.MAX_SPEED, -Math.abs(this.ball.dx * 1.1))
      );
      this.ball.dy = this.RETURN_ANGLES[clampedSegment];

      // Ensure ball is outside paddle to prevent sticking
      this.ball.x = this.rightPaddle.x - this.ball.radius;
    }

    // Left paddle collision
    if (
      this.ball.x - this.ball.radius <=
        this.leftPaddle.x + this.leftPaddle.width &&
      this.ball.x - this.ball.radius >= this.leftPaddle.x &&
      this.ball.y + this.ball.radius >= this.leftPaddle.y &&
      this.ball.y - this.ball.radius <=
        this.leftPaddle.y + this.leftPaddle.length
    ) {
      this.ball.lastHitBy = this.player1;
      const hitPosition = this.ball.y - this.leftPaddle.y;
      const segmentSize = this.leftPaddle.length / 6;
      const segment = Math.floor(hitPosition / segmentSize);
      const clampedSegment = Math.max(0, Math.min(5, segment));

      // Ensure dx is positive (moving right) when hitting left paddle
      this.ball.dx = Math.max(
        -this.MAX_SPEED,
        Math.min(this.MAX_SPEED, Math.abs(this.ball.dx * 1.1))
      );
      this.ball.dy = this.RETURN_ANGLES[clampedSegment];

      // Ensure ball is outside paddle to prevent sticking
      this.ball.x =
        this.leftPaddle.x + this.leftPaddle.width + this.ball.radius;
    }

    // Update ball position
    this.ball.x += this.ball.dx;
    this.ball.y += this.ball.dy;
  }

  updatePaddle(player, { movePaddleUp, movePaddleDown }) {
    const paddle = player === this.player1 ? this.leftPaddle : this.rightPaddle;

    paddle.move(movePaddleUp, movePaddleDown);
  }

  updateGame() {
    this.updateBall();
    this.leftPaddle.updatePosition(this.CANVAS_HEIGHT);
    this.rightPaddle.updatePosition(this.CANVAS_HEIGHT);

    let GameState = {
      Ball: this.ball,
      Paddle1: this.leftPaddle,
      Paddle2: this.rightPaddle,
      PowerUp : this.PowerUp,
    };
    return GameState;
  }
  destroy() {
    console.log(`Destroying GameManager for room: ${this.ROOM_CODE}`);

    // Clear power-up interval
    if (this.powerUpInterval) {
      clearInterval(this.powerUpInterval);
      this.powerUpInterval = null;
    }

    // Clear power-up timeout
    if (this.powerUpTimeout) {
      clearTimeout(this.powerUpTimeout);
      this.powerUpTimeout = null;
    }

    // Clear game loop interval
    if (this.gameLoopInterval) {
      clearInterval(this.gameLoopInterval);
      this.gameLoopInterval = null;
    }
  }
}

module.exports = GameManager;
