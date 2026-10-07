import Phaser from 'phaser';
import { CANVAS, PITCH, PALETTE } from '../config.js';

// Dibuja una sola vez la cancha de futbol vertical: cesped, lineas,
// areas, circulo central, arcos y red. Es decorado estatico.
export default class PitchView {
  constructor(scene) {
    this.scene = scene;
    this.graphics = scene.add.graphics().setDepth(-10);
    this.draw();
  }

  draw() {
    this.drawGround();
    this.drawGoal(PITCH.top, 1);
    this.drawGoal(PITCH.bottom, -1);
    this.drawPitchSurface();
    this.drawMarkings();
    this.drawCrowdVignette();
  }

  drawGround() {
    const g = this.graphics;
    g.fillStyle(PALETTE.sky, 1).fillRect(0, 0, CANVAS.width, CANVAS.height);
  }

  drawGoal(lineY, direction) {
    const g = this.graphics;
    const half = PITCH.goalWidth / 2;
    const left = PITCH.centerX - half;
    const depth = PITCH.goalDepth;
    const outerY = direction > 0 ? lineY - depth : lineY + depth;

    // interior del arco
    g.fillStyle(0x0a1020, 1).fillRect(left, Math.min(lineY, outerY), PITCH.goalWidth, depth);

    // red
    const netColor = Phaser.Display.Color.ValueToColor(PALETTE.net).color;
    g.lineStyle(1, netColor, 0.28);
    for (let x = left; x <= left + PITCH.goalWidth; x += 11) {
      g.lineBetween(x, Math.min(lineY, outerY), x, Math.max(lineY, outerY));
    }
    for (let y = Math.min(lineY, outerY); y <= Math.max(lineY, outerY); y += 11) {
      g.lineBetween(left, y, left + PITCH.goalWidth, y);
    }

    // travesano y postes
    g.lineStyle(5, PALETTE.post, 1);
    g.lineBetween(left, outerY, left + PITCH.goalWidth, outerY);
    g.lineBetween(left, outerY, left, lineY);
    g.lineBetween(left + PITCH.goalWidth, outerY, left + PITCH.goalWidth, lineY);
  }

  drawPitchSurface() {
    const g = this.graphics;
    const bands = 12;
    const bandHeight = PITCH.height / bands;
    for (let i = 0; i < bands; i++) {
      g.fillStyle(i % 2 === 0 ? PALETTE.grassA : PALETTE.grassB, 1);
      g.fillRect(0, PITCH.top + i * bandHeight, CANVAS.width, bandHeight);
    }
  }

  drawMarkings() {
    const g = this.graphics;
    g.lineStyle(3, PALETTE.line, 0.92);

    // perimetro
    g.strokeRect(2, PITCH.top, CANVAS.width - 4, PITCH.height);

    // linea de medio campo
    g.lineBetween(2, PITCH.middle, CANVAS.width - 2, PITCH.middle);
    g.fillStyle(PALETTE.line, 0.92).fillCircle(PITCH.centerX, PITCH.middle, 4);
    g.strokeCircle(PITCH.centerX, PITCH.middle, PITCH.centerCircle);

    this.drawPenaltySide(PITCH.top, 1);
    this.drawPenaltySide(PITCH.bottom, -1);

    // arcos de esquina
    this.drawCornerArc(PITCH.top, 1);
    this.drawCornerArc(PITCH.bottom, -1);
  }

  drawPenaltySide(lineY, direction) {
    const g = this.graphics;
    const depth = PITCH.penaltyDepth * direction;
    const areaDepth = PITCH.goalAreaDepth * direction;
    const penaltyLeft = PITCH.centerX - PITCH.penaltyWidth / 2;
    const areaLeft = PITCH.centerX - PITCH.goalAreaWidth / 2;
    const spotY = lineY + PITCH.penaltySpot * direction;

    // area grande
    g.lineBetween(penaltyLeft, lineY, penaltyLeft, lineY + depth);
    g.lineBetween(penaltyLeft + PITCH.penaltyWidth, lineY, penaltyLeft + PITCH.penaltyWidth, lineY + depth);
    g.lineBetween(penaltyLeft, lineY + depth, penaltyLeft + PITCH.penaltyWidth, lineY + depth);

    // area pequena
    g.lineBetween(areaLeft, lineY, areaLeft, lineY + areaDepth);
    g.lineBetween(areaLeft + PITCH.goalAreaWidth, lineY, areaLeft + PITCH.goalAreaWidth, lineY + areaDepth);
    g.lineBetween(areaLeft, lineY + areaDepth, areaLeft + PITCH.goalAreaWidth, lineY + areaDepth);

    // punto penal
    g.fillStyle(PALETTE.line, 0.92).fillCircle(PITCH.centerX, spotY, 4);

    // media luna del area (solo la parte que cae dentro de la cancha)
    const radius = 74;
    const arcStart = direction > 0 ? Math.PI / 2 : -Math.PI / 2;
    const arcEnd = direction > 0 ? Math.PI * 1.5 : Math.PI * 0.5;
    g.beginPath();
    g.arc(PITCH.centerX, spotY, radius, arcStart, arcEnd, false);
    g.strokePath();

    // marca del area grande sobre el medio
    const bigSpotY = lineY + PITCH.penaltyDepth * direction;
    const half = PITCH.penaltyWidth / 2;
    const x0 = PITCH.centerX + (direction > 0 ? half : -half);
    const x1 = PITCH.centerX + (direction > 0 ? -half : half);
    g.lineBetween(x0, bigSpotY, x1, bigSpotY);
  }

  drawCornerArc(lineY, direction) {
    const g = this.graphics;
    const r = 22;
    const half = Math.PI / 2;
    // Los arcos se curvan hacia adentro de la cancha.
    const corners =
      direction > 0
        ? [
            { x: 2, y: lineY, from: 0, to: half },
            { x: CANVAS.width - 2, y: lineY, from: half, to: Math.PI },
          ]
        : [
            { x: 2, y: lineY, from: -half, to: 0 },
            { x: CANVAS.width - 2, y: lineY, from: Math.PI, to: Math.PI + half },
          ];
    corners.forEach(({ x, y, from, to }) => {
      g.beginPath();
      g.arc(x, y, r, from, to, false);
      g.strokePath();
    });
  }

  // Oscurece los bordes para que la atencion vaya a la pelota.
  drawCrowdVignette() {
    const g = this.graphics;
    const steps = 26;
    const band = 130;
    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      g.fillStyle(0x000000, 0.03 * (1 - t));
      g.fillRect(0, i * (band / steps), CANVAS.width, band / steps + 1);
      g.fillRect(0, CANVAS.height - (i + 1) * (band / steps), CANVAS.width, band / steps + 1);
      g.fillRect(i * (band / steps), 0, band / steps + 1, CANVAS.height);
      g.fillRect(CANVAS.width - (i + 1) * (band / steps), 0, band / steps + 1, CANVAS.height);
    }
  }
}