const canvas = document.querySelector("#gameCanvas");
const CANVAS_WIDTH = 652;
const CANVAS_HEIGHT = 404;
canvas.width = CANVAS_WIDTH;
canvas.height = CANVAS_HEIGHT;
const BALL_RADIUS = 10
const PADDLE_WIDTH = 15
let c = canvas.getContext("2d");

const BACKGROUND_COLOR = "#0A192F"; // Dark blue (Futuristic)
const BALL_COLOR = "#FF3860"; // Neon red (High contrast)
const PADDLE_COLOR = "#00E5FF"; // Neon cyan (Cool contrast)
const LINE_COLOR = "#FFFFFF"; // Soft white (Classic arcade style)

let mySocket = null;
let countdown = null;
let currentGameState = null;
let isGameRunning = false;
let isGameOver = false;
let animationId = null;

const SERVER_URL = "https://vivid-cod-spacecowbye-013de746.koyeb.app"
//const SERVER_URL = "http://localhost:8080"
const gameOverModal = document.getElementById('gameOverModal');
const gameOverTitle = document.getElementById('gameOverTitle');
const gameOverMessage = document.getElementById('gameOverMessage');
const playAgainButton = document.getElementById('playAgainButton'); // Make sure these are defined
const returnHomeButton = document.getElementById('returnHomeButton'); // Make sure these are defined

const abandonModal = document.getElementById('abandonModal');
const abandonTitle = document.getElementById('abandonTitle');
const abandonMessage = document.getElementById('abandonMessage');
const abandonReturnHomeButton = document.getElementById('abandonReturnHomeButton');


const socket = io(SERVER_URL);
if(!isGameOver)AudioManager.play("gameMusic");

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

socket.on("GameOver", (data) => {
  const { winner, finalScore} = data; // Destructure player IDs from data
  isGameOver = true; // Assuming 'isGameOver' is a global flag you use

  // It's good practice to ensure AudioManager exists and has the stop method
  if (typeof AudioManager !== 'undefined' && AudioManager.stop) {
    AudioManager.stop("gameMusic");
  } else {
    console.warn("AudioManager.stop not found or not initialized.");
    // Fallback for stopping all Howler sounds if AudioManager is custom or not ready
    if (window.Howler) {
      Howler.stop(); // Stop all sounds if AudioManager isn't working
    }
  }

  // Update the score display
  if (finalScore) {
    document.getElementById("player1Score").textContent = finalScore.leftPlayerScore;
    document.getElementById("player2Score").textContent = finalScore.rightPlayerScore;
  }

  // Determine who won from the client's perspective
  let winnerNameForDisplay;
  if (socket.id === winner) {
    winnerNameForDisplay = "You";
    if (typeof AudioManager !== 'undefined' && AudioManager.play) {
      setTimeout(() => { 
        AudioManager.play("gameEnd");
      }, 653);
    }
  } else {
    winnerNameForDisplay = "Opponent";
    if (typeof AudioManager !== 'undefined' && AudioManager.play) {
      setTimeout(() => {
        AudioManager.play("gameEnd"); 
      }, 500);
    }
  }

  // Show the game over screen
  showGameOverScreen(winnerNameForDisplay);

  // Clean up socket connection after delay
  setTimeout(() => {
    cleanupSocketEvents();
    socket.disconnect();
  }, 3000);
});



let celebrationParticles = [];
let celebrationActive = false;
let celebrationStartTime = 0;

function showGameOverScreen(winnerDisplayString) {
    console.log("Game over detected. Displaying modal with celebration.");
    
    if (animationId) {
        cancelAnimationFrame(animationId);
    }

  if (winnerDisplayString === "You") {
    gameOverTitle.textContent = "YOU WON";
    gameOverMessage.textContent = "Nicely done!";
    startVictoryCelebration();
} else if (winnerDisplayString === "Opponent") {
    gameOverTitle.textContent = "YOU LOST";
    gameOverMessage.textContent = "Better luck next time!";
    startDefeatEffect();
} else {
    gameOverTitle.textContent = "Game Abandoned!";
    gameOverMessage.textContent = "The game ended unexpectedly.";
}

    if (gameOverModal) {
        gameOverModal.style.display = 'flex';
        gameOverModal.style.transform = 'scale(0.8)';
        gameOverModal.style.opacity = '0';
        requestAnimationFrame(() => {
            gameOverModal.style.transition = 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)';
            gameOverModal.style.transform = 'scale(1)';
            gameOverModal.style.opacity = '1';
        });
    }
}

