import Phaser from 'phaser';
import { CANVAS, PALETTE } from './config.js';
import BootScene from './scenes/BootScene.js';
import MenuScene from './scenes/MenuScene.js';
import GameScene from './scenes/GameScene.js';
import HudScene from './scenes/HudScene.js';
import { installErrorOverlay } from './errorOverlay.js';

installErrorOverlay();

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: CANVAS.width,
  height: CANVAS.height,
  backgroundColor: Phaser.Display.Color.ValueToColor(PALETTE.sky).rgba,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  render: {
    antialias: true,
    roundPixels: false,
    powerPreference: 'high-performance',
  },
  scene: [BootScene, MenuScene, GameScene, HudScene],
});

export default game;