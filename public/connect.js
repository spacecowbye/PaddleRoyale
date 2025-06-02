const canvas = document.querySelector("#gameCanvas");
const CANVAS_WIDTH = 652;
const CANVAS_HEIGHT = 404;
canvas.width = CANVAS_WIDTH;
canvas.height = CANVAS_HEIGHT;
let c = canvas.getContext("2d");
const SERVER_URL = "https://polite-leticia-spacecowbye-452d654d.koyeb.app"; // Your Koyeb app URL

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

const gameOverModal = document.getElementById('gameOverModal');
const gameOverTitle = document.getElementById('gameOverTitle');
const gameOverMessage = document.getElementById('gameOverMessage');
const playAgainButton = document.getElementById('playAgainButton');
const returnHomeButton = document.getElementById('returnHomeButton');

const abandonModal = document.getElementById('abandonModal');
const abandonTitle = document.getElementById('abandonTitle');
const abandonMessage = document.getElementById('abandonMessage');
const abandonReturnHomeButton = document.getElementById('abandonReturnHomeButton');

// --- CRITICAL CHANGE START ---
// Get roomCode from URL parameters BEFORE initializing socket
const URLparams = new URLSearchParams(window.location.search);
const roomCode = URLparams.get("room");

let socket = null; // Declare socket here, will be initialized conditionally

if (!roomCode) {
    console.error("Room code is missing from the URL. Redirecting to home.");
    alert("Room code is missing. Please join via a valid room link or create a new game.");
    window.location.replace(`${SERVER_URL}`); // Redirect to home page
} else {
    // Initialize Socket.IO with the roomCode in the query
    socket = io(SERVER_URL, {
        query: {
            room: roomCode // THIS IS THE KEY CHANGE
        },
        transports: ["websocket", "polling"], // Match your server settings
    });

    if (!isGameOver && typeof AudioManager !== 'undefined' && AudioManager.play) {
        AudioManager.play("gameMusic");
    }

    // --- Socket Event Listeners ---
    socket.on("connect", async () => {
        mySocket = socket.id;
        console.log("Connected to WebSocket server:", socket.id);

        // Your server-side GameSocketManager now handles joining the room based on the 'room' query parameter.
        // So, `socket.emit("joinRoom", roomCode);` is no longer needed here.
        // The `validateRoom` HTTP call is a pre-check, ensure it's robust.
        await validateRoom(mySocket); // Still useful for initial HTTP validation

        socket.on("youJoined", (data) => {
            console.log("You joined room:", data);
        });

        socket.on("GameOver", (data) => {
            const { winner, finalScore } = data;
            isGameOver = true;

            if (typeof AudioManager !== 'undefined' && AudioManager.stop) {
                AudioManager.stop("gameMusic");
            } else {
                console.warn("AudioManager.stop not found or not initialized.");
                if (window.Howler) { Howler.stop(); }
            }

            if (finalScore) {
                document.getElementById("player1Score").textContent = finalScore.leftPlayerScore;
                document.getElementById("player2Score").textContent = finalScore.rightPlayerScore;
            }

            let winnerNameForDisplay;
            if (socket.id === winner) {
                winnerNameForDisplay = "You";
                if (typeof AudioManager !== 'undefined' && AudioManager.play) {
                    setTimeout(() => { AudioManager.play("gameEnd"); }, 653);
                }
            } else {
                winnerNameForDisplay = "Opponent";
                if (typeof AudioManager !== 'undefined' && AudioManager.play) {
                    setTimeout(() => { AudioManager.play("gameEnd"); }, 500);
                }
            }

            showGameOverScreen(winnerNameForDisplay);

            setTimeout(() => {
                cleanupSocketEvents(); // Ensure all socket.off calls are made
                if (socket && socket.connected) {
                  socket.disconnect(); // Disconnect client socket
                }
            }, 3000);
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
            if (!isGameRunning) {
                isGameRunning = true;
                startRenderLoop();
            }
        });

        socket.on("PowerUpTaken", (data) => {
            const { player, powerUpType, duration } = data;
            console.log("PowerUpTaken - Duration:", duration, "Type:", typeof duration);
            if (!isGameOver && typeof AudioManager !== 'undefined' && AudioManager.play) {
                AudioManager.play("powerUpCollected");
            }
            let actual = socket.id === data.player ? "You" : "Opponent";
            updatePowerupStatus(actual, powerUpType, duration);
        });

        socket.on("PowerUpWoreOff", () => {
            console.log("Power-up wore off");
            if (!isGameOver && typeof AudioManager !== 'undefined' && AudioManager.play) {
                AudioManager.play("powerDown");
            }
        });

        socket.on("disconnect", (reason) => {
            console.log("Disconnected from WebSocket server:", reason);
            // Handle specific disconnect reasons if needed
            // e.g., if (reason === 'io server disconnect') { // forced by server }
        });

        socket.on("playerLeft", (data) => {
            console.log("Opponent left:", data);
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
            if (socket && socket.connected) {
                socket.disconnect();
            }
            setTimeout(() => {
                window.location.replace(`${SERVER_URL}/index.html`);
            }, 3000);
        });

        // Error handling for initial connection
        socket.on("error", (message) => {
            console.error("Socket error:", message);
            alert(`Connection Error: ${message}`);
            window.location.replace(`${SERVER_URL}`); // Redirect on critical error
        });

        socket.on("roomNotFound", (code) => {
            console.error(`Room ${code} not found on server.`);
            alert(`The room "${code}" does not exist or has ended.`);
            window.location.replace(`${SERVER_URL}`);
        });

        socket.on("roomFull", (code) => {
            console.warn(`Room ${code} is full.`);
            alert(`The room "${code}" is full. Please try another room or create a new one.`);
            window.location.replace(`${SERVER_URL}`);
        });
    });
}
// --- CRITICAL CHANGE END ---

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