function startVictoryCelebration() {
    celebrationActive = true;
    celebrationStartTime = Date.now();
    celebrationParticles = [];

    for (let i = 0; i < 70; i++) {
        celebrationParticles.push({
            x: Math.random() * CANVAS_WIDTH,
            y: Math.random() * CANVAS_HEIGHT,
            vx: (Math.random() - 0.5) * 8,
            vy: (Math.random() - 0.5) * 8,
            size: Math.random() * 6 + 3,
            color: ['#39FF14', '#00FFFF', '#FF00FF', '#FFD700'][i % 4],
            life: 1.0,
            trail: [],
            type: Math.random() < 0.6 ? 'ball' : 'spark'
        });
    }

    flashCanvas('#00FFFF', 0.6);
    showNeonText("YOU DOMINATED!", '#39FF14');
    setTimeout(() => showNeonText("Better unplug, loser 😎", '#FF00FF'), 1000);
    celebrationLoop();
}

function startDefeatEffect() {
    flashCanvas('#FF0033', 0.4);
    celebrationActive = true;
    celebrationStartTime = Date.now();
    celebrationParticles = [];

    for (let i = 0; i < 60; i++) {
        celebrationParticles.push({
            x: CANVAS_WIDTH / 2 + (Math.random() - 0.5) * 100,
            y: CANVAS_HEIGHT / 2 + (Math.random() - 0.5) * 50,
            vx: (Math.random() - 0.5) * 1.5,
            vy: Math.random() * 2 + 1,
            size: Math.random() * 3 + 2,
            color: ['#FF4444', '#660000', '#999999'][i % 3],
            life: 0.9,
            trail: [],
            type: 'spark'
        });
    }

    showNeonText("YOU LOSE", '#FF4444');
    setTimeout(() => showNeonText("That was... embarrassing 😬", '#999999'), 1200);
    celebrationLoop();
}

function celebrationLoop() {
    if (!celebrationActive) return;

    c.fillStyle = BACKGROUND_COLOR;
    c.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    drawCenterLine();

    celebrationParticles.forEach((particle, index) => {
        particle.x += particle.vx;
        particle.y += particle.vy;

        if (particle.x <= particle.size || particle.x >= CANVAS_WIDTH - particle.size) {
            particle.vx *= -0.9;
            particle.x = Math.max(particle.size, Math.min(CANVAS_WIDTH - particle.size, particle.x));
        }
        if (particle.y <= particle.size || particle.y >= CANVAS_HEIGHT - particle.size) {
            particle.vy *= -0.9;
            particle.y = Math.max(particle.size, Math.min(CANVAS_HEIGHT - particle.size, particle.y));
        }

        particle.trail.push({ x: particle.x, y: particle.y });
        if (particle.trail.length > 6) particle.trail.shift();

        particle.trail.forEach((pos, i) => {
            const alpha = (i / particle.trail.length) * particle.life * 0.4;
            c.globalAlpha = alpha;
            c.fillStyle = particle.color;
            const trailSize = particle.size * (i / particle.trail.length) * 0.6;
            if (particle.type === 'ball') {
                c.beginPath();
                c.arc(pos.x, pos.y, trailSize, 0, Math.PI * 2);
                c.fill();
            } else {
                c.fillRect(pos.x - trailSize / 2, pos.y - trailSize / 2, trailSize, trailSize);
            }
        });

        c.globalAlpha = particle.life;
        c.shadowColor = particle.color;
        c.shadowBlur = 15;
        c.fillStyle = particle.color;
        if (particle.type === 'ball') {
            c.beginPath();
            c.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
            c.fill();
        } else {
            c.fillRect(particle.x - particle.size / 2, particle.y - particle.size / 2, particle.size, particle.size);
        }

        c.shadowBlur = 0;
        c.globalAlpha = 1;

        particle.life -= 0.012;
        particle.size *= 0.998;
        if (particle.life <= 0) {
            celebrationParticles.splice(index, 1);
        }
    });

    const elapsed = Date.now() - celebrationStartTime;
    if (celebrationParticles.length > 0 && elapsed < 4000) {
        requestAnimationFrame(celebrationLoop);
    } else {
        celebrationActive = false;
        c.fillStyle = BACKGROUND_COLOR;
        c.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        drawCenterLine();
    }
}

