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
const SHIELD_COLOR = "#39FF14"; // Neon green (sharp contrast, energetic)


let mySocket = null;
let countdown = null;
let activeShield = null;
// const megaformImage = new Image(); // Create a new Image object
// megaformImage.src = 'assets/images/Megaform.png'; // Set the source
// const downsizeImage = new Image();
// downsizeImage.src = 'assets/images/Downsize.png';
// const reverseImage = new Image();
// reverseImage.src = 'assets/images/unoReverse.png';
const shieldImage = new Image();
shieldImage.src = 'assets/images/shield.jpg';


const socket = io();
AudioManager.play("gameMusic");

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
  socket.on("PowerUpTaken", (data) => {
    const { player, powerUpType, duration } = data;
    console.log("Duration value:", duration, "Type:", typeof duration); // Debug line
    AudioManager.play("powerUpCollected");
    let actual = socket.id === data.player ? "You" : "Opponent";
    updatePowerupStatus(actual, powerUpType, duration);
  });
  socket.on('ShieldsUp', (data) => {
    console.log("Shields on");
    AudioManager.play("shieldsUp");
    
    activeShield = data.shield;
  });
  
  socket.on("ShieldsDown",() => {
    activeShield = null;
    AudioManager.play('shieldsDown');
  })
  socket.on("PowerUpWoreOff", () => {
    console.log("power up wore off");
    AudioManager.play("powerDown");
  });
  socket.on("disconnect", () => {
    console.log(" Disconnected from WebSocket server");
  });
  socket.on("playerLeft", (data) => {
    console.log(data);
    //showModalhere
    socket.disconnect();
    drawMessageToScreen("Redirecting you back to Homepage..");
    setTimeout(() => {
      window.location.href = `https://paddleroyale-production.up.railway.app/`;
    }, 1500);
  });
});

