
class Path extends Vehicle {
    constructor(x1, y1, x2, y2) {
      super(x1, y1);
      this.start = this.pos;
      this.end = createVector(x2, y2);
      this.radius = 40;
      this.maxSpeed = 0;
      this.maxForce = 0;
    }

    // A geometric support: never run the inherited integration.
    update() {}

    show() {
      stroke(255);
      strokeWeight(2);
      line(this.start.x, this.start.y, this.end.x, this.end.y);

      // second parametre  de stroke() est l'opacité
      stroke(255, 20);
      stroke(255, 0, 0, 50);
      strokeWeight(this.radius * 2);
      line(this.start.x, this.start.y, this.end.x, this.end.y);
    }
  }

