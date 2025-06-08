// --- Game Canvas and Context Setup ---
const canvas = document.querySelector("#gameCanvas");
const CANVAS_WIDTH = 652;
const CANVAS_HEIGHT = 404;
canvas.width = CANVAS_WIDTH;
canvas.height = CANVAS_HEIGHT;
const BALL_RADIUS = 10;
const PADDLE_WIDTH = 15;
const POWERUP_HEIGHT = 32;
const POWERUP_WIDTH = 32;
let c = canvas.getContext("2d");

// --- Game Colors (Constants) ---
const BACKGROUND_COLOR = "#0A192F"; // Dark blue (Futuristic)
const BALL_COLOR = "#FF3860"; // Neon red (High contrast)
const PADDLE_COLOR = "#00E5FF"; // Neon cyan (Cool contrast)
const LINE_COLOR = "#FFFFFF"; // Soft white (Classic arcade style)

// --- Game State and Control Variables ---
let mySocket = null;
let countdown = null; // Used for power-up timer display
let currentGameState = null;
let isGameRunning = false;
let isGameOver = false;
let animationId = null; // Stores the requestAnimationFrame ID

// --- Server Configuration ---
const SERVER_URL = "http://localhost:8080"; // Or "https://paddleroyale.duckdns.org"

// --- DOM Elements for Modals ---
const gameOverModal = document.getElementById("gameOverModal");
const gameOverTitle = document.getElementById("gameOverTitle");
const gameOverMessage = document.getElementById("gameOverMessage");
const playAgainButton = document.getElementById("playAgainButton");
const returnHomeButton = document.getElementById("returnHomeButton");

const abandonModal = document.getElementById("abandonModal");
const abandonTitle = document.getElementById("abandonTitle");
const abandonMessage = document.getElementById("abandonMessage");

// --- Paddle Visual Effects Variables ---
const RECOIL_DURATION = 0.1; // seconds, how long the paddle recoils
const RECOIL_MAGNITUDE = 3; // pixels, how far the paddle recoils
let paddle1RecoilTimer = 0; // Timer for Paddle1's recoil
let paddle2RecoilTimer = 0; // Timer for Paddle2's recoil
let lastBallX = null; // Stores previous ball X to detect collision direction
let lastBallY = null; // Stores previous ball Y to detect collision direction

// --- Paddle Rocket Smoke Particles ---
const PADDLE_SMOKE_PARTICLE_LIFETIME = 0.5; // seconds
const PADDLE_SMOKE_PARTICLE_SIZE = 3; // pixels
const PADDLE_SMOKE_PARTICLE_COLOR = "rgba(200, 200, 200, 0.7)"; // Faint white/grey smoke
const PADDLE_SMOKE_EMISSION_RATE = 2; // Particles per frame when moving

let paddle1Particles = []; // Particles for Paddle1's smoke
let paddle2Particles = []; // Particles for Paddle2's smoke

// Store previous paddle Y positions to detect movement
let lastPaddle1Y = null;
let lastPaddle2Y = null;


// --- Socket.IO Connection ---
const socket = io(SERVER_URL);
if (!isGameOver) AudioManager.play("gameMusic"); // Play music if game is not over

