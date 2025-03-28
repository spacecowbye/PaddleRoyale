const gameMusic = new Howl({
    src : ['assets/music/finalbg.mp3'],
    loop: true,
    volume: 0.5,
  });
  
  // Start music when the game loads
  console.log("Music play")
  gameMusic.play();
  