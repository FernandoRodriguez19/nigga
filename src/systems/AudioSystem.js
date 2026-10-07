// Audio sintetizado con WebAudio: no hay archivos de sonido en el repo.
// El contexto se crea en el primer toque/tecla porque los navegadores
// bloquean el audio hasta que el usuario interactua con la pagina.
class AudioSystem {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.master = null;
  }

  unlock() {
    if (!this.ctx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      this.ctx = new AudioContextClass();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.5;
    return this.muted;
  }

  // Un tono con envolvente. freq puede ser un numero o [from, to].
  tone({ freq = 440, type = 'sine', duration = 0.12, gain = 0.25, delay = 0, sweep = null }) {
    if (!this.ctx || this.muted) return;
    const start = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (sweep) osc.frequency.exponentialRampToValueAtTime(Math.max(20, sweep), start + duration);

    env.gain.setValueAtTime(0.0001, start);
    env.gain.exponentialRampToValueAtTime(gain, start + 0.012);
    env.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    osc.connect(env);
    env.connect(this.master);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  }

  // Un poco de ruido para el golpeo de la pelota.
  noise({ duration = 0.09, gain = 0.2, delay = 0 }) {
    if (!this.ctx || this.muted) return;
    const start = this.ctx.currentTime + delay;
    const frames = Math.floor(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, frames, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
    }
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    const env = this.ctx.createGain();
    env.gain.value = gain;
    source.connect(env);
    env.connect(this.master);
    source.start(start);
  }

  kick(power = 0.5, combo = 0) {
    this.noise({ duration: 0.07, gain: 0.14 + power * 0.14 });
    this.tone({
      freq: 180 + power * 120 + combo * 6,
      sweep: 70,
      type: 'square',
      duration: 0.1,
      gain: 0.1 + power * 0.1,
    });
  }

  whiff() {
    this.noise({ duration: 0.16, gain: 0.09 });
    this.tone({ freq: 320, sweep: 140, type: 'sawtooth', duration: 0.16, gain: 0.08 });
  }

  post() {
    this.tone({ freq: 900, sweep: 520, type: 'triangle', duration: 0.22, gain: 0.2 });
    this.tone({ freq: 1350, type: 'square', duration: 0.08, gain: 0.07 });
  }

  wall() {
    this.tone({ freq: 520, sweep: 380, type: 'triangle', duration: 0.05, gain: 0.06 });
  }

  goal() {
    this.tone({ freq: 523, type: 'square', duration: 0.12, gain: 0.16 });
    this.tone({ freq: 659, type: 'square', duration: 0.12, gain: 0.16, delay: 0.1 });
    this.tone({ freq: 784, type: 'square', duration: 0.3, gain: 0.18, delay: 0.2 });
    this.noise({ duration: 0.35, gain: 0.12, delay: 0.02 });
  }

  whistle() {
    this.tone({ freq: 2100, sweep: 2400, type: 'sine', duration: 0.35, gain: 0.1 });
  }

  countBeep(isGo) {
    this.tone({
      freq: isGo ? 880 : 520,
      type: 'square',
      duration: isGo ? 0.3 : 0.12,
      gain: 0.14,
    });
  }

  matchEnd(won) {
    const notes = won ? [523, 659, 784, 1046] : [523, 466, 392, 311];
    notes.forEach((freq, i) =>
      this.tone({ freq, type: 'triangle', duration: 0.28, gain: 0.16, delay: i * 0.16 }),
    );
  }
}

export const audio = new AudioSystem();
export default AudioSystem;