// --- Socket Event Listeners ---
socket.on("connect", async () => {
    mySocket = socket.id;
    console.log("Connected to WebSocket server:", socket.id);

    await validateRoom(socket.id); // Validate room on connection
    const URLparams = new URLSearchParams(window.location.search);
    const roomCode = URLparams.get("room");

    socket.emit("joinRoom", roomCode);

    socket.on("youJoined", (data) => {
        console.log(data);
    });

    socket.on("GameOver", (data) => {
        const { winner, finalScore } = data;
        isGameOver = true;

        if (typeof AudioManager !== "undefined" && AudioManager.stop) {
            AudioManager.stop("gameMusic");
        } else {
            console.warn("AudioManager.stop not found or not initialized.");
            if (window.Howler) {
                Howler.stop();
            }
        }

        if (finalScore) {
            document.getElementById("player1Score").textContent = finalScore.leftPlayerScore;
            document.getElementById("player2Score").textContent = finalScore.rightPlayerScore;
        }

        let winnerNameForDisplay;
        if (socket.id === winner) {
            winnerNameForDisplay = "You";
            if (typeof AudioManager !== "undefined" && AudioManager.play) {
                setTimeout(() => { AudioManager.play("gameEnd"); }, 653);
            }
        } else {
            winnerNameForDisplay = "Opponent";
            if (typeof AudioManager !== "undefined" && AudioManager.play) {
                setTimeout(() => { AudioManager.play("gameEnd"); }, 500);
            }
        }

        showGameOverScreen(winnerNameForDisplay);

        setTimeout(() => {
            cleanupSocketEvents();
            socket.disconnect();
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
        if (!isGameOver) AudioManager.play("powerUpCollected");
        let actualOwner = socket.id === data.player ? "You" : "Opponent";
        updatePowerupStatus(actualOwner, powerUpType, duration);
    });

    socket.on("PowerUpWoreOff", () => {
        if (!isGameOver) AudioManager.play("powerDown");
    });

    socket.on("disconnect", () => {
        console.log("Disconnected from WebSocket server");
    });

    socket.on("playerLeft", (data) => {
        if (abandonModal) {
            abandonModal.style.display = "flex";
            abandonModal.style.transform = "scale(0.8)";
            abandonModal.style.opacity = "0";
            requestAnimationFrame(() => {
                abandonModal.style.transition = "all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)";
                abandonModal.style.transform = "scale(1)";
                abandonModal.style.opacity = "1";
            });
        }
        stopRenderLoop();
        socket.disconnect();
        setTimeout(() => {
            window.location.replace(`${SERVER_URL}/index.html`);
        }, 3000);
    });
});

// --- Game Over Screen Functions ---
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
        gameOverModal.style.display = "flex";
        gameOverModal.style.transform = "scale(0.8)";
        gameOverModal.style.opacity = "0";
        requestAnimationFrame(() => {
            gameOverModal.style.transition = "all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)";
            gameOverModal.style.transform = "scale(1)";
            gameOverModal.style.opacity = "1";
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
            color: ["#39FF14", "#00FFFF", "#FF00FF", "#FFD700"][i % 4],
            life: 1.0,
            trail: [],
            type: Math.random() < 0.6 ? "ball" : "spark",
        });
    }

    flashCanvas("#00FFFF", 0.6);
}

function startDefeatEffect() {
    flashCanvas("#FF0033", 0.4);
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
            color: ["#FF4444", "#660000", "#999999"][i % 3],
            life: 0.9,
            trail: [],
            type: "spark",
        });
    }

    showNeonText("YOU LOSE", "#FF4444");
}

function flashCanvas(color, intensity = 0.5) {
    const originalComposite = c.globalCompositeOperation;
    c.globalCompositeOperation = "screen";
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
    const text = document.createElement("div");
    text.textContent = textContent;
    text.style.position = "absolute";
    text.style.top = "45%";
    text.style.left = "50%";
    text.style.transform = "translate(-50%, -50%) scale(0.8)";
    text.style.fontSize = "48px";
    text.style.fontFamily = `'Orbitron', sans-serif`;
    text.style.color = color;
    text.style.textShadow = `0 0 8px ${color}, 0 0 20px ${color}`;
    text.style.transition = "all 0.5s ease";
    text.style.opacity = "0";

    document.body.appendChild(text);

    requestAnimationFrame(() => {
        text.style.opacity = "1";
        text.style.transform = "translate(-50%, -50%) scale(1.2)";
    });

    setTimeout(() => {
        text.style.opacity = "0";
        text.style.transform = "translate(-50%, -50%) scale(0.9)";
        setTimeout(() => text.remove(), 1000);
    }, 1800);
}

