// Regresion del bug que dejaba la pantalla en negro.
//
// El Emitter propio aceptaba on(event, handler, context) pero descartaba el
// context, asi que this.applyX de HudScene y this.handlePhase de GameScene
// llegaban con this === undefined y tiraban TypeError dentro de create().
// La pantalla quedaba negra y los tests headless no lo veian porque se
// suscribian con arrow functions.
//
// Uso: node smoke/bus.mjs

import { PITCH } from '../src/config.js';
import Ball from '../src/entities/Ball.js';
import Kicker from '../src/entities/Kicker.js';
import MatchSystem from '../src/systems/MatchSystem.js';
import MatchRunner from '../src/systems/MatchRunner.js';
import { Emitter, BusBinding, EVENTS } from '../src/bus.js';

const checks = [];
const check = (label, pass, detail = '') => checks.push({ label, pass, detail });

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

// === 1. Contrato basico del Emitter ===
{
  const bus = new Emitter();
  const owner = {
    tag: 'owner',
    seen: null,
    handle(payload) {
      this.seen = payload;
    },
  };

  bus.on('evt', owner.handle, owner);
  bus.emit('evt', 42);
  check('el context llega al handler', owner.seen === 42, `this.seen = ${owner.seen}`);

  // Sin context sigue funcionando (arrow functions de los smokes).
  let arrow = 0;
  bus.on('evt', (payload) => {
    arrow += payload;
  });
  bus.emit('evt', 8);
  check('funciona tambien sin context', arrow === 8, `arrow = ${arrow}`);

  const beforeOff = owner.seen;
  bus.off('evt', owner.handle);
  bus.emit('evt', 1);
  check('off desuscribe y ya no llama', owner.seen === beforeOff, `this.seen = ${owner.seen}`);

  // Desuscribirse durante el emit no rompe el recorrido.
  const bus2 = new Emitter();
  const order = [];
  const first = () => {
    order.push('first');
    bus2.off('evt', second);
  };
  const second = () => order.push('second');
  bus2.on('evt', first);
  bus2.on('evt', second);
  bus2.emit('evt', null);
  bus2.emit('evt', null);
  check('desuscribir en el emit es seguro', order.join(',') === 'first,second,first', order.join(','));
}

// === 2. BusBinding reenvia el context ===
{
  const bus = new Emitter();
  const binding = new BusBinding(bus);
  const hud = {
    hits: 0,
    applyGoal() {
      this.hits += 1;
    },
  };

  binding.on(EVENTS.goal, hud.applyGoal, hud);
  bus.emit(EVENTS.goal, { scorer: 'player' });
  check('BusBinding pasa el context', hud.hits === 1, `hits = ${hud.hits}`);

  binding.destroy();
  bus.emit(EVENTS.goal, { scorer: 'ai' });
  check('BusBinding.destroy() limpia', hud.hits === 1, `hits = ${hud.hits}`);
  check('el bus queda sin listeners', bus.count(EVENTS.goal) === 0, `${bus.count(EVENTS.goal)}`);
}

// === 3. El escenario real: GameScene y HudScene suscribiendo por metodo ===
{
  const bus = new Emitter();
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
    level: 'normal',
    getAxis: () => axis,
    bus,
    audio: noopAudio,
  });

  // Esto es exactamente lo que hace GameScene.create() y HudScene.create().
  let phaseCalls = 0;
  let kickCalls = 0;
  const hudBinding = new BusBinding(bus);
  const fakeScene = {
    runner,
    handlePhase(phase) {
      // Si el context se pierde, esto tira y la escena muere en negro.
      phaseCalls += 1;
      this.runner.handlePhase(phase);
    },
    handleKick(event) {
      kickCalls += 1;
      this.spawnImpact(event);
    },
    spawnImpact() {
      return 'ok';
    },
    applyTimer(remaining) {
      this.timeLabel = remaining;
    },
    applyScore(payload) {
      this.score = payload;
    },
    applyPower(payload) {
      this.power = payload;
    },
  };
  fakeScene.timeLabel = 0;
  fakeScene.score = null;
  fakeScene.power = null;

  bus.on(EVENTS.kick, fakeScene.handleKick, fakeScene);
  bus.on(EVENTS.phase, fakeScene.handlePhase, fakeScene);
  hudBinding
    .on(EVENTS.timer, fakeScene.applyTimer, fakeScene)
    .on(EVENTS.score, fakeScene.applyScore, fakeScene)
    .on(EVENTS.power, fakeScene.applyPower, fakeScene);

  let error = null;
  let chargeHeld = false;
  try {
    runner.start();
    for (let i = 0; i < 60 * 20; i += 1) {
      // Un poco de input: mueve y mantiene la carga.
      axis = Math.sin(i / 40) > 0 ? 1 : -1;
      if (!player.charging) {
        runner.beginCharge();
        chargeHeld = true;
      } else if (chargeHeld) {
        runner.releaseCharge();
        chargeHeld = false;
      }
      runner.update(1 / 60);
      // Esto lo emite GameScene.update() en el navegador.
      bus.emit(EVENTS.power, {
        value: player.charging ? player.charge : 0,
        x: player.x,
        locked: player.isLocked,
      });
    }
  } catch (err) {
    error = err;
  }

  check('arrancar el partido no tira', error === null, error ? `${error.message}` : 'sin error');
  check('los cambios de fase llegaron a la escena', phaseCalls > 1, `${phaseCalls} fases`);
  check('hubo patadas y llegaron a la escena', kickCalls > 0, `${kickCalls} patadas`);
  check('el HUD recibio el reloj', typeof fakeScene.timeLabel === 'number', `${fakeScene.timeLabel}`);
  check('el HUD recibio la carga', fakeScene.power && typeof fakeScene.power.value === 'number');

  hudBinding.destroy();
  bus.off(EVENTS.kick, fakeScene.handleKick, fakeScene);
  bus.off(EVENTS.phase, fakeScene.handlePhase, fakeScene);
  check('todo desuscripto al terminar', bus.count(EVENTS.phase) === 0, `${bus.count(EVENTS.phase)}`);
}

console.log('\n=== Test del bus de eventos ===');
let failed = 0;
checks.forEach(({ label, pass, detail }) => {
  if (!pass) failed += 1;
  console.log(`${pass ? 'OK  ' : 'FALLA'} ${label}${detail ? `  (${detail})` : ''}`);
});
console.log(failed === 0 ? '\nTodo OK\n' : `\n${failed} comprobaciones fallaron\n`);
process.exit(failed === 0 ? 0 : 1);
