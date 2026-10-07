import Phaser from 'phaser';
import { AI_LEVELS, CANVAS, DEFAULT_DIFFICULTY, FONT, PALETTE, PITCH } from '../config.js';
import { audio } from '../systems/AudioSystem.js';

const KEYS = Object.keys(AI_LEVELS);

export default class MenuScene extends Phaser.Scene {
  constructor() {
    super('Menu');
  }

  create() {
    this.difficulty = this.registry.get('difficulty') || DEFAULT_DIFFICULTY;
    this.selected = KEYS.indexOf(this.difficulty) === -1 ? KEYS.indexOf(DEFAULT_DIFFICULTY) : KEYS.indexOf(this.difficulty);

    this.drawBackground();
    this.drawTitle();
    this.drawDifficulty();
    this.drawControls();
    this.drawBallDemo();

    const keyboard = this.input.keyboard;
    keyboard.on('keydown-LEFT', () => this.move(-1));
    keyboard.on('keydown-A', () => this.move(-1));
    keyboard.on('keydown-RIGHT', () => this.move(1));
    keyboard.on('keydown-D', () => this.move(1));
    keyboard.on('keydown-ONE', () => this.select(0));
    keyboard.on('keydown-TWO', () => this.select(1));
    keyboard.on('keydown-THREE', () => this.select(2));
    keyboard.on('keydown-ENTER', () => this.startGame());
    keyboard.on('keydown-SPACE', () => this.startGame());
    keyboard.on('keydown-M', () => this.toggleMute());
    this.input.on('pointerup', () => this.startGame());

    this.startHint = this.add
      .text(CANVAS.width / 2, CANVAS.height - 58, 'ENTER  para arrancar', {
        fontFamily: FONT,
        fontSize: '24px',
        color: '#ffffff',
      })
      .setOrigin(0.5);

    this.tweens.add({
      targets: this.startHint,
      alpha: { from: 1, to: 0.35 },
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut',
    });

    this.cameras.main.fadeIn(260, 4, 8, 16);
  }

  drawBackground() {
    const g = this.add.graphics();
    g.fillStyle(PALETTE.sky, 1).fillRect(0, 0, CANVAS.width, CANVAS.height);

    const bands = 10;
    const bandHeight = CANVAS.height / bands;
    for (let i = 0; i < bands; i++) {
      g.fillStyle(i % 2 === 0 ? PALETTE.grassA : PALETTE.grassB, 0.16);
      g.fillRect(0, i * bandHeight, CANVAS.width, bandHeight);
    }

    g.lineStyle(3, PALETTE.line, 0.14);
    g.strokeRect(60, 120, CANVAS.width - 120, CANVAS.height - 240);
    g.lineBetween(60, PITCH.middle, CANVAS.width - 60, PITCH.middle);
    g.strokeCircle(PITCH.centerX, PITCH.middle, PITCH.centerCircle);
    g.lineStyle(4, PALETTE.line, 0.18);
    g.lineBetween(PITCH.centerX - PITCH.goalWidth / 2, 60, PITCH.centerX + PITCH.goalWidth / 2, 60);
    g.lineBetween(PITCH.centerX - PITCH.goalWidth / 2, CANVAS.height - 60, PITCH.centerX + PITCH.goalWidth / 2, CANVAS.height - 60);
  }

  drawTitle() {
    this.add
      .text(CANVAS.width / 2, 210, 'FUTBOL', {
        fontFamily: FONT,
        fontSize: '78px',
        color: '#ffffff',
        stroke: '#0b1220',
        strokeThickness: 10,
      })
      .setOrigin(0.5);

    this.add
      .text(CANVAS.width / 2, 288, 'R A C H A', {
        fontFamily: FONT,
        fontSize: '44px',
        color: '#2ee6a8',
        stroke: '#0b1220',
        strokeThickness: 8,
      })
      .setOrigin(0.5);

    this.add
      .text(
        CANVAS.width / 2,
        342,
        '1v1 vertical  ·  carga y suelta para patear\nla pelota acelera con cada racha  ·  90 segundos',
        { fontFamily: FONT, fontSize: '17px', color: '#93a3c4', align: 'center', lineSpacing: 8 },
      )
      .setOrigin(0.5);
  }

