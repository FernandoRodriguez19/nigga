// Simula partidos completos en Node (sin Phaser) para verificar la
// logica real: patadas, racha, velocidad, goles y fin de partido.
//
// Uso: node smoke/simulate.mjs [dificultad] [partidos] [segundos]
// Ej:  node smoke/simulate.mjs dificil 3 140

import { CANVAS, PITCH, KICK, BALL } from '../src/config.js';
import Ball from '../src/entities/Ball.js';
import Kicker from '../src/entities/Kicker.js';
import MatchSystem from '../src/systems/MatchSystem.js';
import MatchRunner from '../src/systems/MatchRunner.js';
import KickSystem from '../src/systems/KickSystem.js';
import { Emitter } from '../src/bus.js';

// Misma formula que usa el juego, para verificar los remates reales.
const probe = new KickSystem({ ball: null, match: null, bus: null, audio: null });
const velocityFor = (combo, power) => probe.resolveSpeed(power, combo);

// --- stub de escena: Ball y Kicker solo piden add.graphics / add.text ---
const stub = () =>
  new Proxy(function () {}, {
    get(_t, prop) {
      if (prop === 'width' || prop === 'height') return 100;
      if (prop === Symbol.toPrimitive || prop === 'then') return undefined;
      return stub();
    },
    set: () => true,
    apply: () => stub(),
  });
const scene = { add: { graphics: stub, text: stub, circle: stub, ellipse: stub } };
const noopAudio = new Proxy({}, { get: () => () => {} });

const level = process.argv[2] || 'normal';
const matches = Number(process.argv[3] || 3);
const seconds = Number(process.argv[4] || 140);
const FPS = 60;
const DT = 1 / FPS;

/** Robot que juega como humano: mantiene la carga y suelta con error. */
function makeBot(runner, { aimError = 22, missChance = 0.12 } = {}) {
  let swingLead = 0;
  let mistime = false;
  let lastVertical = 0;
  let released = true;

  return {
    axis: 0,
    step() {
      const { ball, player } = runner;

      const vertical = ball.vy > 0 ? 1 : ball.vy < 0 ? -1 : 0;
      if (vertical !== 0 && vertical !== lastVertical) {
        lastVertical = vertical;
        released = false;
        // Suelta con margen: el brazo dura KICK.swingTime, asi que hay que
        // soltarlo antes de que la pelota entre en la ventana.
        swingLead = KICK.swingTime * (0.3 + Math.random() * 0.35);
        mistime = Math.random() < missChance;
      }

      // Persigue la pelota con error humano de punteria.
      const aim = ball.x + (Math.random() - 0.5) * 2 * aimError;
      const delta = aim - player.x;
      this.axis = Math.abs(delta) < 4 ? 0 : Math.sign(delta);

      if (!runner.playable || player.isLocked) return;

      // Igual que una persona: deja el boton apretado y suelta una vez.
      if (!player.charging) runner.beginCharge();
      if (released) return;

      const state = runner.kick.evaluate(player);
      if (state.reason === 'receding' || state.canKick) return;

      const speed = Math.max(1, Math.abs(ball.vy));
      const distance = Math.abs(ball.distanceToLine(player.facing));
      const timeToWindow = Math.max(0, (distance - KICK.window) / speed);

      if (mistime && timeToWindow <= KICK.swingTime + 0.12) {
        mistime = false;
        released = true;
        runner.releaseCharge();
        return;
      }

      if (timeToWindow <= swingLead) {
        released = true;
        runner.releaseCharge();
      }
    },
  };
}

function runMatch(difficulty) {
  // Bus propio por partido para que los listeners no se acumulen.
  const bus = new Emitter();

  const stats = {
    goals: { player: 0, ai: 0 },
    kicks: 0,
    speedsOk: 0,
    whiffs: 0,
    speeds: [],
    maxCombo: 0,
    nan: false,
    outOfBounds: false,
    tunneled: false,
  };

  bus.on('kick', (e) => {
    stats.kicks += 1;
    stats.speeds.push(e.speed);
    if (Math.abs(velocityFor(e.combo, e.power) - e.speed) < 0.001) stats.speedsOk += 1;
  });
  bus.on('kick:whiff', () => {
    stats.whiffs += 1;
  });
  bus.on('goal', (e) => {
    stats.goals[e.scorer] += 1;
  });
  bus.on('match:combo', (e) => {
    stats.maxCombo = Math.max(stats.maxCombo, e.max);
  });

  const ball = new Ball(scene);
  const match = new MatchSystem(bus);
  const player = new Kicker(scene, {
    id: 'player',
    name: 'VOS',
    y: PITCH.bottom,
    facing: -1,
    accent: 0x2ee6a8,
    dark: 0x0f7d5c,
  });
  const rival = new Kicker(scene, {
    id: 'ai',
    name: 'IA',
    y: PITCH.top,
    facing: 1,
    accent: 0xff5d73,
    dark: 0x8c1f31,
  });

  let axis = 0;
  const runner = new MatchRunner({
    ball,
    match,
    player,
    rival,
    level: difficulty,
    getAxis: () => axis,
    bus,
    audio: noopAudio,
  });

  bus.on('match:phase', (phase) => runner.handlePhase(phase));

  runner.start();
  const bot = makeBot(runner);

  let elapsed = 0;
  while (elapsed < seconds && match.phase !== 'over') {
    bot.step();
    axis = bot.axis;
    runner.update(DT);
    elapsed += DT;

    const b = ball;
    if ([b.x, b.y, b.vx, b.vy, b.speed].some((n) => !Number.isFinite(n))) stats.nan = true;
    if (b.x < 0 || b.x > CANVAS.width) stats.outOfBounds = true;
    // La pelota nunca debe quedar dentro de la red sin evento de gol.
    if (b.y < PITCH.top - b.radius - 1 || b.y > PITCH.bottom + b.radius + 1) stats.tunneled = true;
  }

  return { stats, match, ball };
}

