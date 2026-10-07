import { COMBO, MATCH, PHASES } from '../config.js';
import { EVENTS } from '../bus.js';

// Marcador, reloj, racha y fin de partido. Es la fuente de verdad del
// estado del juego; las escenas solo escuchan lo que pasa por el bus.
export default class MatchSystem {
  constructor(bus) {
    this.bus = bus;
    this.duration = MATCH.duration;
    this.reset();
  }

  reset() {
    this.score = { player: 0, ai: 0 };
    this.remaining = this.duration;
    this.phase = PHASES.countdown;
    this.countdownLeft = MATCH.countdown;
    this.phaseTimer = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.kicks = 0;
    this.perfectKicks = 0;
    this.whiffs = 0;
    this.goals = 0;
  }

  start() {
    this.reset();
    this.setPhase(PHASES.countdown);
    this.emit(EVENTS.matchStart, this.snapshot());
    this.emitScore();
    this.emitCombo();
    this.emit(EVENTS.timer, this.remaining);
  }

  setPhase(phase) {
    this.phase = phase;
    this.emit(EVENTS.phase, phase);
  }

  emit(event, payload) {
    this.bus.emit(event, payload);
  }

  update(dt) {
    if (this.phase === PHASES.countdown) {
      const before = Math.ceil(this.countdownLeft);
      this.countdownLeft -= dt;
      const after = Math.ceil(this.countdownLeft);
      if (after !== before && after >= 0) this.emit(EVENTS.countdown, after);
      if (this.countdownLeft <= 0) {
        this.setPhase(PHASES.playing);
        this.emit(EVENTS.countdown, -1);
      }
      return;
    }

    if (this.phase === PHASES.goal) {
      this.phaseTimer -= dt;
      if (this.phaseTimer <= 0) this.setPhase(PHASES.playing);
      return;
    }

    if (this.phase !== PHASES.playing) return;

    this.remaining = Math.max(0, this.remaining - dt);
    this.emit(EVENTS.timer, this.remaining);
    if (this.remaining <= 0) this.finish();
  }

  // Una pateada acertada sube la racha: la pelota sale mas rapida.
  registerKick(_kickerId, power) {
    this.kicks += 1;
    if (power >= 0.99) this.perfectKicks += 1;
    this.combo += 1;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    this.emitCombo();
    return this.combo;
  }

  registerWhiff() {
    this.whiffs += 1;
  }

  registerGoal(scorerId) {
    this.score[scorerId] += 1;
    this.goals += 1;
    if (COMBO.resetOnGoal) this.combo = 0;
    this.emitScore();
    this.emitCombo();
    this.emit(EVENTS.goal, { scorer: scorerId, score: { ...this.score } });
    this.phaseTimer = MATCH.goalPause;
    this.setPhase(PHASES.goal);
  }

  finish() {
    if (this.phase === PHASES.over) return;
    const winner =
      this.score.player === this.score.ai
        ? 'draw'
        : this.score.player > this.score.ai
          ? 'player'
          : 'ai';
    this.setPhase(PHASES.over);
    this.emit(EVENTS.matchOver, { ...this.snapshot(), winner });
  }

  get isPlayable() {
    return this.phase === PHASES.playing;
  }

  emitScore() {
    this.emit(EVENTS.score, { ...this.score });
  }

  emitCombo() {
    this.emit(EVENTS.combo, { combo: this.combo, max: this.maxCombo });
  }

  snapshot() {
    return {
      score: { ...this.score },
      remaining: this.remaining,
      combo: this.combo,
      maxCombo: this.maxCombo,
      kicks: this.kicks,
      perfectKicks: this.perfectKicks,
      whiffs: this.whiffs,
      goals: this.goals,
    };
  }
}