  drawDifficulty() {
    this.add
      .text(CANVAS.width / 2, 452, 'DIFICULTAD', {
        fontFamily: FONT,
        fontSize: '20px',
        color: '#55648a',
      })
      .setOrigin(0.5);

    this.options = KEYS.map((key, index) => {
      const box = this.add.graphics();
      const label = this.add
        .text(CANVAS.width / 2, 522 + index * 74, AI_LEVELS[key].label.toUpperCase(), {
          fontFamily: FONT,
          fontSize: '30px',
          color: '#ffffff',
        })
        .setOrigin(0.5);
      return { key, box, label, index };
    });

    this.highlight = this.add.graphics();
    this.refreshOptions();
  }

  refreshOptions() {
    this.options.forEach((option) => {
      const isSelected = option.index === this.selected;
      option.label.setAlpha(isSelected ? 1 : 0.45);
      option.label.setColor(isSelected ? '#2ee6a8' : '#ffffff');
    });

    this.highlight.clear();
    const y = 522 + this.selected * 74;
    this.highlight.fillStyle(PALETTE.player, 0.12).fillRoundedRect(96, y - 28, CANVAS.width - 192, 56, 10);
    this.highlight.lineStyle(2, PALETTE.player, 0.8).strokeRoundedRect(96, y - 28, CANVAS.width - 192, 56, 10);
  }

  drawControls() {
    const lines = [
      ['<  >  o  A / D', 'moverse en tu linea'],
      ['ESPACIO (mantener)', 'cargar la patada'],
      ['ESPACIO (soltar)', 'patear - hay que hacerlo en el momento justo'],
    ];

    const startY = 782;
    this.add
      .text(CANVAS.width / 2, startY - 44, 'CONTROLES', {
        fontFamily: FONT,
        fontSize: '18px',
        color: '#55648a',
      })
      .setOrigin(0.5);

    lines.forEach(([key, description], index) => {
      const y = startY + index * 62;
      const box = this.add.graphics();
      box.fillStyle(0x0d1526, 0.85).fillRoundedRect(70, y - 22, CANVAS.width - 140, 50, 8);
      box.lineStyle(1, 0x1e2b47, 1).strokeRoundedRect(70, y - 22, CANVAS.width - 140, 50, 8);

      this.add
        .text(96, y, key, { fontFamily: FONT, fontSize: '18px', color: '#ffd23f' })
        .setOrigin(0, 0.5);
      this.add
        .text(360, y, description, { fontFamily: FONT, fontSize: '15px', color: '#93a3c4' })
        .setOrigin(0, 0.5);
    });

    this.add
      .text(CANVAS.width / 2, 1000, 'R reinicia  ·  ESC menu  ·  M silencia', {
        fontFamily: FONT,
        fontSize: '15px',
        color: '#55648a',
      })
      .setOrigin(0.5);
  }

  // Pelota de decoracion rebotando de fondo.
  drawBallDemo() {
    this.demo = this.add.circle(0, 0, 11, PALETTE.ball, 0.85).setDepth(5);
    this.demo.vx = 210;
    this.demo.vy = -260;
  }

  update(_time, delta) {
    const dt = Math.min(delta, 50) / 1000;
    const ball = this.demo;
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;
    if (ball.x < 20 || ball.x > CANVAS.width - 20) ball.vx *= -1;
    if (ball.y < 20 || ball.y > CANVAS.height - 20) ball.vy *= -1;
    ball.x = Phaser.Math.Clamp(ball.x, 20, CANVAS.width - 20);
    ball.y = Phaser.Math.Clamp(ball.y, 20, CANVAS.height - 20);
  }

  move(direction) {
    audio.unlock();
    this.selected = Phaser.Math.Wrap(this.selected + direction, 0, KEYS.length);
    this.registry.set('difficulty', KEYS[this.selected]);
    audio.tone({ freq: 620, type: 'square', duration: 0.05, gain: 0.08 });
    this.refreshOptions();
  }

  select(index) {
    audio.unlock();
    this.selected = index;
    this.registry.set('difficulty', KEYS[this.selected]);
    this.refreshOptions();
  }

  toggleMute() {
    audio.unlock();
    const muted = audio.toggleMute();
    this.registry.set('muted', muted);
  }

  startGame() {
    audio.unlock();
    this.registry.set('difficulty', KEYS[this.selected]);
    this.cameras.main.fadeOut(200, 4, 8, 16);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start('Game');
    });
  }
}