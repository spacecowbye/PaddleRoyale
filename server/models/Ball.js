class Ball {
  constructor(x, y) {

    this.x = x;
    this.y = y;
    this.radius = 10;
    this.dx = this.getRandomSpeedX();
    this.dy = this.getRandomSpeedY();
  }
  getRandomSpeedX() {
    return (Math.random() > 0.5 ? 1 : -1) * (6 + Math.random() * 4);
  }
  getRandomSpeedY() {
    return (Math.random() > 0.5 ? 1 : -1) * (Math.random() * 1.95);
  }
  reset(x, y) {
    this.x = x;
    this.y = y;
    this.dx = this.getRandomSpeedX();
    this.dy = this.getRandomSpeedY();
  }
  update(){
    console.log("update has been called");
  }
}

module.exports = Ball;
