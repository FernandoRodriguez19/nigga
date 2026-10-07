import { CANVAS, KICKER, PALETTE, FONT } from '../config.js';
import { clamp } from '../utils/math.js';
import { hexToCss, mixHex } from '../utils/color.js';

// Amarillo -> rojo segun cuanta carga se acumulo.
const heatColor = (ratio) => mixHex(PALETTE.charge, 0xff4d4d, ratio);

// Un portero-kicker: figura que se mueve en horizontal sobre su linea
// de fondo, carga la patada y suelta. Se usa igual para vos y para la IA.
export default class Kicker {
  constructor(scene, { id, name, y, facing, accent, dark }) {
    this.id = id;
    this.name = name;
    this.lineY = y;
    this.facing = facing; // -1 mira arriba (jugador) / +1 mira abajo (IA)
    this.accent = accent;
    this.dark = dark;
    this.reach = KICKER.reach;
    this.moveSpeed = KICKER.moveSpeed;

    this.x = CANVAS.width / 2;
    this.charge = 0;
    this.charging = false;
    this.lockout = 0;
    this.flash = 0;
    this.swing = 0;
    this.ready = false;
    this.pulse = 0;

    this.graphics = scene.add.graphics().setDepth(8);
    this.nameText = scene.add
      .text(this.x, y + facing * 44, name, {
        fontFamily: FONT,
        fontSize: '15px',
        color: hexToCss(accent),
      })
      .setOrigin(0.5)
      .setDepth(8)
      .setAlpha(0.85);
  }

  reset(x = CANVAS.width / 2) {
    this.x = x;
    this.charge = 0;
    this.charging = false;
    this.lockout = 0;
    this.flash = 0;
    this.swing = 0;
    this.ready = false;
    this.pulse = 0;
  }

  get isLocked() {
    return this.lockout > 0;
  }

  update(dt, axis) {
    this.pulse += dt;
    if (this.lockout > 0) this.lockout = Math.max(0, this.lockout - dt);
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt);
    if (this.swing > 0) this.swing = Math.max(0, this.swing - dt * 4.5);

    if (axis !== 0 && this.lockout <= 0) {
      this.x = clamp(this.x + axis * this.moveSpeed * dt, this.reach, CANVAS.width - this.reach);
    }

    if (this.charging && this.lockout <= 0) {
      this.charge = clamp(this.charge + dt / KICKER.chargeTime, 0, 1);
    }

    this.draw();
  }

  startCharge() {
    if (this.lockout > 0) return false;
    this.charging = true;
    return true;
  }

  // Devuelve la potencia acumulada, o null si no habia nada que soltar.
  releaseCharge() {
    if (!this.charging || this.lockout > 0) return null;
    const power = clamp(Math.max(this.charge, KICKER.minPower), KICKER.minPower, 1);
    this.charging = false;
    this.charge = 0;
    return power;
  }

  onWhiff() {
    this.charge = 0;
    this.charging = false;
    this.lockout = KICKER.lockout;
    this.flash = 0.35;
  }

  onKick() {
    this.charge = 0;
    this.charging = false;
    this.swing = 1;
  }

  // -1 a 1: donde cae la pelota respecto del cuerpo.
  contactOffset(ballX) {
    return clamp((ballX - this.x) / this.reach, -1, 1);
  }

  draw() {
    const g = this.graphics;
    g.clear();

    const bodyY = this.lineY + this.facing * KICKER.bodyRadius;
    const lunge = this.facing * this.swing * 10;
    const chargeRatio = this.charging ? this.charge : 0;

    // barra de alcance
    g.fillStyle(0x000000, 0.18);
    g.fillRect(this.x - this.reach, this.lineY + this.facing * 5, this.reach * 2, 5);

    // sombra
    g.fillStyle(0x000000, 0.32);
    g.fillEllipse(this.x, bodyY + this.facing * 22, 44, 12);

    // estela de la patada
    if (this.swing > 0) {
      g.lineStyle(4, this.accent, this.swing * 0.7);
      g.beginPath();
      g.arc(this.x, bodyY, 40 + this.swing * 22, this.facing < 0 ? Math.PI : 0, this.facing < 0 ? Math.PI * 2 : Math.PI, false);
      g.strokePath();
    }

    // cuerpo
    g.fillStyle(this.dark, 1);
    g.fillCircle(this.x, bodyY + lunge * 0.3, KICKER.bodyRadius);
    g.fillStyle(this.accent, 1);
    g.fillCircle(this.x, bodyY + lunge * 0.3, KICKER.bodyRadius - 6);

    // aro de carga
    if (chargeRatio > 0) {
      const radius = KICKER.bodyRadius + 8;
      const start = -Math.PI / 2;
      g.lineStyle(6, 0x0b1220, 0.65);
      g.beginPath();
      g.arc(this.x, bodyY, radius, 0, Math.PI * 2, false);
      g.strokePath();
      g.lineStyle(6, heatColor(chargeRatio), 1);
      g.beginPath();
      g.arc(this.x, bodyY, radius, start, start + Math.PI * 2 * chargeRatio, false);
      g.strokePath();
    }

    // aro "solta ya": ventana en la que la patada todavia llega
    if (this.ready && this.lockout <= 0) {
      const pulse = 0.65 + Math.sin(this.pulse * 12) * 0.25;
      g.lineStyle(3, PALETTE.ready, pulse);
      g.beginPath();
      g.arc(this.x, bodyY, KICKER.bodyRadius + 7, 0, Math.PI * 2, false);
      g.strokePath();
      g.lineStyle(2, PALETTE.ready, pulse * 0.4);
      g.beginPath();
      g.arc(this.x, bodyY, KICKER.bodyRadius + 13, 0, Math.PI * 2, false);
      g.strokePath();
    }

    // flash de pateo al aire
    if (this.flash > 0) {
      g.lineStyle(3, PALETTE.danger, this.flash * 2);
      g.beginPath();
      g.arc(this.x, bodyY, KICKER.bodyRadius + 12, 0, Math.PI * 2, false);
      g.strokePath();
    }

    // candado de castigo
    if (this.lockout > 0) {
      g.fillStyle(PALETTE.danger, 0.25 * Math.min(1, this.lockout));
      g.fillCircle(this.x, bodyY, KICKER.bodyRadius + 10);
    }

    this.nameText.setPosition(this.x, this.lineY + this.facing * 46).setAlpha(this.flash > 0 ? 0.4 : 0.85);
  }

  destroy() {
    this.graphics.destroy();
    this.nameText.destroy();
  }
}