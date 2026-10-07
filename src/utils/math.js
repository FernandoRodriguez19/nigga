export const clamp = (value, min, max) => (value < min ? min : value > max ? max : value);

export const lerp = (a, b, t) => a + (b - a) * t;

export const rad = (deg) => (deg * Math.PI) / 180;

export const randomRange = (min, max) => min + Math.random() * (max - min);

export const randomInt = (min, max) => Math.floor(randomRange(min, max + 1));

// Acerca `value` a `target` sin pasarse nunca. Se usa para mover a la IA.
export const approach = (value, target, maxDelta) => {
  if (value < target) return Math.min(value + maxDelta, target);
  if (value > target) return Math.max(value - maxDelta, target);
  return value;
};

export const formatClock = (seconds) => {
  const safe = Math.max(0, Math.ceil(seconds));
  const minutes = Math.floor(safe / 60);
  const rest = safe % 60;
  return `${minutes}:${String(rest).padStart(2, '0')}`;
};