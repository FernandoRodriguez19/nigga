import Phaser from 'phaser';
import { DEFAULT_DIFFICULTY } from '../config.js';

// No hay assets que precargar (todo el arte es procedural), pero este
// lugar centraliza el arranque y genera las texturas que si se usan.
export default class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create() {
    this.createSparkTexture();

    this.registry.set('difficulty', DEFAULT_DIFFICULTY);
    this.registry.set('muted', false);

    this.scene.start('Menu');
  }

  // Textura blanca circular para las particulas del impacto.
  createSparkTexture() {
    if (this.textures.exists('spark')) return;
    const graphics = this.make.graphics({ x: 0, y: 0 }, false);
    graphics.fillStyle(0xffffff, 1);
    graphics.fillCircle(16, 16, 15);
    graphics.generateTexture('spark', 32, 32);
    graphics.destroy();
  }
}