// --- Button Event Listeners ---
playAgainButton.addEventListener("click", async () => {
    if (gameOverModal) {
        gameOverModal.style.display = "none";
    }
    stopRenderLoop();
    cleanupSocketEvents();
    cleanupPowerupTimers();
    // Also reset paddle particles
    paddle1Particles = [];
    paddle2Particles = [];
    lastPaddle1Y = null;
    lastPaddle2Y = null;

    if (typeof AudioManager !== "undefined" && AudioManager.stop) {
        AudioManager.stop("gameMusic");
        AudioManager.stop("gameEnd");
        if (typeof AudioManager.cleanup === "function") {
            AudioManager.cleanup();
        }
    }
    if (socket && socket.connected) {
        socket.disconnect();
    }

    try {
        console.log("Requesting a new room...");
        const response = await axios.post(`${SERVER_URL}/create-room`);
        const { roomCode } = response.data;
        console.log("New room created:", roomCode);
        window.location.replace(`${SERVER_URL}/game.html?room=${roomCode}`);
    } catch (error) {
        console.error("Failed to create new room:", error);
        window.location.replace(SERVER_URL);
    }
});

returnHomeButton.addEventListener("click", () => {
    if (gameOverModal) {
        gameOverModal.style.display = "none";
    }
    stopRenderLoop();
    cleanupSocketEvents();
    cleanupPowerupTimers();
    // Also reset paddle particles
    paddle1Particles = [];
    paddle2Particles = [];
    lastPaddle1Y = null;
    lastPaddle2Y = null;

    if (typeof AudioManager !== "undefined" && AudioManager.stop) {
        AudioManager.stop("gameMusic");
        AudioManager.stop("gameEnd");
        if (typeof AudioManager.cleanup === "function") {
            AudioManager.cleanup();
        }
    }
    if (socket && socket.connected) {
        socket.disconnect();
    }
    window.location.replace("index.html");
});

// --- Utility Functions ---
async function validateRoom(socketId) {
    try {
        const URLparams = new URLSearchParams(window.location.search);
        const roomCode = URLparams.get("room");
        const response = await axios.post(`${SERVER_URL}/join-room/${roomCode}`, { socketId });
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

// Function to get the time elapsed since the last frame
let lastFrameTime = performance.now();
function getDeltaTime() {
    const currentTime = performance.now();
    const deltaTime = (currentTime - lastFrameTime) / 1000; // Convert to seconds
    lastFrameTime = currentTime;
    return deltaTime;
}

function startRenderLoop() {
    lastFrameTime = performance.now(); // Initialize for delta time calculation
    function render() {
        if (isGameRunning && currentGameState) {
            const deltaTime = getDeltaTime(); // Get time since last frame
            renderGame(currentGameState, deltaTime); // Pass delta time to renderGame
        }
        animationId = requestAnimationFrame(render);
    }
    animationId = requestAnimationFrame(render);
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
    }
}

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
    ownerElement.className = "powerup-owner " + (owner.toLowerCase().includes("you") ? "owner-you" : "owner-opponent");

    document.getElementById("powerupDescription").textContent = getPowerupDescription(powerupName);

    let remaining = Math.floor(Number(duration)) || 0;
    document.getElementById("powerupTimer").textContent = `${remaining}s remaining`;

    powerupBox.classList.add("powerup-active");

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
        Megaform: "The paddle hit the gym. Now it's SWOLE.",
        Downsize: "Management wants a smaller paddle",
        uKnowReverse: "W goes Down and S goes up",
    };
    return descriptions[name] || "This power-up has special effects during gameplay.";
}

function resetPowerupDisplay() {
    const powerupBox = document.getElementById("activePowerup");
    powerupBox.classList.remove("powerup-active");
    document.getElementById("powerupName").textContent = "No power-up active";
    document.getElementById("powerupOwner").textContent = "";
    document.getElementById("powerupDescription").textContent = "Collect a power-up during the game to see its effects here.";
    document.getElementById("powerupTimer").textContent = "";
}

