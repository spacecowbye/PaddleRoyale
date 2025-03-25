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
      console.log(`setting up interval at tick rate of ${this.TICK_RATE}`);

      setInterval(() => {
        if (!this.gamePaused) {
          const gameState = this.updateGame();
          this.io.to(this.ROOM_CODE).emit("GameUpdate", gameState);
        }
      }, this.TICK_RATE);
    }
  }
  updateBall() {
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
      const hitPosition = this.ball.y - this.rightPaddle.y;
      const segmentSize = this.rightPaddle.length / 6;
      const segment = Math.floor(hitPosition / segmentSize);
      const clampedSegment = Math.max(0, Math.min(5, segment));

      // Ensure dx is negative (moving left) when hitting right paddle
      this.ball.dx = Math.max(
        -this.MAX_SPEED,
        Math.min(this.MAX_SPEED, -Math.abs(this.ball.dx * 1.08))
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
      const hitPosition = this.ball.y - this.leftPaddle.y;
      const segmentSize = this.leftPaddle.length / 6;
      const segment = Math.floor(hitPosition / segmentSize);
      const clampedSegment = Math.max(0, Math.min(5, segment));

      // Ensure dx is positive (moving right) when hitting left paddle
      this.ball.dx = Math.max(
        -this.MAX_SPEED,
        Math.min(this.MAX_SPEED, Math.abs(this.ball.dx * 1.08))
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
    };
    return GameState;
  }
}

module.exports = GameManager;
