const Ball = require("./models/Ball");
const Paddle = require("./models/Paddle");
const PowerUp = require("./models/Collectible");

class GameManager {
  constructor(roomCode, player, io) {
    // ROOM CONSTANTS
    this.ROOM_CODE = roomCode;
    this.player1 = player;
    this.player2 = null;
    this.activePlayers = 1;

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
    this.PowerUpTypes = ["Downsize", "Megaform"];

    this.lastPowerUpType = null;
    this.playerWithReversedControls = null;

    // Dedicated objects to store paddle power-up effects and their timeouts
    this.paddlePowerUpTimers = {
      [this.player1]: {}, // Stores { powerUpType: timeoutId } for player1's paddle
      [this.player2]: {}, // Stores { powerUpType: timeoutId } for player2's paddle
    };

    //all intervals are here
    this.gameLoopInterval = null;
    this.powerUpTimeout = null;
    this.powerUpInterval = null;
    // this.handlePowerupTimeout = null; // This single variable is the source of the problem, remove it
  }

  addPlayer(player) {
    this.player2 = player;
    this.activePlayers = 2;
    // Initialize paddlePowerUpTimers for player2 once they join
    this.paddlePowerUpTimers[this.player2] = {};
    // Assign player2 to rightPaddle after they join
    this.rightPaddle.assignPlayer(player); // Assuming Paddle class has an assignPlayer method
  }

  updateScore(scoringPlayer) {
    if (scoringPlayer === this.player1) {
      this.player1Score += 1;
    } else {
      this.player2Score += 1;
    }

    this.io.to(this.ROOM_CODE).emit("ScoreUpdate", {
      leftPlayerScore: this.player1Score,
      rightPlayerScore: this.player2Score,
    });

    const isGameOver = this.player1Score >= 10 || this.player2Score >= 10;

    if (isGameOver) {
      const winner = this.player1Score >= 10 ? this.player1 : this.player2;
      this.io.to(this.ROOM_CODE).emit("GameOver", {
        winner: winner,
        finalScore: {
          leftPlayerScore: this.player1Score,
          rightPlayerScore: this.player2Score,
        },
      });
      this.gamePaused = true;
      return;
    }

    this.gamePaused = true;
    this.ball.reset(this.CANVAS_WIDTH / 2, this.CANVAS_HEIGHT / 2);

    setTimeout(() => {
      this.gamePaused = false;
    }, this.PAUSE_DURATION);
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
    // Clear any existing powerUpInterval before setting a new one
    if (this.powerUpInterval) {
        clearInterval(this.powerUpInterval);
    }

    if (!this.PowerUp) {
      this.spawnPowerUp();
      this.powerUpInterval = setInterval(() => {
        if (this.PowerUp) {
          console.log("PowerUp wasn't collected and exhausted its lifetime.");
          this.PowerUp = null;
          // After a power-up expires naturally, wait a bit before spawning a new one
          setTimeout(() => {
            this.spawnPowerUp();
          }, Math.random() * (3000 - 1000) + 1500);
        } else {
          // If no power-up exists, spawn one immediately
          this.spawnPowerUp();
        }
      }, 15 * 1000); // Check every 15 seconds if a power-up needs to be spawned/removed
    }
  }

  spawnPowerUp() {
    let newType;

    do {
      newType =
        this.PowerUpTypes[Math.floor(Math.random() * this.PowerUpTypes.length)];
    } while (newType === this.lastPowerUpType);

    this.PowerUp = new PowerUp(newType);
    this.lastPowerUpType = newType;

    console.log("Spawned PowerUp:", this.PowerUp);
    this.io.to(this.ROOM_CODE).emit("PowerUpSpawned", {
        type: this.PowerUp.type,
        x: this.PowerUp.x,
        y: this.PowerUp.y
    });
  }

