// audioManager.js
const AudioManager = {
  powerUpCollected: new Howl({
    src: ["assets/music/powerupCollected.mp3"],
    loop: false,
    volume: 0.5,
  }),
  gameMusic: new Howl({
    src: ["assets/music/finalbg.mp3"],
    loop: true,
    volume: 0.5,
  }),
  powerDown: new Howl({
    src: ["/assets/music/powerDown.mp3"],
    loop: false,
    volume: 0.5,
  }),

  play: function (soundName) {
    if (this[soundName]) {
      if (soundName !== "gameMusic") {
        
        this.gameMusic.volume(0.35); 

        // Play the sound
        const soundId = this[soundName].play();

        
        this[soundName].once("end", () => {
          this.gameMusic.volume(0.5); // Restore original volume
        });
      } else {
        this[soundName].play();
      }
    } else {
      console.warn(`Sound "${soundName}" not found!`);
    }
  },
};
