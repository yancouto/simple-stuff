let test = "oi";

class Vector {
  x: number;
  y: number;
  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  flop(v: Vector, m: number): Vector {
    return new Vector(this.x + v.x * m, this.y + v.y * m);
  }

  dist2(v: Vector): number {
    return (this.x - v.x) * (this.x - v.x) + (this.y - v.y) * (this.y - v.y);
  }
}

type Color = [number, number, number];

class Circle {
  pos: Vector;
  size: number;
  color: Color;
  constructor(pos: Vector, size: number, color?: Color) {
    this.pos = pos;
    this.size = size;
    if (color == null)
      this.color = [
        math.random(0, 255),
        math.random(0, 255),
        math.random(0, 255)
      ];
    else this.color = color;
  }
  draw() {
    love.graphics.setColor(this.color[0], this.color[1], this.color[2], 255);
    love.graphics.circle("fill", this.pos.x, this.pos.y, this.size);
  }
}

class Player extends Circle {
  constructor(pos: Vector, size: number, color: Color) {
    super(pos, size, color);
  }
  update(dt: number) {
    if (love.keyboard.isDown("w", "up")) this.pos.y -= dt * 200;
    if (love.keyboard.isDown("s", "down")) this.pos.y += dt * 200;
    if (love.keyboard.isDown("a", "left")) this.pos.x -= dt * 200;
    if (love.keyboard.isDown("d", "right")) this.pos.x += dt * 200;
  }
}

class Enemy extends Circle {
  pos: Vector;
  speed: Vector;
  size: number;
  constructor(pos: Vector, speed: Vector, size: number) {
    super(pos, size);
    this.speed = speed;
  }
  update(dt: number): void {
    this.pos = this.pos.flop(this.speed, dt);
  }
}

function collides(a: Circle, b: Circle): boolean {
  return a.pos.dist2(b.pos) <= (a.size + b.size) * (a.size + b.size);
}

const circles: Set<Enemy> = new Set();

const W = 800;
const H = 600;

const player = new Player(new Vector(W / 2, H / 2), 15, [200, 20, 100]);

let died = false;
let pos = new Vector(500, 500);

function outsideScreen(c: Circle): boolean {
  return (
    c.pos.x + c.size < 0 ||
    c.pos.x - c.size > W ||
    c.pos.y + c.size < 0 ||
    c.pos.y - c.size > H
  );
}

const to_delete: Enemy[] = [];

let speed_mult = 1;
function randomEnemy(): Enemy {
  const size = math.random(10, 80);
  const side = math.random(4);
  let pos: Vector, speed: Vector;
  if (side == 1) {
    pos = new Vector(-size, math.random() * H * 0.5 + H * 0.25);
    speed = new Vector(math.random(50, 100), math.random(-100, 100));
  } else if (side == 2) {
    pos = new Vector(math.random() * W * 0.5 + W * 0.25, -size);
    speed = new Vector(math.random(-100, 100), math.random(50, 100));
  } else if (side == 3) {
    pos = new Vector(W + size, math.random() * H * 0.5 + H * 0.25);
    speed = new Vector(math.random(-100, -50), math.random(-100, 100));
  } else {
    pos = new Vector(math.random() * W * 0.5 + W * 0.25, H + size);
    speed = new Vector(math.random(-100, 100), math.random(-100, -5));
  }
  speed.x *= speed_mult;
  speed.y *= speed_mult;
  speed_mult += 0.2;
  return new Enemy(pos, speed, size);
}

let cur = 0;

let time_to_next = 0;
let mult = 1;
love.update = function(dt) {
  if (died) return;
  player.size += dt * 0.5;
  cur += dt;
  time_to_next -= dt;
  if (time_to_next < 0) {
    time_to_next = 0.1 + math.random() * 4 * mult;
    mult = mult * 0.95;
    circles.add(randomEnemy());
  }
  player.update(dt);
  circles.forEach(circle => {
    circle.update(dt);
    if (collides(circle, player)) {
      died = true;
      pos = player.pos;
      return;
    }
    if (outsideScreen(circle)) to_delete.push(circle);
  });
  to_delete.forEach(c => circles.delete(c));
  for (let i = to_delete.length; i >= 0; i--) to_delete.pop();
};

const die_font = love.graphics.newFont(30);

love.draw = function() {
  if (died) {
    love.graphics.setColor(
      player.color[0],
      player.color[1],
      player.color[2],
      255
    );
    love.graphics.setFont(die_font);
    love.graphics.print("YOU DIED", pos.x, pos.y);
    return;
  }
  player.draw();
  circles.forEach(circle => circle.draw());
  love.graphics.setColor(255, 255, 255, 255);
  love.graphics.print(string.format("Time %.2fs", cur), W / 2 - 20, 10);
};

love.load = function() {};
