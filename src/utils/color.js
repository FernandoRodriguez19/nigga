import { clamp } from './math.js';

const toChannel = (value) => Math.round(clamp(value, 0, 255));

export const hexToRgb = (hex) => ({
  r: (hex >> 16) & 0xff,
  g: (hex >> 8) & 0xff,
  b: hex & 0xff,
});

export const rgbToHex = (r, g, b) =>
  (toChannel(r) << 16) | (toChannel(g) << 8) | toChannel(b);

export const mixHex = (from, to, t) => {
  const a = hexToRgb(from);
  const b = hexToRgb(to);
  const ratio = clamp(t, 0, 1);
  return rgbToHex(
    a.r + (b.r - a.r) * ratio,
    a.g + (b.g - a.g) * ratio,
    a.b + (b.b - a.b) * ratio,
  );
};

// Para Phaser.GameObjects.Text.setColor y estilos de texto.
export const hexToCss = (hex) => `#${(hex >>> 0).toString(16).padStart(6, '0').slice(-6)}`;