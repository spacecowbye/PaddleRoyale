const canvas = document.querySelector("#gameCanvas");
const CANVAS_WIDTH = 652;
const CANVAS_HEIGHT = 404;

// Color constants
const BACKGROUND_COLOR = "#0A192F"; // Dark blue (Futuristic)
const BALL_COLOR = "#FF3860"; // Neon red (High contrast)
const PADDLE_COLOR = "#00E5FF"; // Neon cyan (Cool contrast)
const LINE_COLOR = "#FFFFFF"; // Soft white (Classic arcade style)
const RETURN_ANGLES = [-5, -3, -1, 1, 3, 5];
const MAX_SPEED = 12;
const PAUSE_DURATION = 1500;

canvas.width = CANVAS_WIDTH;
canvas.height = CANVAS_HEIGHT;

let player1Score = document.getElementById("player1Score");
let player2Score = document.getElementById("player2Score");
let c = canvas.getContext("2d");

// Game state
let gameStarted = false;
let gameInitialized = false;

function getRandomSpeedX() {
  return (Math.random() > 0.5 ? 1 : -1) * (6 + Math.random() * 4);
}

function getRandomSpeedY() {
  return (Math.random() > 0.5 ? 1 : -1) * (Math.random() * 1.95);
}

function createDashedLine() {
  c.beginPath();
  c.setLineDash([5, 15]);
  c.strokeStyle = LINE_COLOR;
  c.moveTo(CANVAS_WIDTH / 2, 0);
  c.lineTo(CANVAS_WIDTH / 2, CANVAS_HEIGHT);
  c.lineWidth = 5;
  c.stroke();
}

function drawStartScreen() {
  c.fillStyle = "rgba(0, 0, 0, 0.7)";
  c.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  c.font = "30px Inter";
  c.fillStyle = "#7fff7f";
  c.textAlign = "center";
  c.fillText("Press SPACE to start", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);

  c.font = "16px Inter";
  c.fillText(
    "Use W/S or Arrow Keys to move",
    CANVAS_WIDTH / 2,
    CANVAS_HEIGHT / 2 + 40
  );
}

let Ball = {
  x: CANVAS_WIDTH / 2,
  y: CANVAS_HEIGHT / 2,
  radius: 10,
  dx: getRandomSpeedX(),
  dy: getRandomSpeedY(),
  paused: false,

  draw: function () {
    c.beginPath();
    c.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    c.fillStyle = BALL_COLOR;
    c.fill();
  },

  update: function () {
    if (!gameStarted) {
      this.draw();
      return;
    }

    if (this.paused) {
      this.draw();
      return;
    }

    if (this.x + this.radius >= CANVAS_WIDTH) {
      let score = document.getElementById("player1Score");
      let actualScore = Number(score.textContent);
      actualScore++;    
      score.textContent = actualScore;
      this.reset();
    }

    if (this.x - this.radius <= 0) {
      let score = document.getElementById("player2Score");
      let actualScore = Number(score.textContent);
      actualScore++;
      score.textContent = actualScore;
      this.reset();
    }

    if (this.y + this.radius >= CANVAS_HEIGHT || this.y - this.radius <= 0) {
      this.dy = -this.dy;
    }

    if (
      this.x + this.radius >= opponentPaddle.x &&
      this.y >= opponentPaddle.y &&
      this.y <= opponentPaddle.y + opponentPaddle.length
    ) {
      const hitPosition = this.y - opponentPaddle.y;
      const segmentSize = opponentPaddle.length / 6;
      const segment = Math.floor(hitPosition / segmentSize);
      const clampedSegment = Math.max(0, Math.min(5, segment));

      this.dx = Math.max(-MAX_SPEED, Math.min(MAX_SPEED, -this.dx * 1.15)); // Cap speed
      this.dy = RETURN_ANGLES[clampedSegment];

      this.x = opponentPaddle.x - this.radius;
    }

    // Collision with player paddle
    if (
      this.x - this.radius <= playerPaddle.x + playerPaddle.width &&
      this.y >= playerPaddle.y &&
      this.y <= playerPaddle.y + playerPaddle.length
    ) {
      const hitPosition = this.y - playerPaddle.y;
      const segmentSize = playerPaddle.length / 6;
      const segment = Math.floor(hitPosition / segmentSize);
      const clampedSegment = Math.max(0, Math.min(5, segment));

      this.dx = Math.max(-MAX_SPEED, Math.min(MAX_SPEED, -this.dx * 1.15));
      this.dy = RETURN_ANGLES[clampedSegment];

      this.x = playerPaddle.x + playerPaddle.width + this.radius;
    }

    this.x += this.dx;
    this.y += this.dy;

    this.draw();
  },

  reset: function () {
    this.x = CANVAS_WIDTH / 2;
    this.y = CANVAS_HEIGHT / 2;
    this.dx = getRandomSpeedX();
    this.dy = getRandomSpeedY();
    this.paused = true;

    setTimeout(() => {
      this.paused = false;
    }, PAUSE_DURATION);

    this.draw();
  },
};

let playerPaddle = {
  x: 10,
  y: 152,
  dy: 0,
  width: 15,
  length: 100,

  draw: function () {
    c.fillStyle = PADDLE_COLOR;
    c.fillRect(this.x, this.y, this.width, this.length);
  },

  update: function () {
    if (this.y <= 0) {
      this.y = 0;
    }
    if (this.y + this.length > CANVAS_HEIGHT) {
      this.y = CANVAS_HEIGHT - this.length;
    }
    this.y += this.dy;
    this.draw();
  },
};

let opponentPaddle = {
  x: 627,
  y: 152,
  width: 15,
  length: 100,

  draw: function () {
    c.fillStyle = PADDLE_COLOR;
    c.fillRect(this.x, this.y, this.width, this.length);
  },

  // Simple AI for opponent paddle
  update: function () {},
};

function initGame() {
  if (!gameInitialized) {
    Ball.reset();
    gameInitialized = true;
  }
}

function startGame() {
  gameStarted = true;
  if (!gameInitialized) {
    initGame();
  }
  document.querySelector(".room-code-container").style.display = "none";
}

function animate() {
  requestAnimationFrame(animate);
  c.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // Draw background
  c.fillStyle = BACKGROUND_COLOR;
  c.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  createDashedLine();

  Ball.update();
  playerPaddle.update();
  opponentPaddle.draw();

  if (!gameStarted) {
    drawStartScreen();
  }
  createPowerUps();
}

// Event listeners
document.addEventListener("keydown", (event) => {
  if (event.key === "w" || event.key === "W" || event.key === "ArrowUp") {
    playerPaddle.dy = -9; // Faster movement
  }
  if (event.key === "s" || event.key === "S" || event.key === "ArrowDown") {
    playerPaddle.dy = 9;
  }
  if (event.code === "Space") {
    if (!gameStarted) {
      startGame();
    }
  }
});

document.addEventListener("keyup", (event) => {
  if (
    (event.key === "w" || event.key === "W" || event.key === "ArrowUp") &&
    playerPaddle.dy < 0
  ) {
    playerPaddle.dy = 0;
  }
  if (
    (event.key === "s" || event.key === "S" || event.key === "ArrowDown") &&
    playerPaddle.dy > 0
  ) {
    playerPaddle.dy = 0;
  }
});

// Initialize game and start animation loop
initGame();
animate();
