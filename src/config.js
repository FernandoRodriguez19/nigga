// Todos los numeros ajustables del juego en un solo lugar.
// Si algo se siente mal, se toca aca y no en las clases.

export const CANVAS = {
  width: 640,
  height: 1080,
};

// Cancha vertical: el arco de la IA esta arriba (y = top) y el tuyo abajo (y = bottom).
// Los strip de goalDepth son la red, fuera de la linea de fondo.
export const PITCH = {
  top: 60,
  bottom: 1020,
  goalWidth: 190,
  goalDepth: 60,
  penaltyWidth: 330,
  penaltyDepth: 150,
  goalAreaWidth: 130,
  goalAreaDepth: 66,
  penaltySpot: 96,
  centerCircle: 72,
};

PITCH.height = PITCH.bottom - PITCH.top;
PITCH.middle = (PITCH.top + PITCH.bottom) / 2;
PITCH.centerX = CANVAS.width / 2;

export const BALL = {
  radius: 12,
  speed: 400, // velocidad del saque inicial
  maxSpeed: 1500,
  minHorizontalRatio: 0.22, // evita rallies verticales aburridos
  maxSubstep: 8, // px por subpaso, evita que la pelota atraviese el arco
  postRestitution: 0.92,
  maxAngleDeg: 72, // maximo que la pelota puede salir del vertical
  trailLength: 14,
};

export const KICKER = {
  reach: 92, // medio ancho del cuerpo: alcance horizontal
  bodyRadius: 27,
  moveSpeed: 660,
  chargeTime: 0.7, // segundos de carga de 0 a 1
  minPower: 0.35, // toque corto: potejada de baja potencia
  lockout: 0.4, // castigo por patear al aire (fail)
  maxSpreadDeg: 55, // dispersion horizontal segun punto de contacto
};

export const KICK = {
  window: 130, // distancia a la linea dentro de la cual el tiro es valido
  swingTime: 0.3, // s: cuanto queda armada la patada al soltar
  launchDistance: 138, // la pelota vuelve a esta distancia al patear
  hitstop: 70, // ms de congelado en el impacto
};

export const COMBO = {
  step: 0.045, // la velocidad objetivo crece 4.5% por pateada
  maxMultiplier: 3.2,
  powerFloor: 0.95, // potencia 0 => x0.95
  powerGain: 0.35, // potencia 1 => x1.30
  resetOnGoal: true,
};

export const MATCH = {
  duration: 90,
  countdown: 3,
  goalPause: 0.9,
};

export const PHASES = {
  countdown: 'countdown',
  playing: 'playing',
  goal: 'goal',
  over: 'over',
};

export const AI_LEVELS = {
  facil: {
    label: 'Facil',
    moveSpeed: 430,
    aimError: 58,
    reaction: 0.4,
    whiffChance: 0.4,
  },
  normal: {
    label: 'Normal',
    moveSpeed: 570,
    aimError: 26,
    reaction: 0.2,
    whiffChance: 0.2,
  },
  dificil: {
    label: 'Dificil',
    moveSpeed: 690,
    aimError: 9,
    reaction: 0.08,
    whiffChance: 0.07,
  },
};

export const DEFAULT_DIFFICULTY = 'normal';

export const PALETTE = {
  sky: 0x070b14,
  grassA: 0x2f7f36,
  grassB: 0x2a7131,
  line: 0xffffff,
  net: 0xcfd8e8,
  post: 0xf7f9fc,
  player: 0x2ee6a8,
  playerDark: 0x0f7d5c,
  ai: 0xff5d73,
  aiDark: 0x8c1f31,
  ball: 0xffffff,
  ballShade: 0xdfe6f2,
  charge: 0xffd23f,
  ready: 0x6ef2a0,
  danger: 0xff4d4d,
  text: 0xffffff,
  dim: 0x93a3c4,
  panel: 0x0d1526,
};

export const FONT = '"Segoe UI", "Arial Black", system-ui, sans-serif';