  updateBall() {
    //POWERUP LOGIC (Collision with PowerUp)
    if (
      this.ball &&
      this.PowerUp !== null &&
      this.ball.lastHitBy !== null &&
      !this.PowerUp.isActive &&
      this.ball.x + this.ball.radius >= this.PowerUp.x &&
      this.ball.x - this.ball.radius <= this.PowerUp.x + this.PowerUp.width &&
      this.ball.y + this.ball.radius >= this.PowerUp.y &&
      this.ball.y - this.ball.radius <= this.PowerUp.y + this.PowerUp.height
    ) {
      console.log("PowerUp Collision Detected!");
      const powerUpTaken = this.PowerUp;
      this.PowerUp = null; // Remove from game world immediately after collection

      powerUpTaken.isActive = true; // Mark as active (for client-side logic if needed)
      this.io.to(this.ROOM_CODE).emit("PowerUpTaken", {
        player: this.ball.lastHitBy,
        powerUpType: powerUpTaken.type,
        duration: Math.floor(powerUpTaken.timeToLive / 1000),
      });
      this.handlePowerUp(powerUpTaken, this.ball.lastHitBy);

      // Reset the power-up interval so a new one spawns sooner
      clearInterval(this.powerUpInterval);
      this.powerUpInterval = null; // Clear it to allow managePowerUps to set a new one
      setTimeout(() => { // Schedule the next power-up check
        this.managePowerUps();
      }, Math.random() * (3000 - 1000) + 1500); // Shorter delay after collection
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

      this.ball.dx = Math.max(
        -this.MAX_SPEED,
        Math.min(this.MAX_SPEED, -Math.abs(this.ball.dx * 1.1))
      );
      this.ball.dy = this.RETURN_ANGLES[clampedSegment];

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

      this.ball.dx = Math.max(
        -this.MAX_SPEED,
        Math.min(this.MAX_SPEED, Math.abs(this.ball.dx * 1.1))
      );
      this.ball.dy = this.RETURN_ANGLES[clampedSegment];

      this.ball.x =
        this.leftPaddle.x + this.leftPaddle.width + this.ball.radius;
    }

    // Update ball position
    this.ball.x += this.ball.dx;
    this.ball.y += this.ball.dy;
  }

  updatePaddle(player, { movePaddleUp, movePaddleDown }) {
    const paddle = player === this.player1 ? this.leftPaddle : this.rightPaddle;

    if (this.playerWithReversedControls === player) {
      paddle.move(movePaddleDown, movePaddleUp);
    } else {
      paddle.move(movePaddleUp, movePaddleDown);
    }
  }

  updateGame() {
    this.updateBall();
    this.leftPaddle.updatePosition(this.CANVAS_HEIGHT);
    this.rightPaddle.updatePosition(this.CANVAS_HEIGHT);

    let GameState = {
      Ball: this.ball,
      Paddle1: this.leftPaddle,
      Paddle2: this.rightPaddle,
      PowerUp: this.PowerUp,
    };
    return GameState;
  }

