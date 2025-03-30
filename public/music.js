// audioManager.js
const AudioManager = {
  powerUpCollected: new Howl({
    src: ['assets/music/powerupCollected.mp3'],
    loop: false,
    volume: 0.5,
  }),
  gameMusic: new Howl({
    src: ['assets/music/finalbg.mp3'],
    loop: true,
    volume: 0.5,
  }),
  
  play: function (soundName) {
    if (this[soundName]) {
      this[soundName].play();
    } else {
      console.warn(`Sound "${soundName}" not found!`);
    }
  }
};
