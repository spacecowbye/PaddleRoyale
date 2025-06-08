//import the ball and the paddle and the fucking mind that is supposed to build this
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
    this.PowerUpTypes = ["Downsize", "Megaform", "uKnowReverse"]; // Store available power-ups

    this.lastPowerUpType = null; // Track last generated type
    this.playerWithReversedControls = null;

    // New properties to manage active power-ups for each paddle
    this.activePowerUps = {
      [this.player1]: null, // Stores { type: "Megaform", timeoutId: timeoutId }
      [this.player2]: null,
    };
    this.powerUpTimeouts = {
      [this.player1]: null,
      [this.player2]: null,
    };

    //all intervals are here
    this.gameLoopInterval = null;
    this.powerUpTimeout = null;
    this.powerUpInterval = null;
  }

  addPlayer(player) {
    this.player2 = player;
    this.activePlayers = 2;
    // Initialize activePowerUps for player2 once they join
    this.activePowerUps[this.player2] = null;
    this.powerUpTimeouts[this.player2] = null;
  }

  updateScore(player) {
    if (player === this.player1) {
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
      this.io.to(this.ROOM_CODE).emit("GameOver", {
        winner: player,
        finalScore: {
          leftPlayerScore: this.player1Score,
          rightPlayerScore: this.player2Score,
        },
      });

      // Stop game loop instantly before ball moves again
      this.gamePaused = true;

      return;
    } else {
      // Only pause and reset ball if game isn't over
      this.gamePaused = true;
      this.ball.reset(this.CANVAS_WIDTH / 2, this.CANVAS_HEIGHT / 2);

      setTimeout(() => {
        this.gamePaused = false;
      }, 2000);
    }
  }

  setupGameLoop() {
    if (!this.gameStarted) {
      this.gameStarted = true;
      console.log(`Setting up interval at tick rate of ${this.TICK_RATE}`);

      this.powerUpTimeout = setTimeout(() => {
        this.managePowerUps();
      }, 2500);

      this.gameLoopInterval = setInterval(() => {
        // Always update paddle positions, regardless of gamePaused
        this.leftPaddle.updatePosition(this.CANVAS_HEIGHT);
        this.rightPaddle.updatePosition(this.CANVAS_HEIGHT);

        if (!this.gamePaused) {
          // Only update ball and other game state when not paused
          this.updateBall();
          // You might not need to call updatePaddle here if it's external
          // but ensure the state is emitted
        }

        // Always emit the game state, even when paused, so clients see paddle movement
        const gameState = this.getCurrentGameState(); // New method to get state
        this.io.to(this.ROOM_CODE).emit("GameUpdate", gameState);

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
    let newType;

    do {
      newType =
        this.PowerUpTypes[Math.floor(Math.random() * this.PowerUpTypes.length)];
    } while (newType === this.lastPowerUpType);

    this.PowerUp = new PowerUp(newType);
    this.lastPowerUpType = newType;

    console.log(this.PowerUp);
  }

  updateBall() {
    //POWERUP LOGIC
    if (
      this.ball &&
      this.PowerUp !== null &&
      this.ball.lastHitBy !== null &&
      !this.PowerUp.isActive && // Ensure it's not already collected
      this.ball.x + this.ball.radius >= this.PowerUp.x && // Ball's right edge past PowerUp's left edge
      this.ball.x - this.ball.radius <= this.PowerUp.x + this.PowerUp.width && // Ball's left edge before PowerUp's right edge
      this.ball.y + this.ball.radius >= this.PowerUp.y && // Ball's bottom edge past PowerUp's top edge
      this.ball.y - this.ball.radius <= this.PowerUp.y + this.PowerUp.height // Ball's top edge before PowerUp's bottom edge
    ) {
      console.log("Collision");
      const powerUpTaken = this.PowerUp;
      this.PowerUp = null;

      powerUpTaken.isActive = true;
      this.io.to(this.ROOM_CODE).emit("PowerUpTaken", {
        player: this.ball.lastHitBy,
        powerUpType: powerUpTaken.type,
        duration: Math.floor(powerUpTaken.timeToLive / 1000),
      });
      this.handlePowerUp(powerUpTaken, this.ball.lastHitBy);
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

    // If this player has reversed controls, swap the inputs
    if (this.playerWithReversedControls === player) {
      paddle.move(movePaddleDown, movePaddleUp); // Swap up and down
    } else {
      paddle.move(movePaddleUp, movePaddleDown); // Normal movement
    }
  }

 getCurrentGameState() {
    let GameState = {
      Ball: {
        x: this.ball.x,
        y: this.ball.y,
      },
      Paddle1: {
        player: this.leftPaddle.player,
        x: this.leftPaddle.x,
        y: this.leftPaddle.y,
        length: this.leftPaddle.length,
      },
      Paddle2: {
        player: this.rightPaddle.player,
        x: this.rightPaddle.x,
        y: this.rightPaddle.y,
        length: this.rightPaddle.length,
      },
      PowerUp:
        this.PowerUp !== null && this.PowerUp !== undefined
          ? {
              x: this.PowerUp.x,
              y: this.PowerUp.y,
              type: this.PowerUp.type,
            }
          : {
              x: null,
              y: null,
              type: null,
            },
    };
    return GameState;
  }

  /**
   * Clears any active power-up effect on a given paddle.
   * @param {Paddle} paddle The paddle whose power-up to clear.
   * @param {string} player The player associated with the paddle.
   */
  clearActivePowerUp(paddle, player) {
    const activePowerUp = this.activePowerUps[player];
    if (activePowerUp) {
      clearTimeout(this.powerUpTimeouts[player]);
      this.powerUpTimeouts[player] = null; // Clear the timeout ID

      // Revert the effects of the old power-up
      switch (activePowerUp.type) {
        case "Megaform":
          paddle.length -= 50;
          break;
        case "Downsize":
          // This power-up affects the opponent, so we need to find the opponent's paddle
          const opponentPaddle = (player === this.player1) ? this.rightPaddle : this.leftPaddle;
          opponentPaddle.length += 25;
          break;
        case "uKnowReverse":
          // This power-up affects the opponent, so we need to find the opponent's player identifier
          const opponentPlayer = (player === this.player1) ? this.player2 : this.player1;
          if (this.playerWithReversedControls === opponentPlayer) {
              this.playerWithReversedControls = null;
          }
          break;
      }
      console.log(`${activePowerUp.type} wore off for player: ${player} due to new powerup.`);
      this.io.to(this.ROOM_CODE).emit("PowerUpWoreOff", { player: player, type: activePowerUp.type });
      this.activePowerUps[player] = null; // Mark power-up as inactive
    }
  }


  handlePowerUp(powerUp, player) {
    if (!powerUp || !player) return;

    const playerPaddle =
      player === this.player1 ? this.leftPaddle : this.rightPaddle;
    const opponentPaddle =
      player === this.player1 ? this.rightPaddle : this.leftPaddle;
    const opponentPlayer =
      player === this.player1 ? this.player2 : this.player1;

    // Determine which player/paddle will be affected by the *new* power-up
    let affectedPlayer = null;
    let affectedPaddle = null;

    switch (powerUp.type) {
      case "Megaform":
        affectedPlayer = player;
        affectedPaddle = playerPaddle;
        break;
      case "Downsize":
      case "uKnowReverse":
        affectedPlayer = opponentPlayer;
        affectedPaddle = opponentPaddle;
        break;
      default:
        console.log("Unknown power-up type:", powerUp.type);
        return;
    }

    // Clear any existing power-up on the affected player/paddle before applying the new one
    if (affectedPlayer) {
      this.clearActivePowerUp(affectedPaddle, affectedPlayer);
    }

    // Apply the new power-up
    let timeoutId;
    switch (powerUp.type) {
      case "Megaform":
        playerPaddle.length += 50;
        timeoutId = setTimeout(() => {
          playerPaddle.length -= 50;
          this.activePowerUps[player] = null;
          this.powerUpTimeouts[player] = null;
          this.io.to(this.ROOM_CODE).emit("PowerUpWoreOff", { player: player, type: "Megaform" });
        }, powerUp.timeToLive);
        this.activePowerUps[player] = { type: "Megaform", timeoutId: timeoutId };
        this.powerUpTimeouts[player] = timeoutId;
        break;

      case "Downsize":
        opponentPaddle.length -= 25;
        timeoutId = setTimeout(() => {
          opponentPaddle.length += 25;
          this.activePowerUps[opponentPlayer] = null;
          this.powerUpTimeouts[opponentPlayer] = null;
          this.io.to(this.ROOM_CODE).emit("PowerUpWoreOff", { player: opponentPlayer, type: "Downsize" });
        }, powerUp.timeToLive);
        this.activePowerUps[opponentPlayer] = { type: "Downsize", timeoutId: timeoutId };
        this.powerUpTimeouts[opponentPlayer] = timeoutId;
        break;

      case "uKnowReverse":
        this.playerWithReversedControls = opponentPlayer;
        console.log(`Reversed controls for: ${opponentPlayer}`);

        timeoutId = setTimeout(() => {
          this.playerWithReversedControls = null;
          console.log(`Reversed controls wore off for: ${opponentPlayer}`);
          this.activePowerUps[opponentPlayer] = null;
          this.powerUpTimeouts[opponentPlayer] = null;
          this.io.to(this.ROOM_CODE).emit("PowerUpWoreOff", { player: opponentPlayer, type: "uKnowReverse" });
        }, powerUp.timeToLive);
        this.activePowerUps[opponentPlayer] = { type: "uKnowReverse", timeoutId: timeoutId };
        this.powerUpTimeouts[opponentPlayer] = timeoutId;
        break;

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

    if (this.gameLoopInterval) {
      clearInterval(this.gameLoopInterval);
      this.gameLoopInterval = null;
    }
    // Clear all active power-up timeouts
    for (const player in this.powerUpTimeouts) {
      if (this.powerUpTimeouts[player]) {
        clearTimeout(this.powerUpTimeouts[player]);
        this.powerUpTimeouts[player] = null;
      }
    }
    this.activePowerUps = { [this.player1]: null, [this.player2]: null }; // Reset active power-ups
  }
}

module.exports = GameManager;