  handlePowerUp(powerUp, collectingPlayer) {
    if (!powerUp || !collectingPlayer) return;

    const playerPaddle = collectingPlayer === this.player1 ? this.leftPaddle : this.rightPaddle;
    const opponentPaddle = collectingPlayer === this.player1 ? this.rightPaddle : this.leftPaddle;
    const opponentPlayer = collectingPlayer === this.player1 ? this.player2 : this.player1;

    // Get the object storing timers for the affected paddle (could be playerPaddle or opponentPaddle)
    let affectedPaddleTimers;
    let affectedPaddle;
    let affectedPlayer;

    switch (powerUp.type) {
      case "Megaform":
        affectedPaddleTimers = this.paddlePowerUpTimers[collectingPlayer];
        affectedPaddle = playerPaddle;
        affectedPlayer = collectingPlayer;
        // Clear any existing Megaform timer for this player
        if (affectedPaddleTimers["Megaform"]) {
          clearTimeout(affectedPaddleTimers["Megaform"]);
          console.log(`Cleared existing Megaform for ${affectedPlayer}`);
          // Immediately reverse the previous effect if active, though not strictly needed here unless stacking
          // affectedPaddle.length -= 50; // Only if you want to prevent stacking
        }
        affectedPaddle.length += 50;
        console.log(`Applied Megaform to ${affectedPlayer}`);
        affectedPaddleTimers["Megaform"] = setTimeout(() => {
          affectedPaddle.length -= 50;
          console.log(`Megaform wore off for ${affectedPlayer}`);
          this.io.to(this.ROOM_CODE).emit("PowerUpWoreOff", { player: affectedPlayer, type: "Megaform" });
          delete affectedPaddleTimers["Megaform"]; // Clean up reference
        }, powerUp.timeToLive);
        break;

      case "Downsize":
        affectedPaddleTimers = this.paddlePowerUpTimers[opponentPlayer]; // Downsize affects opponent
        affectedPaddle = opponentPaddle;
        affectedPlayer = opponentPlayer;
        // Clear any existing Downsize timer for the opponent
        if (affectedPaddleTimers["Downsize"]) {
          clearTimeout(affectedPaddleTimers["Downsize"]);
          console.log(`Cleared existing Downsize for ${affectedPlayer}`);
          // Immediately reverse the previous effect if active
          // affectedPaddle.length += 25; // Only if you want to prevent stacking
        }
        affectedPaddle.length -= 25;
        console.log(`Applied Downsize to ${affectedPlayer}`);
        affectedPaddleTimers["Downsize"] = setTimeout(() => {
          affectedPaddle.length += 25;
          console.log(`Downsize wore off for ${affectedPlayer}`);
          this.io.to(this.ROOM_CODE).emit("PowerUpWoreOff", { player: affectedPlayer, type: "Downsize" });
          delete affectedPaddleTimers["Downsize"]; // Clean up reference
        }, powerUp.timeToLive);
        break;

      // case "uKnowReverse": // If you uncomment this, apply similar logic
      //   this.playerWithReversedControls = opponentPlayer;
      //   // You'd need to manage a timer for this as well in paddlePowerUpTimers
      //   // Example:
      //   // affectedPaddleTimers = this.paddlePowerUpTimers[opponentPlayer];
      //   // if (affectedPaddleTimers["uKnowReverse"]) {
      //   //   clearTimeout(affectedPaddleTimers["uKnowReverse"]);
      //   // }
      //   // affectedPaddleTimers["uKnowReverse"] = setTimeout(() => {
      //   //   this.playerWithReversedControls = null;
      //   //   this.io.to(this.ROOM_CODE).emit("PowerUpWoreOff", { player: opponentPlayer, type: "uKnowReverse" });
      //   //   delete affectedPaddleTimers["uKnowReverse"];
      //   // }, powerUp.timeToLive);
      //   break;

      default:
        console.log("Unknown power-up type:", powerUp.type);
    }
  }

  destroy() {
    console.log(`Destroying GameManager for room: ${this.ROOM_CODE}`);

    if (this.powerUpInterval) {
      clearInterval(this.powerUpInterval);
      this.powerUpInterval = null;
    }

    if (this.powerUpTimeout) {
      clearTimeout(this.powerUpTimeout);
      this.powerUpTimeout = null;
    }

    // Clear all pending power-up timeouts
    for (const player in this.paddlePowerUpTimers) {
      for (const powerUpType in this.paddlePowerUpTimers[player]) {
        clearTimeout(this.paddlePowerUpTimers[player][powerUpType]);
      }
    }
    this.paddlePowerUpTimers = {
      [this.player1]: {},
      [this.player2]: {},
    }; // Reset to empty objects

    // Don't nullify everything, only specific intervals/timeouts
    this.gameStarted = false;
    this.gameInitialized = false;
    this.gamePaused = false;
    this.player1Score = 0;
    this.player2Score = 0;
    this.ball = null;
    this.leftPaddle = null;
    this.rightPaddle = null;
    this.PowerUp = null;
    this.lastPowerUpType = null;
    this.playerWithReversedControls = null;
    this.gameLoopInterval = null;
  }
}

module.exports = GameManager