// Configuration - Update this URL to your Fly.io app URL
const SERVER_URL = "https://paddleroyale-winter-sky-6525.fly.dev";

// global error modal manipulation
function showError(message) {
    document.getElementById("roomCodeModal").style.display = "none";
    document.getElementById("errorMessage").innerText = message;
    document.getElementById("errorModal").style.display = "flex";
}

function closeErrorModal() {
    document.getElementById("errorModal").style.display = "none";
}

document.getElementById("errorModal").addEventListener("click", function (event) {
    if (event.target === this) {
        closeErrorModal();
    }
});

// Play button - Create new room
document.querySelector('.play').addEventListener('click', async () => {
    console.log("Play button clicked");

    try {
        const response = await axios.post(`${SERVER_URL}/create-room`);
        const {roomCode} = response.data;        
        window.location.href = `${SERVER_URL}/game.html?room=${roomCode}`;
       
    } catch (error) {
        showError("No response from Server, please try later");
    }
});

// Modal functionality for entering room code
const modal = document.getElementById("roomCodeModal");
const joinBtn = document.querySelector(".learn");
const closeBtn = document.getElementsByClassName("close")[0];
const submitButton = document.getElementById("submitRoomCode");
const roomCodeInput = document.getElementById("roomCodeInput");
const errorBtn = document.getElementById('errorBtn');

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
roomCodeInput.addEventListener("keydown", (event) => {
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
        showError("Room Code Cannot be empty");
        return;
    }
    
    try {
        console.log("Sending join-room request with code:", roomCode);
        // First validate the room exists
        const response = await axios.post(`${SERVER_URL}/join-room/${roomCode}`, {
            socketId: 'pre-validate' // We'll get a real socket ID when we actually join
        });
        
        // If we get here, the room exists and we can redirect
        window.location.replace(`${SERVER_URL}/game.html?room=${roomCode}`);
    } catch (error) {
        if(error.response){
            if (error.response.status === 400) {
                showError("No such room exists");
            } else if (error.response.status === 403) {
                showError("Room is full");
            } else {
                showError("Invalid Room Code");
            }
        } else if(error.request){
            showError("No response from Server, please try later");
        } else {
            showError("Request failed, please try later");
        }
    }
});