function flashCanvas(color, intensity = 0.5) {
    const originalComposite = c.globalCompositeOperation;
    c.globalCompositeOperation = 'screen';
    c.globalAlpha = intensity;
    c.fillStyle = color;
    c.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    c.globalAlpha = 1;
    c.globalCompositeOperation = originalComposite;

    setTimeout(() => {
        c.fillStyle = BACKGROUND_COLOR;
        c.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        drawCenterLine();
    }, 150);
}

function drawCenterLine() {
    c.strokeStyle = LINE_COLOR;
    c.lineWidth = 2;
    c.setLineDash([10, 10]);
    c.beginPath();
    c.moveTo(CANVAS_WIDTH / 2, 0);
    c.lineTo(CANVAS_WIDTH / 2, CANVAS_HEIGHT);
    c.stroke();
    c.setLineDash([]);
}

function showNeonText(textContent, color) {
    const text = document.createElement('div');
    text.textContent = textContent;
    text.style.position = 'absolute';
    text.style.top = '45%';
    text.style.left = '50%';
    text.style.transform = 'translate(-50%, -50%) scale(0.8)';
    text.style.fontSize = '48px';
    text.style.fontFamily = `'Orbitron', sans-serif`;
    text.style.color = color;
    text.style.textShadow = `0 0 8px ${color}, 0 0 20px ${color}`;
    text.style.transition = 'all 0.5s ease';
    text.style.opacity = '0';

    document.body.appendChild(text);

    requestAnimationFrame(() => {
        text.style.opacity = '1';
        text.style.transform = 'translate(-50%, -50%) scale(1.2)';
    });

    setTimeout(() => {
        text.style.opacity = '0';
        text.style.transform = 'translate(-50%, -50%) scale(0.9)';
        setTimeout(() => text.remove(), 1000);
    }, 1800);
}




playAgainButton.addEventListener('click', async () => {
    if (gameOverModal) {
        gameOverModal.style.display = 'none'; // Hide the modal
    }
    // Perform necessary cleanup before leaving
    stopRenderLoop();
    cleanupSocketEvents();
    cleanupPowerupTimers();
    if (typeof AudioManager !== 'undefined' && AudioManager.stop) {
      AudioManager.stop("gameMusic");
      AudioManager.stop("gameEnd");
      if (typeof AudioManager.cleanup === 'function') {
         AudioManager.cleanup();
      }
    }
    if (socket && socket.connected) { // Only disconnect if connected
        socket.disconnect();
    }

    // Request a new room from the server and redirect
    try {
        console.log("Requesting a new room...");
        const response = await axios.post(`${SERVER_URL}/create-room`);
        const {roomCode} = response.data;
        console.log("New room created:", roomCode);
        window.location.replace(`${SERVER_URL}/game.html?room=${roomCode}`);
    } catch (error) {
        console.error("Failed to create new room:", error);
        // Fallback to going home or showing an error if creating a room fails
        window.location.replace(SERVER_URL);
    }
});

returnHomeButton.addEventListener('click', () => {
    if (gameOverModal) {
        gameOverModal.style.display = 'none'; // Hide the modal
    }
    // Perform necessary cleanup before leaving
    stopRenderLoop();
    cleanupSocketEvents();
    cleanupPowerupTimers();
    if (typeof AudioManager !== 'undefined' && AudioManager.stop) {
      AudioManager.stop("gameMusic");
      AudioManager.stop("gameEnd");
       if (typeof AudioManager.cleanup === 'function') {
         AudioManager.cleanup();
      }
    }
    if (socket && socket.connected) {
        socket.disconnect();
    }
    window.location.replace('index.html'); // Navigate back to the home page
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
    currentGameState = GameState;

    // Start the render loop if it's not already running
    if (!isGameRunning) {
      isGameRunning = true;
      startRenderLoop();
    }
  });

  socket.on("PowerUpTaken", (data) => {
    const { player, powerUpType, duration } = data;
    console.log("Duration value:", duration, "Type:", typeof duration); // Debug line
    if(!isGameOver)AudioManager.play("powerUpCollected");
    let actual = socket.id === data.player ? "You" : "Opponent";
    updatePowerupStatus(actual, powerUpType, duration);
  });

  socket.on("PowerUpWoreOff", () => {
    console.log("power up wore off");
    if(!isGameOver)AudioManager.play("powerDown");
  });
  socket.on("disconnect", () => {
    console.log(" Disconnected from WebSocket server");
  });
  socket.on("playerLeft", (data) => {
  if (abandonModal) {
    abandonModal.style.display = 'flex';
    abandonModal.style.transform = 'scale(0.8)';
    abandonModal.style.opacity = '0';
    requestAnimationFrame(() => {
      abandonModal.style.transition = 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)';
      abandonModal.style.transform = 'scale(1)';
      abandonModal.style.opacity = '1';
    });
  }
  stopRenderLoop();
  socket.disconnect();
  setTimeout(() => {
    window.location.replace(`${SERVER_URL}/index.html`);
  }, 3000);
});
});

