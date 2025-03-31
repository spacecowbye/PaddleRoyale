class Paddle {
    constructor(x, y, player) {
        this.x = x;
        this.y = y;
        this.player = player;
        this.dy = 0; // Movement speed (positive = down, negative = up)
        this.width = 15;
        this.length = 80;

    }

    move(up, down) {
        if (up) {
            this.dy = -9; // Move up
        } else if (down) {
            this.dy = 9;  // Move down
        } else {
            this.dy = 0;  // Stop when no key is pressed
        }
    }

    updatePosition(canvasHeight) {
        this.y += this.dy;

        // Ensure paddle stays within bounds
        if (this.y < 0) {
            this.y = 0;
        }
        if (this.y + this.length > canvasHeight) {
            this.y = canvasHeight - this.length;
        }
    }

    reset(x, y) {
        this.x = x;
        this.y = y;
        this.dy = 0;
        this.isGlowing = false;
        this.glowColor = null;
    }

    
}

module.exports = Paddle;