// Ensure playAgainButton and returnHomeButton are accessible, assuming they are in your HTML
if (playAgainButton) {
    playAgainButton.addEventListener('click', async () => {
        if (gameOverModal) { gameOverModal.style.display = 'none'; }
        stopRenderLoop();
        cleanupSocketEvents();
        cleanupPowerupTimers();
        cleanupCelebration(); // Ensure this function exists or remove
        if (typeof AudioManager !== 'undefined' && AudioManager.stop) {
            AudioManager.stop("gameMusic");
            AudioManager.stop("gameEnd");
            if (typeof AudioManager.cleanup === 'function') { AudioManager.cleanup(); }
        }
        if (socket && socket.connected) { socket.disconnect(); }

        try {
            console.log("Requesting a new room for play again...");
            const response = await axios.post(`${SERVER_URL}/create-room`);
            const { roomCode: newRoomCode } = response.data; // Renamed to newRoomCode to avoid conflict
            console.log("New room created:", newRoomCode);
            window.location.replace(`${SERVER_URL}/game.html?room=${newRoomCode}`);
        } catch (error) {
            console.error("Failed to create new room:", error);
            alert("Failed to create a new room. Please try again.");
            window.location.replace(`${SERVER_URL}`);
        }
    });
}

if (returnHomeButton) {
    returnHomeButton.addEventListener('click', () => {
        if (gameOverModal) { gameOverModal.style.display = 'none'; }
        stopRenderLoop();
        cleanupSocketEvents();
        cleanupPowerupTimers();
        cleanupCelebration(); // Ensure this function exists or remove
        if (typeof AudioManager !== 'undefined' && AudioManager.stop) {
            AudioManager.stop("gameMusic");
            AudioManager.stop("gameEnd");
            if (typeof AudioManager.cleanup === 'function') { AudioManager.cleanup(); }
        }
        if (socket && socket.connected) { socket.disconnect(); }
        window.location.replace(`${SERVER_URL}`); // Use SERVER_URL for consistency
    });
}

if (abandonReturnHomeButton) { // Assuming this button exists
    abandonReturnHomeButton.addEventListener('click', () => {
        if (abandonModal) { abandonModal.style.display = 'none'; }
        stopRenderLoop();
        cleanupSocketEvents();
        cleanupPowerupTimers();
        cleanupCelebration();
        if (typeof AudioManager !== 'undefined' && AudioManager.stop) {
            AudioManager.stop("gameMusic");
            AudioManager.stop("gameEnd");
            if (typeof AudioManager.cleanup === 'function') { AudioManager.cleanup(); }
        }
        if (socket && socket.connected) { socket.disconnect(); }
        window.location.replace(`${SERVER_URL}`);
    });
}


async function validateRoom(socketId) {
  try {
    // roomCode is already obtained globally at the top
    const response = await axios.post(
      `${SERVER_URL}/join-room/${roomCode}`,
      { socketId } // Sending socketId here as a pre-validation
    );
    console.log("Room HTTP validation successful:", response.data);
  } catch (err) {
    console.error("HTTP Room validation failed:", err);
    let errorMessage = "Something Bad Happened";
    if (err.response && err.response.data && err.response.data.error) {
      errorMessage = err.response.data.error;
    }
    window.alert(errorMessage);
    window.location.replace(`${SERVER_URL}`);
  }
}

function startRenderLoop() {
  function render() {
    if (isGameRunning && currentGameState) {
      renderGame(currentGameState);
    }
    animationId = requestAnimationFrame(render);
  }
  animationId = requestAnimationFrame(render);
}

