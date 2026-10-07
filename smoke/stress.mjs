// Casos limite: framerate irregular, tope de velocidad, castigo por
// patear al aire y kicking con la pelota alejandose.
// Uso: node smoke/stress.mjs

import { BALL, COMBO, KICK, KICKER, PITCH } from '../src/config.js';
import Ball from '../src/entities/Ball.js';
import Kicker from '../src/entities/Kicker.js';
import MatchSystem from '../src/systems/MatchSystem.js';
import MatchRunner from '../src/systems/MatchRunner.js';
import { bus } from '../src/bus.js';

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

const checks = [];
const check = (label, pass, detail = '') => checks.push({ label, pass, detail });

function build({ difficulty = 'normal' } = {}) {
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

  const runner = new MatchRunner({
    ball,
    match,
    player,
    rival,
    level: difficulty,
    getAxis: () => 0,
    bus,
    audio: noopAudio,
  });

  bus.on('match:phase', (phase) => runner.handlePhase(phase));
  runner.start();
  return { ball, match, player, rival, runner };
}

// --- 1. Framerate irregular: dt entre 8ms y 40ms, como una notebook floja ---
{
  const { ball, match, runner, player } = build();
  let nan = false;
  let tunnelled = false;
  let elapsed = 0;

  for (let frame = 0; frame < 4000; frame++) {
    const dt = 0.008 + Math.random() * 0.032;
    // Aproxima al humano: persigue la pelota y suelta con timing humano.
    const distance = Math.abs(ball.distanceToLine(player.facing));
    const speed = Math.max(1, Math.abs(ball.vy));
    const timeToWindow = Math.max(0, (distance - KICK.window) / speed);
    player.x = ball.x;
    if (runner.playable && !player.isLocked && distance < 400) {
      if (!player.charging) runner.beginCharge();
      if (timeToWindow <= KICK.swingTime * 0.8) runner.releaseCharge();
    }

    runner.update(dt);
    elapsed += dt;

    if ([ball.x, ball.y, ball.vx, ball.vy, ball.speed].some((n) => !Number.isFinite(n))) nan = true;
    if (ball.y < PITCH.top - ball.radius - 1 || ball.y > PITCH.bottom + ball.radius + 1) {
      tunnelled = true;
    }
    if (match.phase === 'over') break;
  }

  check('dt irregular: sin NaN', !nan, `${elapsed.toFixed(0)}s simulados`);
  check('dt irregular: la pelota no atraviesa el arco', !tunnelled);
}

// --- 2. Tope de velocidad: una racha imposible no rompe nada ---
{
  const { ball, match, runner } = build();
  const speeds = [];

  bus.on('kick', (e) => speeds.push(e.speed));

  for (let i = 0; i < 12; i++) {
    ball.place(PITCH.centerX, PITCH.middle);
    ball.launch(120, 1300, BALL.maxSpeed);
    speeds.push(runner.kick.resolveSpeed(1, match.registerKick('player', 1)));
  }

  check('el tope de velocidad se respeta', speeds.every((s) => s <= BALL.maxSpeed), `max ${Math.round(Math.max(...speeds))}`);
  check(
    'con racha infinita la velocidad queda clavada en el tope',
    runner.kick.resolveSpeed(1, 9999) === BALL.maxSpeed,
  );
  check('la velocidad nunca queda en NaN', speeds.every((s) => Number.isFinite(s)));
}

// --- 3. Patear al aire se castiga ---
{
  const { ball, match, runner, player } = build();
  match.phase = 'playing';
  ball.place(PITCH.centerX, PITCH.middle);
  ball.launch(0, 900, 900);

  runner.beginCharge();
  player.charge = 1;
  runner.releaseCharge();

  const armedImmediately = player.isLocked;

  // La patada queda armada KICK.swingTime y ahi se pierde.
  for (let i = 0; i < 20; i++) {
    runner.hitstop = 0;
    runner.update(1 / 60);
  }

  check('soltar con la pelota lejos arma una patada, no un remate', armedImmediately === false);
  check('soltar con la pelota lejos termina en fallo', player.isLocked, `lockout ${player.lockout.toFixed(2)}s`);
  check('el fallo no suma a la racha', match.combo === 0, `racha ${match.combo}`);
  check('el castigo dura lo configurado', player.lockout > 0 && player.lockout <= KICKER.lockout, `${player.lockout.toFixed(2)}s de ${KICKER.lockout}s`);
  check('no se puede cargar durante el castigo', runner.beginCharge() === false);
}

// --- 4. La patada armada se pierde si la pelota no llega a tiempo ---
{
  const { ball, match, runner, player } = build();
  match.phase = 'playing';
  ball.place(PITCH.centerX, PITCH.middle);
  ball.launch(0, 900, 900);
  player.x = ball.x;

  let kicked = false;
  const onKick = () => {
    kicked = true;
  };
  bus.on('kick', onKick);

  runner.beginCharge();
  player.charge = 0.8;
  runner.releaseCharge();

  // 20 frames = 333ms: la ventana dura ~0.14s, asi que la patada se agota.
  for (let i = 0; i < 20; i++) runner.update(1 / 60);

  bus.off('kick', onKick);
  check('una patada armada a destiempo se pierde', !kicked);
  check('y deja al jugador castigado', player.isLocked);
}

// --- 5. Con la pelota a tiro, la patada sale siempre ---
{
  const { ball, match, runner, player } = build();
  let fired = 0;
  bus.on('kick', () => {
    fired += 1;
  });

  for (let i = 0; i < 30; i++) {
    match.phase = 'playing';
    match.combo = 0;
    runner.hitstop = 0;
    ball.place(PITCH.centerX + (i % 2 ? 40 : -40), PITCH.bottom - 60);
    ball.launch(0, 700, 700);
    player.x = ball.x;
    player.lockout = 0;
    runner.beginCharge();
    player.charge = 1;
    runner.releaseCharge();
    runner.update(1 / 60);
    runner.hitstop = 0;
  }

  check('con la pelota a tiro y en alcance, el remate sale', fired === 30, `${fired}/30`);
  check('el remate manda la pelota hacia arriba', ball.vy < 0, `vy ${Math.round(ball.vy)}`);
}

// --- 6. La IA no puede patear desde el otro lado de la cancha ---
{
  const { ball, match, runner, rival } = build();
  match.phase = 'playing';
  rival.lockout = 0;
  // Pelota en la linea del jugador: la IA esta del lado contrario.
  ball.place(PITCH.centerX, PITCH.bottom - 40);
  ball.launch(0, -900, 900);
  rival.x = PITCH.centerX;

  let fired = 0;
  bus.on('kick', (e) => {
    if (e.kickerId === 'ai') fired += 1;
  });

  rival.startCharge();
  runner.requestKick(rival, 1);
  for (let i = 0; i < 10; i++) {
    runner.hitstop = 0;
    runner.update(1 / 60);
  }

  check('la IA no remata una pelota que se aleja', fired === 0);
}

let failed = 0;
console.log('\n=== Casos limite ===\n');
checks.forEach(({ label, pass, detail }) => {
  if (!pass) failed += 1;
  console.log(`${pass ? 'OK  ' : 'FALLA'} ${label}${detail ? `  (${detail})` : ''}`);
});
console.log(failed === 0 ? '\nTodo OK\n' : `\n${failed} comprobaciones fallaron\n`);
process.exit(failed === 0 ? 0 : 1);