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
let isGlowing = false;
let glowColor = null;

const socket = io();
AudioManager.play('gameMusic')

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
  socket.on('PowerUpTaken',(data)=>{
    const { player, powerUpType, duration } = data;
    console.log('Duration value:', duration, 'Type:', typeof duration); // Debug line
    AudioManager.play('powerUpCollected');
    let actual = socket.id === data.player ? "You" : "Opponent";
    updatePowerupStatus(actual, powerUpType, duration);
  });
  socket.on('PowerUpWoreOff',() =>{
    console.log("power up wore off");
    AudioManager.play('powerDown');
    
  })
  socket.on("disconnect", () => {
    console.log(" Disconnected from WebSocket server");
  });
  socket.on("playerLeft", (data) => {
    console.log(data);
    //showModalhere 
    socket.disconnect();
    drawMessageToScreen("Redirecting you back to Homepage..");
    setTimeout(() => {
      window.location.href = `http://localhost:8080/index.html`;
    },1500);
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


function updatePowerupStatus(owner, powerupName, duration) {
  const powerupBox = document.getElementById('activePowerup');
  document.getElementById('powerupName').textContent = powerupName;
  
  const ownerElement = document.getElementById('powerupOwner');
  ownerElement.textContent = `Collected by: ${owner}`;
  ownerElement.className = 'powerup-owner ' + 
    (owner.toLowerCase().includes('you') ? 'owner-you' : 'owner-opponent');
  
  document.getElementById('powerupDescription').textContent = getPowerupDescription(powerupName);
  
  // Add validation for duration
  let remaining = Math.floor(Number(duration)) || 0; // Ensure it's a number
  document.getElementById('powerupTimer').textContent = `${remaining}s remaining`;
  
  powerupBox.classList.add('powerup-active');
  
  // Start countdown only if duration is valid
  if (remaining > 0) {
    const timerElement = document.getElementById('powerupTimer');
    const countdown = setInterval(() => {
      remaining--;
      timerElement.textContent = `${remaining}s remaining`;
      if (remaining <= 0) {
        clearInterval(countdown);
        resetPowerupDisplay();
      }
    }, 1000);
  }
}

function getPowerupDescription(name) {
  const descriptions = {
    'speed boost': 'Increases paddle movement speed by 50% for a limited time.',
    'Megaform': 'Makes your paddle 50% larger, giving you more reach.',
    'Downsize': 'Management wants a smaller paddle',
    'invisibility': 'Makes your paddle temporarily invisible to the opponent.',
    'multi-ball': 'Spawns two additional balls for chaos!'
  };
  return descriptions[name] || 'This power-up has special effects during gameplay.';
}

function resetPowerupDisplay() {
  const powerupBox = document.getElementById('activePowerup');
  powerupBox.classList.remove('powerup-active');
  document.getElementById('powerupName').textContent = 'No power-up active';
  document.getElementById('powerupOwner').textContent = '';
  document.getElementById('powerupDescription').textContent = 'Collect a power-up during the game to see its effects here.';
  document.getElementById('powerupTimer').textContent = '';
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
    const type = powerUp.type;
    
    switch(type){
      case 'Megaform':
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
        break;
        case 'Downsize':
          // Outer glowing green rectangle
          c.fillStyle = "#00FF88";  // Brighter green
          c.shadowBlur = 12;        // Stronger glow for emphasis
          c.shadowColor = "#00FF88";
          c.fillRect(x, y, size, size);
      
          // Inner black rectangle (for contrast effect)
          const downsizeInnerSize = size * 0.6;  // Slightly bigger than Megaform's inner shape
          const downsizeInnerX = x + (size - downsizeInnerSize) / 2;
          const downsizeInnerY = y + (size - downsizeInnerSize) / 2;
      
          c.fillStyle = "black";  // Strong contrast
          c.shadowBlur = 0;
          c.fillRect(downsizeInnerX, downsizeInnerY, downsizeInnerSize, downsizeInnerSize);
          break;
  }

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
