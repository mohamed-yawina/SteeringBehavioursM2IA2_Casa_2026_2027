// Mouse-controlled visible target: static, never integrated.
class Target extends Vehicle {
  constructor(x,y) {
    super(x,y);
    this.maxSpeed=0;this.maxForce=0;
  }
  setPosition(x,y) {
    if(!finitePoint({x,y}))return false;
    this.pos.set(x,y);return true;
  }
  show() {
    push();fill(255,0,0);noStroke();
    circle(this.pos.x,this.pos.y,32);
    pop();
  }
}
