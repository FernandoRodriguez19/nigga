import { BALL, KICK, PHASES, PITCH } from '../config.js';
import { randomServeAngle } from '../entities/Ball.js';
import AIController from '../entities/AIController.js';
import BallPhysics from './BallPhysics.js';
import KickSystem from './KickSystem.js';

const SERVE_SPEED = BALL.speed * 0.85;

/**
 * El partido en una sola clase: phases, reloj, pelota, patadas e IA.
 *
 * No sabe nada de Phaser ni de dibujo, asi que se puede simular entera
 * en Node. GameScene solo la instancia, le pasa el teclado y escucha los
 * hooks para los efectos.
 */
export default class MatchRunner {
  constructor({ ball, match, player, rival, level = 'normal', getAxis = () => 0, bus, audio, hooks = {} }) {
    this.ball = ball;
    this.match = match;
    this.player = player;
    this.rival = rival;
    this.bus = bus;
    this.audio = audio;
    this.hooks = hooks;
    this.getAxis = getAxis;
    this.hitstop = 0;
    this.serveTowardsTop = Math.random() > 0.5;

    this.physics = new BallPhysics(ball, {
      onGoal: (scorer) => this.handleGoal(scorer),
      onPost: () => this.handlePost(),
      onWall: () => this.audio?.wall(),
      onSubstep: () => {
        const before = this.kick.arms.size;
        this.kick.check([this.player, this.rival]);
        return this.kick.arms.size !== before;
      },
    });

    this.kick = new KickSystem({
      ball,
      match,
      bus,
      audio,
      onFire: () => {
        this.hitstop = KICK.hitstop;
      },
    });

    this.ai = new AIController({
      kicker: rival,
      kickSystem: this.kick,
      ball,
      level,
      onKickRequest: (power) => this.requestKick(rival, power),
    });
  }

  get frozen() {
    return this.hitstop > 0;
  }

  get playable() {
    return this.match.isPlayable;
  }

  start() {
    this.match.start();
  }

/** Unico camino para patear, del jugador y de la IA por igual. */
requestKick(kicker, power) {
    this.kick.swing(kicker, power);
  }

  /** Entrada del humano: mantener y soltar. */
  beginCharge() {
    if (!this.playable) return false;
    return this.player.startCharge();
  }

  releaseCharge() {
    const power = this.player.releaseCharge();
    if (power !== null && this.playable) this.requestKick(this.player, power);
    return power;
  }

  // El saque arranca recien cuando la fase pasa a "playing": antes la
  // pelota queda quieta en el centro durante la cuenta regresiva.
  handlePhase(phase) {
    if (phase === PHASES.playing) this.serve();
  }

  serve() {
    this.player.reset();
    this.rival.reset();
    this.ai.reset();
    this.kick.reset();
    this.hitstop = 0;
    this.ball.place(PITCH.centerX, PITCH.middle);
    this.ball.serve(randomServeAngle(this.serveTowardsTop), SERVE_SPEED);
    this.bus?.emit('serve', { towardsTop: this.serveTowardsTop });
  }

  handleGoal(scorer) {
    if (this.match.phase === PHASES.goal || this.match.phase === PHASES.over) return;
    this.hitstop = 110;
    // El saque posterior va hacia el arco del que acaba de recibir gol.
    this.serveTowardsTop = scorer === 'ai';
    this.match.registerGoal(scorer);
    this.audio?.goal();
    this.hooks.onGoal?.(scorer);
  }

  handlePost() {
    this.hitstop = Math.max(this.hitstop, 45);
    this.audio?.post();
  }

  update(dt) {
    this.match.update(dt);

    // Congelado de impacto: se frena todo menos el HUD.
    if (this.frozen) {
      this.hitstop = Math.max(0, this.hitstop - dt * 1000);
      return;
    }

    const active = this.match.isPlayable;

    this.player.update(dt, active ? this.getAxis() : 0);
    if (active) this.ai.update(dt);
    // La IA mueve al rival por su cuenta, pero la carga la acumula Kicker.
    this.rival.update(dt, 0);

    this.kick.tick(dt, [this.player, this.rival]);
    this.physics.update(dt);
    this.updateKickerStates();
  }

  // Aro "solta ya": se enciende cuando soltar la patada todavia alcanza.
  updateKickerStates() {
    [this.player, this.rival].forEach((kicker) => {
      kicker.ready = this.kick.canStillReach(kicker);
    });
  }
}