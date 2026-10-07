import Phaser from 'phaser';
import { CANVAS, PALETTE, PITCH } from '../config.js';
import Ball from '../entities/Ball.js';
import Kicker from '../entities/Kicker.js';
import MatchSystem from '../systems/MatchSystem.js';
import MatchRunner from '../systems/MatchRunner.js';
import InputSystem from '../systems/InputSystem.js';
import { audio } from '../systems/AudioSystem.js';
import PitchView from '../views/PitchView.js';
import { bus, EVENTS } from '../bus.js';

// Escena de partido: arma las piezas y traduce eventos en efectos.
// Toda la logica vive en MatchRunner.
export default class GameScene extends Phaser.Scene {
  constructor() {
    super('Game');
  }

  create() {
    new PitchView(this);
    this.drawFieldDeco();

    this.ball = new Ball(this);
    this.player = new Kicker(this, {
      id: 'player',
      name: 'VOS',
      y: PITCH.bottom,
      facing: -1,
      accent: PALETTE.player,
      dark: PALETTE.playerDark,
    });
    this.rival = new Kicker(this, {
      id: 'ai',
      name: 'IA',
      y: PITCH.top,
      facing: 1,
      accent: PALETTE.ai,
      dark: PALETTE.aiDark,
    });
    this.match = new MatchSystem(bus);

    this.input = new InputSystem(this, {
      onChargeStart: () => this.runner.beginCharge(),
      onChargeRelease: () => this.runner.releaseCharge(),
      onRestart: () => this.restart(),
      onMenu: () => this.goToMenu(),
      onMute: () => {
        audio.unlock();
        this.registry.set('muted', audio.toggleMute());
      },
    });

    this.runner = new MatchRunner({
      ball: this.ball,
      match: this.match,
      player: this.player,
      rival: this.rival,
      level: this.registry.get('difficulty'),
      getAxis: () => this.input.axis,
      bus,
      audio,
      hooks: { onGoal: () => this.cameras.main.flash(180, 40, 255, 190) },
    });

    bus.on(EVENTS.kick, this.handleKick, this);
    bus.on(EVENTS.phase, this.handlePhase, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.teardown());

    this.runner.start();
    this.scene.launch('Hud');

    this.cameras.main.fadeIn(240, 4, 8, 16);
  }

  drawFieldDeco() {
    const g = this.add.graphics().setDepth(-9);
    g.fillStyle(0x000000, 0.32);
    g.fillRect(0, 0, CANVAS.width, PITCH.top);
    g.fillRect(0, PITCH.bottom, CANVAS.width, CANVAS.height - PITCH.bottom);
  }

  handlePhase(phase) {
    this.runner.handlePhase(phase);
  }

  handleKick({ kickerId, power }) {
    const kicker = kickerId === 'player' ? this.player : this.rival;
    this.spawnImpact(kicker, power);
  }

  // Chispas del remate: mas cantidad y velocidad cuanto mas carga.
  spawnImpact(kicker, power) {
    const bodyY = kicker.lineY + kicker.facing * 20;
    const particles = this.add.particles(kicker.x, bodyY, 'spark', {
      lifespan: { min: 180, max: 420 },
      speed: { min: 90, max: 120 + power * 340 },
      angle: kicker.facing < 0 ? { min: 200, max: 340 } : { min: 20, max: 160 },
      gravityY: kicker.facing < 0 ? -180 : 180,
      scale: { start: 3 + power * 2.5, end: 0 },
      alpha: { start: 0.95, end: 0 },
      tint: [0xffffff, kicker.accent, PALETTE.charge],
      blendMode: 'ADD',
      emitting: false,
    });

    particles.setDepth(9);
    particles.explode(8 + Math.round(power * 16));
    this.time.delayedCall(700, () => particles.destroy());
  }

  restart() {
    audio.unlock();
    this.scene.stop('Hud');
    this.scene.restart();
  }

  goToMenu() {
    audio.unlock();
    this.scene.stop('Hud');
    this.scene.start('Menu');
  }

  teardown() {
    bus.off(EVENTS.kick, this.handleKick, this);
    bus.off(EVENTS.phase, this.handlePhase, this);
    this.ball?.destroy();
    this.player?.destroy();
    this.rival?.destroy();
  }

  update(_time, delta) {
    // El tope de dt evita saltos giantecos tras una pausa de la pestana.
    const dt = Math.min(delta, 40) / 1000;

    this.runner.update(dt);
    if (!this.runner.frozen) this.ball.render(dt);

    bus.emit(EVENTS.power, {
      value: this.player.charging ? this.player.charge : 0,
      x: this.player.x,
      locked: this.player.isLocked,
    });
  }
}