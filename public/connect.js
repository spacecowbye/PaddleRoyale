const canvas = document.querySelector("#gameCanvas");
const CANVAS_WIDTH = 652;
const CANVAS_HEIGHT = 404;
canvas.width = CANVAS_WIDTH;
canvas.height = CANVAS_HEIGHT;
let c = canvas.getContext("2d");

const BACKGROUND_COLOR = "#0A192F"; // Dark blue (Futuristic)
const BALL_COLOR = "#FF3860"; // Neon red (High contrast)
const PADDLE_COLOR = "#00E5FF"; // Neon cyan (Cool contrast)
const LINE_COLOR = "#FFFFFF"; // Soft white (Classic arcade style)

let mySocket = null;

const socket = io();

socket.on("connect", async () => {
  mySocket = socket.id;
  console.log(" Connected to WebSocket server:", socket.id);
  let socketId = socket.id;
  await validateRoom(socketId);
  const URLparams = new URLSearchParams(window.location.search);
  const roomCode = URLparams.get("room");

  socket.emit("joinRoom", roomCode);
  socket.on("youJoined", (data) => {
    console.log(data);
  });
  socket.on("CountDownUpdate", (data) => {
    drawMessageToScreen(data);
  });
  socket.on("ScoreUpdate", (data) => {
    const { leftPlayerScore, rightPlayerScore } = data;

    document.getElementById("player1Score").textContent = leftPlayerScore;
    document.getElementById("player2Score").textContent = rightPlayerScore;
  });

  socket.on("GameUpdate", (GameState) => {
    requestAnimationFrame(() => {
      startGameLoop(GameState);
    });
  });

  socket.on("disconnect", () => {
    console.log(" Disconnected from WebSocket server");
  });
  socket.on("playerLeft", (data) => {
    console.log(data);
    //showModalhere
  });
});

async function validateRoom(socketId) {
  try {
    const URLparams = new URLSearchParams(window.location.search);
    const roomCode = URLparams.get("room");
    const response = await axios.post(
      `http://localhost:8080/join-room/${roomCode}`,
      { socketId }
    );
    console.log(response.data);
  } catch (err) {
    if (err.response && err.response.data && err.response.data.error) {
      window.alert(err.response.data.error);
    } else {
      window.alert("Something Bad Happpened");
    }

    window.location.href = `http://localhost:8080/`;
  }
}
function startGameLoop(GameState) {
  c.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // Draw background first
  c.fillStyle = BACKGROUND_COLOR;
  c.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  createDashedLine();

  // Draw the ball only if valid
  const { Ball, Paddle1, Paddle2, PowerUp } = GameState;
  if (
    Ball &&
    Ball.x !== undefined &&
    Ball.y !== undefined &&
    Ball.radius !== undefined
  ) {
    drawBall(Ball);
  }
  let myPaddle, opponentPaddle;
  if (Paddle1.player === socket.id) {
    myPaddle = Paddle1;
    opponentPaddle = Paddle2;
  } else {
    myPaddle = Paddle2;
    opponentPaddle = Paddle1;
  }

  if (myPaddle) {
    drawPaddle(myPaddle, true);
  }
  if (opponentPaddle) {
    drawPaddle(opponentPaddle, false);
  }
  if (PowerUp) {
    drawPowerUp(PowerUp);
  }
}
function drawPaddle(Paddle) {
  c.fillStyle = PADDLE_COLOR;
  c.fillRect(Paddle.x, Paddle.y, Paddle.width, Paddle.length);
}
function drawPowerUp(powerUp) {
  if (!powerUp) return;

  const size = powerUp.width; // Fixed size (24x24)
  const x = powerUp.x;
  const y = powerUp.y;

  // Outer glowing cyan rectangle
  c.fillStyle = "#00E5FF";
  c.shadowBlur = 10;
  c.shadowColor = "#00E5FF";
  c.fillRect(x, y, size, size);
  // Inner white rectangle (smaller for effect)
  const innerSize = size * 0.5;
  const innerX = x + (size - innerSize) / 2;
  const innerY = y + (size - innerSize) / 2;

  c.fillStyle = "white";
  c.shadowBlur = 0;
  c.fillRect(innerX, innerY, innerSize, innerSize);
}
function drawBall(Ball) {
  if (
    !Ball ||
    Ball.x === undefined ||
    Ball.y === undefined ||
    Ball.radius === undefined
  ) {
    return;
  }
  c.beginPath();
  c.arc(Ball.x, Ball.y, Ball.radius, 0, Math.PI * 2);
  c.fillStyle = BALL_COLOR;
  c.fill();
  c.closePath();
}

function drawMessageToScreen(message) {
  c.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  c.fillStyle = "rgba(0,0,0,0.7)";
  c.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  c.font = "30px Inter";
  c.fillStyle = "#7fff7f";
  c.textAlign = "center";
  c.fillText(message, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 10);
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
document.addEventListener("keydown", (event) => {
  if (event.key === "w" || event.key === "W" || event.key === "ArrowUp") {
    socket.emit("PADDLE_UP");
  }
  if (event.key === "s" || event.key === "S" || event.key === "ArrowDown") {
    socket.emit("PADDLE_DOWN");
  }
});
document.addEventListener("keyup", (event) => {
  if (
    event.key === "w" ||
    event.key === "W" ||
    event.key === "ArrowUp" ||
    event.key === "s" ||
    event.key === "S" ||
    event.key === "ArrowDown"
  ) {
    socket.emit("PADDLE_STOP");
  }
});