// --- Drawing Functions ---

// Main render loop function
function renderGame(GameState, deltaTime) {
    c.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT); // Clear canvas

    // Draw background and dashed line
    c.fillStyle = BACKGROUND_COLOR;
    c.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    createDashedLine();

    const { Ball, Paddle1, Paddle2, PowerUp } = GameState;

    // --- Paddle Recoil Logic ---
    // Detect hits and trigger recoil client-side based on ball movement
    if (lastBallX !== null && lastBallY !== null && Ball && Ball.x !== undefined && Ball.y !== undefined) {
        const ballTravelDirectionX = Ball.x - lastBallX;

        // Check if Paddle1 (left) was hit
        if (Ball.x - BALL_RADIUS <= Paddle1.x + PADDLE_WIDTH && Ball.x - BALL_RADIUS > Paddle1.x &&
            Ball.y >= Paddle1.y && Ball.y <= Paddle1.y + Paddle1.length &&
            ballTravelDirectionX < 0) { // Ball was moving left into the paddle
            paddle1RecoilTimer = RECOIL_DURATION;
        }
        // Check if Paddle2 (right) was hit
        if (Ball.x + BALL_RADIUS >= Paddle2.x && Ball.x + BALL_RADIUS < Paddle2.x + PADDLE_WIDTH &&
            Ball.y >= Paddle2.y && Ball.y <= Paddle2.y + Paddle2.length &&
            ballTravelDirectionX > 0) { // Ball was moving right into the paddle
            paddle2RecoilTimer = RECOIL_DURATION;
        }
    }
    // Update last ball position for next frame's detection
    if (Ball && Ball.x !== undefined && Ball.y !== undefined) {
        lastBallX = Ball.x;
        lastBallY = Ball.y;
    }

    // --- Update and Draw Paddle Smoke Particles ---
    updateAndDrawPaddleSmoke(Paddle1, paddle1Particles, lastPaddle1Y, deltaTime);
    updateAndDrawPaddleSmoke(Paddle2, paddle2Particles, lastPaddle2Y, deltaTime);

    // Update last paddle Y positions for next frame's smoke generation
    lastPaddle1Y = Paddle1.y;
    lastPaddle2Y = Paddle2.y;

    // --- Apply Recoil and Draw Paddles ---
    let actualPaddle1X = Paddle1.x;
    let actualPaddle2X = Paddle2.x;

    // Apply recoil offset if timers are active
    if (paddle1RecoilTimer > 0) {
        actualPaddle1X += RECOIL_MAGNITUDE; // Push left paddle right
        paddle1RecoilTimer -= deltaTime; // Decrement timer using deltaTime
    }
    if (paddle2RecoilTimer > 0) {
        actualPaddle2X -= RECOIL_MAGNITUDE; // Push right paddle left
        paddle2RecoilTimer -= deltaTime; // Decrement timer using deltaTime
    }

    // Draw paddles with potential recoil offset
    drawPaddle({ ...Paddle1, x: actualPaddle1X });
    drawPaddle({ ...Paddle2, x: actualPaddle2X });

    // --- Draw Ball and Power-up ---
    if (Ball && Ball.x !== undefined && Ball.y !== undefined) {
        drawBall(Ball);
    }
    if (PowerUp) {
        drawPowerUp(PowerUp);
    }
}

function drawPaddle(Paddle) {
    c.fillStyle = PADDLE_COLOR;
    c.fillRect(Paddle.x, Paddle.y, PADDLE_WIDTH, Paddle.length);
}


