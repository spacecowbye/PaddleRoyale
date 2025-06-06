class Paddle {
    constructor(x, y, player = null) { // player can now be initially null
        this.x = x;
        this.y = y;
        this.player = player; // Player ID associated with this paddle
        this.dy = 0; // Movement speed (positive = down, negative = up)
        this.width = 15;
        this.length = 80; // Initial length

        this.originalWidth = this.width;
        this.originalLength = this.length;

    }

    // Method to assign a player to the paddle (useful for player2)
    assignPlayer(player) {
        this.player = player;
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

    // Reset paddle to its initial state
    reset(x, y) {
        this.x = x;
        this.y = y;
        this.dy = 0;
        // Reset dimensions to original values
        this.width = this.originalWidth;
        this.length = this.originalLength;

    }
}

module.exports = Paddle;