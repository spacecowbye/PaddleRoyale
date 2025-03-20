
// Play button - Create new room
document.querySelector('.play').addEventListener('click', async () => {
    console.log("Play button clicked");
    try {
        console.log("Sending create-room request");
        const response = await axios.post("http://localhost:8080/create-room", {
            playerName: "Player1",
            time: Date.now(),
        });
        console.log("Room Created Successfully:", response.data);
        const roomCode = response.data.roomCode;
        
        if (roomCode) {
            console.log("Redirecting to game.html with room code:", roomCode);
            window.location.href = `game.html?room=${roomCode}`;
        } else {
            console.error("No room code received in response");
            alert("Error creating room: No room code received");
        }
    } catch (error) {
        console.error("Error creating room:", error);
        alert("Error creating room: " + (error.response?.data?.message || error.message));
    }
});

// Modal functionality for entering room code
const modal = document.getElementById("roomCodeModal");
const joinBtn = document.querySelector(".learn");
const closeBtn = document.getElementsByClassName("close")[0];
const submitButton = document.getElementById("submitRoomCode");
const roomCodeInput = document.getElementById("roomCodeInput");

// Open modal when "Enter Room Code" button is clicked
joinBtn.onclick = function() {
    console.log("Join button clicked, showing modal");
    modal.style.display = "flex";
    roomCodeInput.focus();
};

// Close modal when X is clicked
closeBtn.onclick = function() {
    console.log("Close button clicked");
    modal.style.display = "none";
};

// Close modal when clicking outside of it
window.onclick = function(event) {
    if (event.target == modal) {
        console.log("Clicked outside modal, closing");
        modal.style.display = "none";
    }
};

// Handle Enter key in input field
roomCodeInput.addEventListener("keydown", function(event) {
    if (event.key === "Enter") {
        console.log("Enter key pressed in input");
        submitButton.click();
    }
});

// Submit room code
submitButton.addEventListener('click', async() => {
    console.log("Submit button clicked");
    const roomCode = roomCodeInput.value.trim();
    
    if (!roomCode) {
        alert("Please enter a valid room code.");
        return;
    }
    
    try {
        console.log("Sending join-room request with code:", roomCode);
        const response = await axios.post("http://localhost:8080/join-room", { roomCode });
        console.log("Join room response:", response.data);
        
        // First hide the modal, then redirect
        modal.style.display = "none";
        
        // Use setTimeout to ensure the modal is hidden before redirecting
        setTimeout(() => {
            console.log("Redirecting to game with room code:", roomCode);
            window.location.href = `game.html?room=${roomCode}`;
        }, 100);
    } catch (error) {
        console.error("Error joining room:", error);
        alert("Failed to join room. Please check the room code and try again.");
    }
});