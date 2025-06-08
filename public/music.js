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
    src: ["assets/music/powerDown.mp3"],
    loop: false,
    volume: 0.5,
  }),
  gameEnd: new Howl({
    src: ["assets/music/gameEnd.mp3"],
    loop: true,
    volume: 0.4,
  }),
  gameScore: new Howl({
    src : ["assets/music/gameScore.mp3"],
    loop : false,
    volume : 0.6
  }),
  play: function (soundName) {
    if (this[soundName]) {
      if (soundName !== "gameMusic") {
        this.gameMusic.volume(0.32); 
        const soundId = this[soundName].play();
        this[soundName].once("end", () => {
          this.gameMusic.volume(0.5);
        });
      } else {
        this[soundName].play();
      }
    } else {
      console.warn(`Sound "${soundName}" not found!`);
    }
  },
  stop: function (soundName) {
    if (this[soundName]) {
      this[soundName].stop();
    } else {
      console.warn(`Sound "${soundName}" not found!`);
    }
  },
  cleanup: function() {
    Object.keys(this).forEach(key => {
      if (this[key] instanceof Howl) {
        this[key].unload();
      }
    });
  }
};
