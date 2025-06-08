class Ball {
  constructor(x, y) {

    this.x = x;
    this.y = y;
    this.radius = 10;
    this.dx = this.getRandomSpeedX();
    this.dy = this.getRandomSpeedY();
    this.lastHitBy = null;
  }
  getRandomSpeedX() {
    return (Math.random() > 0.5 ? 1 : -1) * (3 + Math.random() * 1.5);
  }
  getRandomSpeedY() {
    return (Math.random() > 0.5 ? 1 : -1) * (1 + Math.random() * 1.2);
  }
  getRandomSpeedYAlter() {
    return (Math.random() > 0.5 ? 1 : -1) * (Math.random() * 2 + 1);
}

  reset(x, y) {
    this.x = x;
    this.y = y;
    this.dx = this.getRandomSpeedX();
    this.dy = this.getRandomSpeedY();
    this.lastHitBy = null;
  }
  update(){
    console.log("update has been called");
  }
}

module.exports = Ball;