async function validateRoom(socketId) {
  try {
    const URLparams = new URLSearchParams(window.location.search);
    const roomCode = URLparams.get("room");
    const response = await axios.post(
      `https://paddleroyale-production.up.railway.app/join-room/${roomCode}`,
      { socketId }
    );
    console.log(response.data);
  } catch (err) {
    if (err.response && err.response.data && err.response.data.error) {
      window.alert(err.response.data.error);
    } else {
      window.alert("Something Bad Happpened");
    }

    window.location.href = `https://paddleroyale-production.up.railway.app/`;
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
  if(activeShield){
    drawShield(activeShield);
  }
}

function updatePowerupStatus(owner, powerupName, duration) {
  const powerupBox = document.getElementById("activePowerup");
  document.getElementById("powerupName").textContent = powerupName;

  const ownerElement = document.getElementById("powerupOwner");
  ownerElement.textContent = `Collected by: ${owner}`;
  ownerElement.className =
    "powerup-owner " +
    (owner.toLowerCase().includes("you") ? "owner-you" : "owner-opponent");

  document.getElementById("powerupDescription").textContent =
    getPowerupDescription(powerupName);

  // Add validation for duration
  let remaining = Math.floor(Number(duration)) || 0; // Ensure it's a number
  document.getElementById(
    "powerupTimer"
  ).textContent = `${remaining}s remaining`;

  powerupBox.classList.add("powerup-active");

  // Start countdown only if duration is valid
  if (countdown) {
    clearInterval(countdown);
    countdown = null;
  }
  if (remaining > 0) {
    const timerElement = document.getElementById("powerupTimer");
    countdown = setInterval(() => {
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
    uKnowReverse: "W goes Down and S goes up",
    Megaform: "Your paddle hit the gym. Now it's SWOLE.",
    Downsize: "Management wants a smaller paddle",
    invisibility: "Makes your paddle temporarily invisible to the opponent.",
    "multi-ball": "Spawns two additional balls for chaos!",
  };
  return (
    descriptions[name] || "This power-up has special effects during gameplay."
  );
}

function resetPowerupDisplay() {
  const powerupBox = document.getElementById("activePowerup");
  powerupBox.classList.remove("powerup-active");
  document.getElementById("powerupName").textContent = "No power-up active";
  document.getElementById("powerupOwner").textContent = "";
  document.getElementById("powerupDescription").textContent =
    "Collect a power-up during the game to see its effects here.";
  document.getElementById("powerupTimer").textContent = "";
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
  switch (type) {
    case "Megaform":
      // Outer glowing cyan rectangle
      c.fillStyle = "#00E5FF";
      c.shadowBlur = 10;
      c.shadowColor = "#00E5FF";
      c.fillRect(x, y, size, size);
      // Inner white rectangle
      const innerSize = size * 0.5;
      const innerX = x + (size - innerSize) / 2;
      const innerY = y + (size - innerSize) / 2;
      c.fillStyle = "white";
      c.shadowBlur = 0;
      c.fillRect(innerX, innerY, innerSize, innerSize);
      break;

    case "Downsize":
      // Outer glowing green rectangle
      c.fillStyle = "#00FF88";
      c.shadowBlur = 12;
      c.shadowColor = "#00FF88";
      c.fillRect(x, y, size, size);
      // Inner black rectangle
      const downsizeInnerSize = size * 0.6;
      const downsizeInnerX = x + (size - downsizeInnerSize) / 2;
      const downsizeInnerY = y + (size - downsizeInnerSize) / 2;
      c.fillStyle = "black";
      c.shadowBlur = 0;
      c.fillRect(
        downsizeInnerX,
        downsizeInnerY,
        downsizeInnerSize,
        downsizeInnerSize
      );

      break;

    case "uKnowReverse":
      // Outer glowing orange rectangle
      c.fillStyle = "#FF7700"; // Neon orange
      c.shadowBlur = 12;
      c.shadowColor = "#FF7700";
      c.fillRect(x, y, size, size);
      // Inner deep red rectangle
      const reverseInnerSize = size * 0.6;
      const reverseInnerX = x + (size - reverseInnerSize) / 2;
      const reverseInnerY = y + (size - reverseInnerSize) / 2;
      c.fillStyle = "#661100"; // Deep red for contrast
      c.shadowBlur = 0;
      c.fillRect(
        reverseInnerX,
        reverseInnerY,
        reverseInnerSize,
        reverseInnerSize
      );
      break;
    
    case "Aegis":
        // Outer glowing indigo shield
        c.fillStyle = "#6C00FF"; // Deep violet-indigo
        c.shadowBlur = 15;
        c.shadowColor = "#6C00FF";
        c.fillRect(x, y, size, size);
  
        // Inner metallic silver hexagon
        const centerX = x + size / 2;
        const centerY = y + size / 2;
        const radius = size * 0.3;
  
        c.beginPath();
        for (let i = 0; i < 6; i++) {
          const angle = Math.PI / 3 * i - Math.PI / 6;
          const px = centerX + radius * Math.cos(angle);
          const py = centerY + radius * Math.sin(angle);
          if (i === 0) {
            c.moveTo(px, py);
          } else {
            c.lineTo(px, py);
          }
        }
        c.closePath();
        c.fillStyle = "#C0C0C0"; // Metallic silver
        c.shadowBlur = 0;
        c.fill();
        break;

      
  }
}

function drawShield(shield) {
  if (!shield) return;

  const fillSpeed = 10; // pixels per frame
  if (!shield.fillHeight) shield.fillHeight = 0;

  if (shield.fillHeight < shield.height) {
    shield.fillHeight += fillSpeed;
    if (shield.fillHeight > shield.height) {
      shield.fillHeight = shield.height;
    }
  }

  const fillY = shield.y + (shield.height / 2) - (shield.fillHeight / 2);

  c.save();
  c.shadowColor = SHIELD_COLOR;
  c.shadowBlur = 20;
  c.fillStyle = SHIELD_COLOR;

  // Draw vertical fill inside shield boundary
  c.fillRect(shield.x, fillY, shield.width, shield.fillHeight);

  c.restore();
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
