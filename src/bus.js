// Bus de eventos entre escenas (Game <-> Hud). Evita que las escenas se
// guarden referencias directas entre si.
//
// Emisor propio a proposito: la capa de reglas no debe depender de Phaser.
export class Emitter {
  constructor() {
    this.listeners = new Map();
  }

  // El context es opcional: sin el, el handler corre como arrow function
  // suelta. Con el, se invoca con handler.call(context, payload), que es lo
  // que necesitan los this.applyX de las escenas.
  on(event, handler, context) {
    if (!this.listeners.has(event)) this.listeners.set(event, []);
    this.listeners.get(event).push({ handler, context });
    return this;
  }

  off(event, handler) {
    const handlers = this.listeners.get(event);
    if (!handlers) return this;
    const index = handlers.findIndex((entry) => entry.handler === handler);
    if (index !== -1) handlers.splice(index, 1);
    return this;
  }

  emit(event, payload) {
    const handlers = this.listeners.get(event);
    if (!handlers) return this;
    // Copia: un handler puede desuscribirse durante el emit.
    handlers.slice().forEach((entry) => entry.handler.call(entry.context, payload));
    return this;
  }

  count(event) {
    return this.listeners.get(event)?.length ?? 0;
  }
}

export const bus = new Emitter();

export const EVENTS = {
  matchStart: 'match:start',
  phase: 'match:phase',
  score: 'match:score',
  timer: 'match:timer',
  combo: 'match:combo',
  matchOver: 'match:over',
  goal: 'goal',
  kick: 'kick',
  whiff: 'kick:whiff',
  post: 'ball:post',
  countdown: 'countdown',
  serve: 'serve',
  power: 'kicker:power',
};

// Sugar para no repetir bus.off(...) a mano en cada shutdown.
export class BusBinding {
  constructor(eventBus) {
    this.bus = eventBus;
    this.entries = [];
  }

  on(event, handler, context) {
    this.bus.on(event, handler, context);
    this.entries.push([event, handler]);
    return this;
  }

  destroy() {
    this.entries.forEach(([event, handler]) => this.bus.off(event, handler));
    this.entries = [];
  }
}