// --- corre varios partidos y agrega ---
const runs = Array.from({ length: matches }, () => runMatch(level));
const total = runs.reduce(
  (acc, { stats, match }) => {
    acc.goals.player += stats.goals.player;
    acc.goals.ai += stats.goals.ai;
    acc.kicks += stats.kicks;
    acc.speedsOk += stats.speedsOk;
    acc.whiffs += stats.whiffs;
    acc.maxCombo = Math.max(acc.maxCombo, stats.maxCombo);
    acc.speeds.push(...stats.speeds);
    acc.nan = acc.nan || stats.nan;
    acc.outOfBounds = acc.outOfBounds || stats.outOfBounds;
    acc.tunneled = acc.tunneled || stats.tunneled;
    acc.allFinished = acc.allFinished && match.phase === 'over';
    acc.minRemaining = Math.min(acc.minRemaining, match.remaining);
    return acc;
  },
  {
    goals: { player: 0, ai: 0 },
    kicks: 0,
    speedsOk: 0,
    whiffs: 0,
    maxCombo: 0,
    speeds: [],
    nan: false,
    outOfBounds: false,
    tunneled: false,
    allFinished: true,
    minRemaining: Infinity,
  },
);

const speeds = total.speeds;
const avg = (list) => (list.reduce((a, b) => a + b, 0) / list.length) || 0;

const checks = [];
const check = (label, pass, detail = '') => checks.push({ label, pass, detail });

check('sin NaN en la simulacion', !total.nan);
check('la pelota nunca sale del campo', !total.outOfBounds);
check('la pelota no atraviesa la linea de fondo', !total.tunneled);
check('hubo patadas', total.kicks > matches * 15, `${total.kicks} patadas`);
check('hay fallos por patear al aire', total.whiffs > 0, `${total.whiffs} fallos`);
check('hubo goles', total.goals.player + total.goals.ai > 0, `${total.goals.player}-${total.goals.ai}`);
check('la racha crecio', total.maxCombo >= 3, `max x${total.maxCombo}`);
check('la velocidad respeta el tope', speeds.every((s) => s <= BALL.maxSpeed), `max ${Math.round(Math.max(...speeds))}`);
check('la velocidad no baja del piso', speeds.every((s) => s >= BALL.speed), `min ${Math.round(Math.min(...speeds))}`);
check('todos los partidos terminan', total.allFinished);
check('el reloj llega a 0', total.minRemaining <= 0.01, `${total.minRemaining.toFixed(2)}s`);

// Invariante determinista: cada remate sale a la velocidad que le
// corresponde a su racha y a la potencia cargada.
check(
  'cada remate usa la velocidad de su racha',
  total.speedsOk === total.kicks,
  `${total.speedsOk}/${total.kicks} remates`,
);

// Y que la racha de verdad haga subir la velocidad.
const ladder = [1, 5, 15, 40].map((combo) => Math.round(velocityFor(combo, 1)));
check(
  'la racha acelera la pelota de forma monotona',
  ladder.every((v, i) => i === 0 || v > ladder[i - 1]),
  `${ladder.join(' < ')} px/s`,
);

console.log(`\n=== Simulacion ${level} · ${matches} partidos de ${seconds}s ===`);
console.log(
  `marcador ${total.goals.player}-${total.goals.ai} · patadas ${total.kicks} · fallos ${total.whiffs} · racha max x${total.maxCombo}`,
);
console.log(
  `velocidad: min ${Math.round(Math.min(...speeds))} · prom ${Math.round(avg(speeds))} · max ${Math.round(Math.max(...speeds))} px/s\n`,
);

let failed = 0;
checks.forEach(({ label, pass, detail }) => {
  if (!pass) failed += 1;
  console.log(`${pass ? 'OK  ' : 'FALLA'} ${label}${detail ? `  (${detail})` : ''}`);
});
console.log(failed === 0 ? '\nTodo OK\n' : `\n${failed} comprobaciones fallaron\n`);
process.exit(failed === 0 ? 0 : 1);