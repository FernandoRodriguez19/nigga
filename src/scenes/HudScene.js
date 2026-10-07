import Phaser from 'phaser';
import { CANVAS, FONT, PALETTE, PHASES } from '../config.js';
import { bus, BusBinding, EVENTS } from '../bus.js';
import { formatClock } from '../utils/math.js';
import { hexToCss, mixHex } from '../utils/color.js';

// Capa de interfaz: marcador, reloj, racha, barra de carga, avisos y
// panel final. Escena aparte para no recargarse con cada gol.
export default class HudScene extends Phaser.Scene {
  constructor() {
    super('Hud');
  }

  create() {
    this.combo = 0;
    this.bus = new BusBinding(bus);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.bus.destroy();
      this.tweens.killAll();
    });

    this.drawScorePanel();
    this.drawComboBadge();
    this.drawPowerBar();
    this.drawBanner();
    this.drawResultPanel();

    this.bus
      .on(EVENTS.score, this.applyScore, this)
      .on(EVENTS.timer, this.applyTimer, this)
      .on(EVENTS.combo, this.applyCombo, this)
      .on(EVENTS.power, this.applyPower, this)
      .on(EVENTS.phase, this.applyPhase, this)
      .on(EVENTS.matchOver, this.applyMatchOver, this)
      .on(EVENTS.goal, this.applyGoal, this)
      .on('countdown', this.applyCountdown, this);
  }

  drawScorePanel() {
    const panel = this.add.graphics().setDepth(10);
    panel.fillStyle(PALETTE.panel, 0.82);
    panel.fillRoundedRect(CANVAS.width / 2 - 190, 22, 380, 92, 14);
    panel.lineStyle(2, 0x24304d, 1).strokeRoundedRect(CANVAS.width / 2 - 190, 22, 380, 92, 14);

    this.aiScore = this.add
      .text(CANVAS.width / 2 - 118, 50, '0', { fontFamily: FONT, fontSize: '46px', color: '#ff5d73' })
      .setOrigin(0.5)
      .setDepth(11);
    this.playerScore = this.add
      .text(CANVAS.width / 2 + 118, 50, '0', { fontFamily: FONT, fontSize: '46px', color: '#2ee6a8' })
      .setOrigin(0.5)
      .setDepth(11);

    this.add
      .text(CANVAS.width / 2 - 118, 90, 'IA', { fontFamily: FONT, fontSize: '13px', color: '#6b7a9c' })
      .setOrigin(0.5)
      .setDepth(11);
    this.add
      .text(CANVAS.width / 2 + 118, 90, 'VOS', { fontFamily: FONT, fontSize: '13px', color: '#6b7a9c' })
      .setOrigin(0.5)
      .setDepth(11);

    this.add
      .text(CANVAS.width / 2, 50, ':', { fontFamily: FONT, fontSize: '34px', color: '#55648a' })
      .setOrigin(0.5)
      .setDepth(11);

    this.timeLabel = this.add
      .text(CANVAS.width / 2, 90, '1:30', { fontFamily: FONT, fontSize: '18px', color: '#93a3c4' })
      .setOrigin(0.5)
      .setDepth(11);
  }

  drawComboBadge() {
    this.comboBox = this.add.graphics().setDepth(10);
    this.comboText = this.add
      .text(CANVAS.width / 2, 138, '', { fontFamily: FONT, fontSize: '22px', color: '#ffd23f' })
      .setOrigin(0.5)
      .setDepth(11)
      .setAlpha(0);
  }

  drawPowerBar() {
    this.powerBox = this.add.graphics().setDepth(10);
    this.powerText = this.add
      .text(CANVAS.width / 2, 0, '', { fontFamily: FONT, fontSize: '12px', color: '#93a3c4' })
      .setOrigin(0.5)
      .setDepth(11);
  }

  drawBanner() {
    this.banner = this.add
      .text(CANVAS.width / 2, CANVAS.height / 2, '', {
        fontFamily: FONT,
        fontSize: '86px',
        color: '#ffffff',
        stroke: '#0b1220',
        strokeThickness: 10,
        align: 'center',
      })
      .setOrigin(0.5)
      .setDepth(30)
      .setAlpha(0);

    this.bannerSub = this.add
      .text(CANVAS.width / 2, CANVAS.height / 2 + 80, '', {
        fontFamily: FONT,
        fontSize: '22px',
        color: '#93a3c4',
        align: 'center',
      })
      .setOrigin(0.5)
      .setDepth(30)
      .setAlpha(0);
  }

  drawResultPanel() {
    this.resultBox = this.add.graphics().setDepth(20).setAlpha(0);
    this.resultBox.fillStyle(PALETTE.panel, 0.94);
    this.resultBox.fillRoundedRect(70, 250, CANVAS.width - 140, 430, 18);
    this.resultBox.lineStyle(3, 0x24304d, 1).strokeRoundedRect(70, 250, CANVAS.width - 140, 430, 18);

    this.resultTitle = this.add
      .text(CANVAS.width / 2, 330, '', { fontFamily: FONT, fontSize: '54px', color: '#ffffff' })
      .setOrigin(0.5)
      .setDepth(21)
      .setAlpha(0);
    this.resultStats = this.add
      .text(CANVAS.width / 2, 430, '', {
        fontFamily: FONT,
        fontSize: '20px',
        color: '#93a3c4',
        align: 'center',
        lineSpacing: 10,
      })
      .setOrigin(0.5)
      .setDepth(21)
      .setAlpha(0);
    this.resultHint = this.add
      .text(CANVAS.width / 2, 620, 'R  revancha      ESC  menu', {
        fontFamily: FONT,
        fontSize: '20px',
        color: '#55648a',
      })
      .setOrigin(0.5)
      .setDepth(21)
      .setAlpha(0);
  }

  applyScore({ player, ai }) {
    this.playerScore.setText(String(player));
    this.aiScore.setText(String(ai));
    this.pulse(this.playerScore);
    this.pulse(this.aiScore);
  }

  applyTimer(remaining) {
    const text = formatClock(remaining);
    this.timeLabel.setText(text);
    this.timeLabel.setColor(remaining <= 10 ? '#ff5d73' : '#93a3c4');
  }

  applyCombo({ combo, max }) {
    this.combo = combo;
    const g = this.comboBox;
    g.clear();

    if (combo < 2) {
      this.tweens.killTweensOf(this.comboText);
      this.comboText.setAlpha(0);
      return;
    }

    const label = `RACHA  x${combo}`;
    this.comboText.setText(label);
    const heat = Math.min(1, combo / 14);
    const color = this.heatCss(heat);

    const width = this.comboText.width + 56;
    g.fillStyle(PALETTE.panel, 0.85).fillRoundedRect(CANVAS.width / 2 - width / 2, 122, width, 38, 10);
    g.lineStyle(2, this.heatColor(heat), 0.9).strokeRoundedRect(CANVAS.width / 2 - width / 2, 122, width, 38, 10);
    this.comboText.setColor(color);

    if (combo === max && combo >= 3) {
      this.tweens.killTweensOf(this.comboText);
      this.comboText.setScale(1.25);
      this.comboText.setAlpha(1);
      this.tweens.add({ targets: this.comboText, scale: 1, duration: 220, ease: 'Back.out' });
    }
  }

  applyPower({ value, x, locked }) {
    const g = this.powerBox;
    g.clear();

    if (locked) {
      const width = 108;
      const y = CANVAS.height - 150;
      g.fillStyle(PALETTE.danger, 0.35).fillRoundedRect(x - width / 2, y, width, 12, 6);
      this.powerText.setPosition(x, y - 14).setText('FALLO').setColor('#ff4d4d').setAlpha(1);
      return;
    }

    if (value <= 0) {
      this.powerText.setAlpha(0);
      return;
    }

    const width = 132;
    const height = 14;
    const y = CANVAS.height - 156;

    g.fillStyle(0x0b1220, 0.8).fillRoundedRect(x - width / 2, y, width, height, 7);
    g.fillStyle(this.heatColor(value), 1).fillRoundedRect(x - width / 2 + 3, y + 3, (width - 6) * value, height - 6, 4);
    g.lineStyle(2, 0xffffff, 0.35).strokeRoundedRect(x - width / 2, y, width, height, 7);

    this.powerText
      .setPosition(x, y - 14)
      .setText(value >= 0.99 ? 'POTENTE' : value <= 0.4 ? 'PASE' : 'MEDIA')
      .setColor('#ffffff')
      .setAlpha(1);
  }

  applyPhase(phase) {
    if (phase === PHASES.countdown) this.showResult(false);
    if (phase === PHASES.playing) this.showResult(false);
    if (phase === PHASES.goal) this.showResult(false);
  }

  applyGoal({ scorer }) {
    this.showBanner(scorer === 'player' ? 'GOL' : 'GOL EN CONTRA', scorer === 'player' ? '#2ee6a8' : '#ff5d73', 0.9);
  }

  applyCountdown(value) {
    if (value < 0) {
      this.showBanner('¡YA!', '#ffd23f', 0.5);
      return;
    }
    this.banner.setText(String(value)).setColor('#ffffff').setAlpha(1).setScale(1.6);
    this.bannerSub.setAlpha(0);
    this.tweens.killTweensOf(this.banner);
    this.tweens.add({ targets: this.banner, scale: 1, duration: 260, ease: 'Back.out' });
  }

  applyMatchOver(stats) {
    const titles = {
      player: 'GANASTE',
      ai: 'PERDISTE',
      draw: 'EMPATE',
    };
    const colors = { player: '#2ee6a8', ai: '#ff5d73', draw: '#ffd23f' };

    this.showBanner('', '', 0);
    this.bannerSub.setAlpha(0);

    this.resultTitle.setText(titles[stats.winner]).setColor(colors[stats.winner]);
    this.resultStats.setText(
      [
        `Goles   ${stats.score.player}  -  ${stats.score.ai}`,
        `Racha maxima   ${stats.maxCombo}`,
        `Pateadas   ${stats.kicks}   (${stats.perfectKicks} perfectas)`,
        `Fallos   ${stats.whiffs}`,
      ].join('\n'),
    );

    [this.resultBox, this.resultTitle, this.resultStats, this.resultHint].forEach((item) =>
      this.tweens.add({ targets: item, alpha: 1, duration: 320 }),
    );
    this.tweens.add({ targets: this.resultTitle, scale: { from: 0.7, to: 1 }, duration: 380, ease: 'Back.out' });
  }

  showResult(visible) {
    const targets = [this.resultBox, this.resultTitle, this.resultStats, this.resultHint];
    this.tweens.killTweensOf(targets);
    targets.forEach((item) => item.setAlpha(visible ? 1 : 0));
  }

  showBanner(text, color, duration) {
    this.banner.setText(text).setColor(color).setAlpha(1).setScale(1);
    this.tweens.killTweensOf(this.banner);
    if (duration > 0) {
      this.tweens.add({
        targets: this.banner,
        alpha: 0,
        scale: 1.35,
        delay: duration * 600,
        duration: 260,
      });
    }
  }

pulse(target) {
    this.tweens.killTweensOf(target);
    target.setScale(1.4);
    this.tweens.add({ targets: target, scale: 1, duration: 260, ease: 'Back.out' });
  }

  // El calor va de amarillo a rojo. Un numero para los Graphics,
  // un string CSS para los Text.
  heatColor(ratio) {
    return mixHex(PALETTE.charge, 0xff4d4d, ratio);
  }

  heatCss(ratio) {
    return hexToCss(this.heatColor(ratio));
  }
}