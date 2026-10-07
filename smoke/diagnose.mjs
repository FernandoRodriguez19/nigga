// Diagnostico: cuantas patadas y fallos hace cada uno, y por que.
// Uso: node smoke/diagnose.mjs [dificultad] [errorPunteria] [probDespiste]

import { PITCH, KICK } from '../src/config.js';
import Ball from '../src/entities/Ball.js';
import Kicker from '../src/entities/Kicker.js';
import MatchSystem from '../src/systems/MatchSystem.js';
import MatchRunner from '../src/systems/MatchRunner.js';
import { Emitter } from '../src/bus.js';

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
const aimErr = Number(process.argv[3] || 22);
const missRate = Number(process.argv[4] || 0.12);
const bus = new Emitter();

const tally = { player: { kicks: 0, whiffs: 0, power: [] }, ai: { kicks: 0, whiffs: 0, power: [] } };
const whiffReasons = {};

bus.on('kick', (e) => {
  tally[e.kickerId].kicks += 1;
  tally[e.kickerId].power.push(e.power);
});
bus.on('kick:whiff', (e) => {
  tally[e.kickerId].whiffs += 1;
  whiffReasons[e.kickerId] = whiffReasons[e.kickerId] || {};
  const reason = e.reason || 'timeout';
  whiffReasons[e.kickerId][reason] = (whiffReasons[e.kickerId][reason] || 0) + 1;
});

const ball = new Ball(scene);
const match = new MatchSystem(bus);
const player = new Kicker(scene, { id: 'player', name: 'VOS', y: PITCH.bottom, facing: -1, accent: 1, dark: 2 });
const rival = new Kicker(scene, { id: 'ai', name: 'IA', y: PITCH.top, facing: 1, accent: 3, dark: 4 });

let axis = 0;
const runner = new MatchRunner({
  ball, match, player, rival, level, getAxis: () => axis, bus, audio: noopAudio,
});

// El KickSystem avisa el motivo del fallo: 'receding' = se solto mientras
// la pelota ya se alejaba, 'too-far' = el brazo vencio con la pelota lejos,
// 'out-of-reach' = la pelota no pasaba por donde estaba el arquero.
bus.on('match:phase', (phase) => runner.handlePhase(phase));
runner.start();

let swingLead = 0;
let mistime = false;
let lastVertical = 0;
let released = true;

const DT = 1 / 60;
let elapsed = 0;

while (elapsed < 400 && match.phase !== 'over') {
  const vertical = ball.vy > 0 ? 1 : ball.vy < 0 ? -1 : 0;
  if (vertical !== 0 && vertical !== lastVertical) {
    lastVertical = vertical;
    released = false;
    swingLead = KICK.swingTime * (0.3 + Math.random() * 0.35);
    mistime = Math.random() < missRate;
  }

  const aim = ball.x + (Math.random() - 0.5) * 2 * aimErr;
  const delta = aim - player.x;
  axis = Math.abs(delta) < 4 ? 0 : Math.sign(delta);

  if (runner.playable && !player.isLocked) {
    if (!player.charging) runner.beginCharge();
    if (!released) {
      const state = runner.kick.evaluate(player);
      if (state.reason !== 'receding' && !state.canKick) {
        const speed = Math.max(1, Math.abs(ball.vy));
        const distance = Math.abs(ball.distanceToLine(player.facing));
        const t = Math.max(0, (distance - KICK.window) / speed);
        if (mistime && t <= KICK.swingTime + 0.12) {
          mistime = false;
          released = true;
          runner.releaseCharge();
        } else if (t <= swingLead) {
          released = true;
          runner.releaseCharge();
        }
      }
    }
  }

  runner.update(DT);
  elapsed += DT;
}

const avg = (l) => (l.length ? l.reduce((a, b) => a + b, 0) / l.length : 0);
console.log(`\n=== Diagnostico ${level} ===`);
console.log(`marcador ${match.score.player}-${match.score.ai} · racha max x${match.maxCombo}`);
['player', 'ai'].forEach((id) => {
  const t = tally[id];
  const attempts = t.kicks + t.whiffs;
  const rate = attempts ? ((t.kicks / attempts) * 100).toFixed(0) : '0';
  const reasons = Object.entries(whiffReasons[id] || {})
    .map(([r, n]) => `${r} ${n}`)
    .join(' · ');
  console.log(
    `${id.padEnd(7)} patadas ${String(t.kicks).padStart(4)} · fallos ${String(t.whiffs).padStart(4)} · acierto ${rate}% · potencia media ${avg(t.power).toFixed(2)}${reasons ? ` · fallos: ${reasons}` : ''}`,
  );
});
console.log('');