async function validateRoom(socketId) {
  try {
    const URLparams = new URLSearchParams(window.location.search);
    const roomCode = URLparams.get("room");
    const response = await axios.post(
      `${SERVER_URL}/join-room/${roomCode}`,
      { socketId }
    );
    console.log(response.data);
  } catch (err) {
    if (err.response && err.response.data && err.response.data.error) {
      window.alert(err.response.data.error);
    } else {
      window.alert("Something Bad Happpened");
    }
    window.location.replace(SERVER_URL);
  }
}
function startRenderLoop() {
  function render() {
    if (isGameRunning && currentGameState) {
      // Clear and render the current game state
      renderGame(currentGameState);
    }

    // Continue the loop
    animationId = requestAnimationFrame(render);
  }

  // Start the loop
  animationId = requestAnimationFrame(render);
}

function renderGame(GameState) {
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

function stopRenderLoop() {
  if (animationId) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }
  isGameRunning = false;
}

// Add cleanup function for socket events
function cleanupSocketEvents() {
  if (socket) {
    socket.off("connect");
    socket.off("youJoined");
    socket.off("GameOver");
    socket.off("CountDownUpdate");
    socket.off("ScoreUpdate");
    socket.off("GameUpdate");
    socket.off("PowerUpTaken");
    socket.off("PowerUpWoreOff");
    socket.off("disconnect");
    socket.off("playerLeft");
  }
}

// Add cleanup function for power-up timers
function cleanupPowerupTimers() {
  if (countdown) {
    clearInterval(countdown);
    countdown = null;
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
    //uKnowReverse: "W goes Down and S goes up",
    Megaform: "The paddle hit the gym. Now it's SWOLE.",
    Downsize: "Management wants a smaller paddle",
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
  c.fillRect(Paddle.x, Paddle.y, PADDLE_WIDTH, Paddle.length);
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

    // case "uKnowReverse":
    //   // Outer glowing orange rectangle
    //   c.fillStyle = "#FF7700"; // Neon orange
    //   c.shadowBlur = 12;
    //   c.shadowColor = "#FF7700";
    //   c.fillRect(x, y, size, size);
    //   // Inner deep red rectangle
    //   const reverseInnerSize = size * 0.6;
    //   const reverseInnerX = x + (size - reverseInnerSize) / 2;
    //   const reverseInnerY = y + (size - reverseInnerSize) / 2;
    //   c.fillStyle = "#661100"; // Deep red for contrast
    //   c.shadowBlur = 0;
    //   c.fillRect(
    //     reverseInnerX,
    //     reverseInnerY,
    //     reverseInnerSize,
    //     reverseInnerSize
    //   );
    //   break;
  }
}

function drawBall(Ball) {
  if (
    !Ball ||
    Ball.x === undefined ||
    Ball.y === undefined 
  ) {
    return;
  }
  c.beginPath();
  c.arc(Ball.x, Ball.y, BALL_RADIUS, 0, Math.PI * 2);
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

// Add window unload handler
window.addEventListener('beforeunload', () => {
  stopRenderLoop();
  cleanupSocketEvents();
  cleanupPowerupTimers();
  cleanupCelebration();
  if (typeof AudioManager !== 'undefined' && AudioManager.stop) {
    AudioManager.stop("gameMusic");
    AudioManager.stop("gameEnd");
  }
});