function renderGame(GameState) {
  c.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  c.fillStyle = BACKGROUND_COLOR;
  c.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  createDashedLine();

  const { Ball, Paddle1, Paddle2, PowerUp } = GameState;
  if (Ball && Ball.x !== undefined && Ball.y !== undefined && Ball.radius !== undefined) {
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
    drawPaddle(myPaddle, true); // `isMyPaddle` can be used for styling/logic if needed
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
    socket.off("error"); // Added error event handler cleanup
    socket.off("roomNotFound"); // Added roomNotFound cleanup
    socket.off("roomFull"); // Added roomFull cleanup
  }
}

function cleanupPowerupTimers() {
  if (countdown) {
    clearInterval(countdown);
    countdown = null;
  }
}

// You might need a cleanupCelebration function if it manages persistent elements
function cleanupCelebration() {
    celebrationActive = false;
    celebrationParticles = [];
    // If you add dynamically created elements for neon text, remove them here
    document.querySelectorAll('.neon-text').forEach(el => el.remove());
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

  let remaining = Math.floor(Number(duration)) || 0;
  document.getElementById("powerupTimer").textContent = `${remaining}s remaining`;

  powerupBox.classList.add("powerup-active");

  if (countdown) { clearInterval(countdown); countdown = null; }
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
    Megaform: "The paddle hit the gym. Now it's SWOLE.",
    Downsize: "Management wants a smaller paddle",
    uKnowReverse: "W goes down and S goes up",
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
  const size = powerUp.width;
  const x = powerUp.x;
  const y = powerUp.y;
  const type = powerUp.type;
  switch (type) {
    case "Megaform":
      c.fillStyle = "#00E5FF";
      c.shadowBlur = 10;
      c.shadowColor = "#00E5FF";
      c.fillRect(x, y, size, size);
      const innerSize = size * 0.5;
      const innerX = x + (size - innerSize) / 2;
      const innerY = y + (size - innerSize) / 2;
      c.fillStyle = "white";
      c.shadowBlur = 0;
      c.fillRect(innerX, innerY, innerSize, innerSize);
      break;
    case "Downsize":
      c.fillStyle = "#00FF88";
      c.shadowBlur = 12;
      c.shadowColor = "#00FF88";
      c.fillRect(x, y, size, size);
      const downsizeInnerSize = size * 0.6;
      const downsizeInnerX = x + (size - downsizeInnerSize) / 2;
      const downsizeInnerY = y + (size - downsizeInnerSize) / 2;
      c.fillStyle = "black";
      c.shadowBlur = 0;
      c.fillRect(downsizeInnerX, downsizeInnerY, downsizeInnerSize, downsizeInnerSize);
      break;
    case "uKnowReverse":
      c.fillStyle = "#FF7700";
      c.shadowBlur = 12;
      c.shadowColor = "#FF7700";
      c.fillRect(x, y, size, size);
      const reverseInnerSize = size * 0.6;
      const reverseInnerX = x + (size - reverseInnerSize) / 2;
      const reverseInnerY = y + (size - reverseInnerSize) / 2;
      c.fillStyle = "#661100";
      c.shadowBlur = 0;
      c.fillRect(reverseInnerX, reverseInnerY, reverseInnerSize, reverseInnerSize);
      break;
  }
}

function drawBall(Ball) {
  if (!Ball || Ball.x === undefined || Ball.y === undefined || Ball.radius === undefined) { return; }
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
  if (socket && socket.connected) { // Only emit if socket is connected
    if (event.key === "w" || event.key === "W" || event.key === "ArrowUp") {
      socket.emit("PADDLE_UP");
    }
    if (event.key === "s" || event.key === "S" || event.key === "ArrowDown") {
      socket.emit("PADDLE_DOWN");
    }
  }
});

document.addEventListener("keyup", (event) => {
  if (socket && socket.connected) { // Only emit if socket is connected
    if (
      event.key === "w" || event.key === "W" || event.key === "ArrowUp" ||
      event.key === "s" || event.key === "S" || event.key === "ArrowDown"
    ) {
      socket.emit("PADDLE_STOP");
    }
  }
});

window.addEventListener('beforeunload', () => {
  stopRenderLoop();
  cleanupSocketEvents();
  cleanupPowerupTimers();
  cleanupCelebration();
  if (typeof AudioManager !== 'undefined' && AudioManager.stop) {
    AudioManager.stop("gameMusic");
    AudioManager.stop("gameEnd");
  }
  // Ensure socket disconnects cleanly on page unload
  if (socket && socket.connected) {
    socket.disconnect();
  }
});