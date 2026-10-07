import { AI_LEVELS, CANVAS, KICK } from '../config.js';
import { approach, clamp, randomRange } from '../utils/math.js';

/**
 * La IA juega con las mismas reglas que el humano: se mueve, carga y
 * suelta, y pasa por el mismo KickSystem.
 *
 * La diferencia es cuanto calcula bien el momento. Mantiene la patada
 * cargada mientras espera y la suelta calculando cuantos segundos faltan
 * para que la pelota entre en la ventana de tiro, con error de punteria
 * y de tiempo segun la dificultad.
 */
export default class AIController {
  constructor({ kicker, kickSystem, ball, level = 'normal', onKickRequest }) {
    this.kicker = kicker;
    this.kickSystem = kickSystem;
    this.ball = ball;
    this.onKickRequest = onKickRequest;
    this.configure(level);
  }

  configure(level) {
    this.levelKey = AI_LEVELS[level] ? level : 'normal';
    this.level = AI_LEVELS[this.levelKey];
    this.kicker.moveSpeed = this.level.moveSpeed;
    this.reset();
  }

  reset() {
    this.targetX = this.kicker.x;
    this.reactionTimer = 0;
    this.lastVertical = 0;
    this.committing = false;
    this.mistime = false;
    this.swingLead = 0;
  }

  update(dt) {
    if (this.ball.paused) {
      this.lastVertical = 0;
      this.committing = false;
      return;
    }

    this.trackBall(dt);
    this.manageCharge();
    this.move();
  }

  // Persigue la pelota con error de punteria y delay de reaccion.
  trackBall(dt) {
    const { kicker, ball, level } = this;
    const state = this.kickSystem.evaluate(kicker);
    const vertical = ball.vy > 0 ? 1 : ball.vy < 0 ? -1 : 0;

    // La pelota cambio de sentido: arranca un ataque nuevo. Se sortea si
    // esta vez va a calcular mal el momento de soltar.
    if (vertical !== 0 && vertical !== this.lastVertical) {
      this.lastVertical = vertical;
      this.committing = false;
      this.mistime = Math.random() < level.whiffChance;
      // Suelta con margen: si espera justo hasta el limite, la patada vence
      // un frame antes de que la pelota entre en la ventana.
      this.swingLead = KICK.swingTime * randomRange(0.3, 0.7);
      this.reactionTimer = level.reaction;
      this.targetX = this.clampTarget(ball.x + randomRange(-1, 1) * level.aimError * 1.6);
    }

    if (this.reactionTimer > 0) this.reactionTimer -= dt;

    // Empieza apegarse al lugar de la pelota antes de que entre en la
    // ventana: si espera hasta el ultimo momento ya no llega.
    if (state.distance < KICK.window * 1.8 && !this.committing) {
      this.committing = true;
      this.targetX = this.clampTarget(ball.x + randomRange(-1, 1) * level.aimError * 0.4);
    }
  }

  // Mantiene la patada cargada y suelta cuando ya tiene que salir.
  manageCharge() {
    const { kicker, ball } = this;
    const state = this.kickSystem.evaluate(kicker);

    if (kicker.isLocked) return;
    if (state.reason === 'receding') return;

    if (!kicker.charging) kicker.startCharge();
    if (state.canKick) return;

    const timeToWindow = this.timeToWindow();

    // El error de tiempo: suelta demasiado pronto y la patada se pierde.
    if (this.mistime && timeToWindow <= KICK.swingTime + 0.12) {
      this.mistime = false;
      this.release();
      return;
    }

    if (timeToWindow <= this.swingLead) this.release();
  }

  // Segundos hasta que la pelota entre en la ventana de remate.
  timeToWindow() {
    const speed = Math.max(1, Math.abs(this.ball.vy));
    const distance = Math.abs(this.ball.distanceToLine(this.kicker.facing));
    return Math.max(0, (distance - KICK.window) / speed);
  }

  // La IA pide el remate con la carga que efectivamentetiene, igual
  // que el jugador. Si suelta tarde, falla y se castiga.
  release() {
    if (this.kicker.isLocked) return;
    this.onKickRequest(this.kicker.charge);
  }

  move() {
    const delta = this.targetX - this.kicker.x;
    if (Math.abs(delta) < 1) return;
    this.kicker.x = approach(this.kicker.x, this.targetX, this.level.moveSpeed / 60);
    this.kicker.x = this.clampTarget(this.kicker.x);
  }

  clampTarget(x) {
    return clamp(x, this.kicker.reach, CANVAS.width - this.kicker.reach);
  }
}