// --- Paddle Smoke Particle System Functions ---
function updateAndDrawPaddleSmoke(paddle, particlesArray, lastPaddleY, deltaTime) {
    // Determine paddle movement direction
    let movementDirection = 0; // 0: no movement, 1: down, -1: up
    if (lastPaddleY !== null) {
        if (paddle.y > lastPaddleY) {
            movementDirection = 1; // Moving down
        } else if (paddle.y < lastPaddleY) {
            movementDirection = -1; // Moving up
        }
    }

    // Generate new particles if paddle is moving
    if (movementDirection !== 0) {
        for (let i = 0; i < PADDLE_SMOKE_EMISSION_RATE; i++) {
            particlesArray.push({
                x: paddle.x + PADDLE_WIDTH / 2 + (Math.random() - 0.5) * PADDLE_WIDTH / 3, // Spawn near paddle center, slight randomness
                y: (movementDirection === 1) ? paddle.y : paddle.y + paddle.length, // Spawn at top or bottom based on direction
                vx: (Math.random() - 0.5) * 5, // Small horizontal velocity
                vy: movementDirection * (Math.random() * 20 + 10), // Move away from paddle
                life: PADDLE_SMOKE_PARTICLE_LIFETIME,
                maxLife: PADDLE_SMOKE_PARTICLE_LIFETIME,
                size: Math.random() * PADDLE_SMOKE_PARTICLE_SIZE + 1, // Random size
            });
        }
    }

    // Update and draw existing particles
    for (let i = particlesArray.length - 1; i >= 0; i--) {
        const p = particlesArray[i];

        p.life -= deltaTime;
        if (p.life <= 0) {
            particlesArray.splice(i, 1); // Remove dead particles
            continue;
        }

        p.x += p.vx * deltaTime;
        p.y += p.vy * deltaTime;
        p.size *= (1 - 0.5 * deltaTime); // Shrink slightly over time

        // Draw particle
        const alpha = p.life / p.maxLife; // Fade out based on remaining life
        c.fillStyle = `rgba(200, 200, 200, ${alpha * 0.7})`; // Smoke color with fading alpha
        c.beginPath();
        c.arc(p.x, p.y, p.size / 2, 0, Math.PI * 2);
        c.fill();
    }
}


function drawPowerUp(powerUp) {
    if (!powerUp) return;

    const size = POWERUP_WIDTH;
    const x = powerUp.x;
    const y = powerUp.y;
    const type = powerUp.type;

    c.shadowBlur = 0; // Reset shadow for all power-ups first
    c.shadowColor = "rgba(0,0,0,0)";

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
            c.shadowBlur = 0; // No inner shadow for this one
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
            c.fillStyle = "#B347FF";
            c.shadowBlur = 15;
            c.shadowColor = "#B347FF";
            c.fillRect(x, y, size, size);

            const reverseInnerSize = size * 0.5;
            const reverseInnerX = x + (size - reverseInnerSize) / 2;
            const reverseInnerY = y + (size - reverseInnerSize) / 2;

            const gradient = c.createLinearGradient(reverseInnerX, reverseInnerY, reverseInnerX + reverseInnerSize, reverseInnerY + reverseInnerSize);
            gradient.addColorStop(0, "#FFFFFF");
            gradient.addColorStop(1, "#E0B3FF");

            c.fillStyle = gradient;
            c.shadowBlur = 5;
            c.shadowColor = "#D580FF";
            c.fillRect(reverseInnerX, reverseInnerY, reverseInnerSize, reverseInnerSize);
            break;
    }
    c.shadowBlur = 0; // Reset shadow for general drawing
}

function drawBall(Ball) {
    if (!Ball || Ball.x === undefined || Ball.y === undefined) {
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
    c.setLineDash([]); // Reset line dash for other drawings
}

// --- Input Event Listeners ---
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

// --- Window Unload Handler ---
window.addEventListener("beforeunload", () => {
    stopRenderLoop();
    cleanupSocketEvents();
    cleanupPowerupTimers();
    // Also reset paddle particles on unload
    paddle1Particles = [];
    paddle2Particles = [];
    lastPaddle1Y = null;
    lastPaddle2Y = null;

    if (typeof AudioManager !== "undefined" && AudioManager.stop) {
        AudioManager.stop("gameMusic");
        AudioManager.stop("gameEnd");
    }
});