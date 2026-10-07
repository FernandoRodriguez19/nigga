import { BALL, PITCH, PALETTE } from '../config.js';
import { clamp, rad, randomRange } from '../utils/math.js';

// Estado de la pelota + su dibujo. No sabe nada de colisiones:
// eso lo maneja BallPhysics.
export default class Ball {
  constructor(scene) {
    this.scene = scene;
    this.radius = BALL.radius;
    this.x = PITCH.centerX;
    this.y = PITCH.middle;
    this.vx = 0;
    this.vy = 0;
    this.speed = BALL.speed;
    this.paused = false;
    this.spin = 0;
    this.history = [];

    this.trail = scene.add.graphics().setDepth(4);
    this.shadow = scene.add
      .ellipse(this.x, this.y + 10, this.radius * 2.1, this.radius * 1.5, 0x000000, 0.32)
      .setDepth(5);
    this.body = scene.add
      .circle(this.x, this.y, this.radius, PALETTE.ball, 1)
      .setStrokeStyle(2, 0x9aa7bd, 1)
      .setDepth(6);
    this.dot = scene.add.circle(0, 0, this.radius * 0.34, 0x64748b, 1).setDepth(7);
  }

  get targetSpeed() {
    return this.speed;
  }

  place(x, y) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.history.length = 0;
    this.render();
  }

// angle en radianes, convencion estandar: 0 = derecha, PI/2 = abajo.
  serve(angleRad, speed = BALL.speed) {
    this.x = PITCH.centerX;
    this.y = PITCH.middle;
    this.speed = speed;
    this.vx = Math.cos(angleRad) * speed;
    this.vy = Math.sin(angleRad) * speed;
    this.history.length = 0;
    this.paused = false;
  }

  // Aplica una velocidad nueva (la usa el KickSystem).
  launch(vx, vy, speed) {
    this.speed = speed;
    this.vx = vx;
    this.vy = vy;
    this.paused = false;
  }

  // Mantiene la velocidad dentro de los limites: no puede ir horizontal,
  // y siempre tiene un minimo de componente lateral para que el rally viva.
  normalize() {
    const magnitude = this.speed;
    const maxLateral = magnitude * Math.sin(rad(BALL.maxAngleDeg));
    const minLateral = magnitude * BALL.minHorizontalRatio;

    let lateral = clamp(this.vx, -maxLateral, maxLateral);
    if (Math.abs(lateral) < minLateral) lateral = lateral < 0 ? -minLateral : minLateral;

    const forwardSign = this.vy < 0 ? -1 : 1;
    this.vx = lateral;
    this.vy = forwardSign * Math.sqrt(Math.max(0, magnitude * magnitude - lateral * lateral));
  }

  deflect(jitter = 0.06) {
    const angle = Math.atan2(this.vy, this.vx) + randomRange(-jitter, jitter);
    this.vx = Math.cos(angle) * this.speed;
    this.vy = Math.sin(angle) * this.speed;
    this.normalize();
  }

  render(dt = 0) {
    this.history.unshift({ x: this.x, y: this.y });
    if (this.history.length > BALL.trailLength) this.history.pop();

    this.spin += (Math.abs(this.vx) / 60) * dt;

    this.body.setPosition(this.x, this.y);
    this.shadow.setPosition(this.x, this.y + 12);
    this.dot.setPosition(this.x + Math.cos(this.spin) * this.radius * 0.46, this.y + Math.sin(this.spin) * this.radius * 0.46);

    const g = this.trail;
    g.clear();
    for (let i = this.history.length - 1; i >= 0; i--) {
      const point = this.history[i];
      const t = 1 - i / this.history.length;
      const alpha = t * 0.35;
      const size = this.radius * (0.35 + t * 0.55);
      g.fillStyle(PALETTE.ballShade, alpha);
      g.fillCircle(point.x, point.y, size);
    }
  }

  // Distancia (en px) hasta la linea que defiende `facing`.
  // facing -1 = jugador abajo, +1 = IA arriba.
  distanceToLine(facing) {
    return facing < 0 ? PITCH.bottom - this.y : this.y - PITCH.top;
  }

  get speedNormalized() {
    return clamp(this.speed / BALL.maxSpeed, 0, 1);
  }

  destroy() {
    [this.trail, this.shadow, this.body, this.dot].forEach((obj) => obj.destroy());
  }
}

// Angulo de saque: centrado en vertical con un poco de dispersion,
//dirigido hacia el arco contrario al que acaba de golpear. hacia el arco contrario al que acaba de golpear.
export const randomServeAngle = (towardsTop) =>
  randomRange(-rad(28), rad(28)) + (towardsTop ? -Math.PI / 2 : Math.PI / 2);