import { BALL, CANVAS, PITCH } from '../config.js';

// Integra la pelota con subpasos y resuelve los choques con el cesped:
// laterales, postes/crossbar y linea de fondo.
//
// No usa el motor de Arcade Physics a proposito: a 1550 px/s la pelota
// recorre ~26 px por frame y se saltaria el collider del arco.
export default class BallPhysics {
  constructor(ball, handlers = {}) {
    this.ball = ball;
    this.handlers = handlers;
  }

  update(dt) {
    const ball = this.ball;
    if (ball.paused || dt <= 0) return;

    const travel = Math.hypot(ball.vx, ball.vy) * dt;
    const steps = Math.max(1, Math.ceil(travel / BALL.maxSubstep));
    const step = dt / steps;

    for (let i = 0; i < steps; i++) {
      // Si salio un remate en este subpaso, la pelota ya fue reposicionada:
      // no hay que moverla otra vez.
      if (this.handlers.onSubstep?.()) return;

      ball.x += ball.vx * step;
      ball.y += ball.vy * step;

      this.resolveSideWalls();
      const outcome = this.resolveGoalLine();

      if (outcome === 'goal-player' || outcome === 'goal-ai') {
        ball.paused = true;
        this.handlers.onGoal?.(outcome === 'goal-player' ? 'player' : 'ai');
        return;
      }

      if (outcome === 'post') {
        this.handlers.onPost?.();
      }
    }
  }

  resolveSideWalls() {
    const ball = this.ball;
    const min = ball.radius + 2;
    const max = CANVAS.width - ball.radius - 2;

    if (ball.x < min) {
      ball.x = min;
      ball.vx = Math.abs(ball.vx);
      ball.deflect();
      this.handlers.onWall?.();
    } else if (ball.x > max) {
      ball.x = max;
      ball.vx = -Math.abs(ball.vx);
      ball.deflect();
      this.handlers.onWall?.();
    }
  }

  // Devuelve 'post' si reboto en el travesano/post, 'goal-player' o
  // 'goal-ai' si entro, y null si no llego a la linea.
  resolveGoalLine() {
    const ball = this.ball;
    const half = PITCH.goalWidth / 2 - ball.radius;
    const insideMouth = Math.abs(ball.x - PITCH.centerX) <= half;

    if (ball.vy < 0 && ball.y - ball.radius <= PITCH.top) {
      if (insideMouth) return 'goal-player';
      ball.y = PITCH.top + ball.radius;
      ball.vy = Math.abs(ball.vy) * BALL.postRestitution;
      ball.deflect(0.22);
      return 'post';
    }

    if (ball.vy > 0 && ball.y + ball.radius >= PITCH.bottom) {
      if (insideMouth) return 'goal-ai';
      ball.y = PITCH.bottom - ball.radius;
      ball.vy = -Math.abs(ball.vy) * BALL.postRestitution;
      ball.deflect(0.22);
      return 'post';
    }

    return null;
  }
}