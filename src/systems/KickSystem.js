import { BALL, COMBO, KICK, KICKER } from '../config.js';
import { clamp, randomRange, rad } from '../utils/math.js';

/**
 * La mecanica nueva: la pelota NO rebota sola contra un collider.
 * Hay que cargar la patada y soltarla.
 *
 * Al soltar no hace falta clavar el frame exacto: la patada queda
 * "armada" KICK.swingTime segundos. Si en ese rato la pelota entra en
 * la ventana de tiro y en el alcance del cuerpo, sale disparada. Asi el
 * timing es perdonable y no empeora cuando la pelota acelera.
 *
 * swing() es la unica puerta de entrada: la usan igual el jugador
 * humano y la IA, asi que las reglas son las mismas para los dos.
 */
export default class KickSystem {
  constructor({ ball, match, bus, audio, onFire }) {
    this.ball = ball;
    this.match = match;
    this.bus = bus;
    this.audio = audio;
    this.onFire = onFire;
    this.arms = new Map();
  }

  reset() {
    this.arms.clear();
  }

  // Estado de la pelota respecto de una linea defendida.
  evaluate(kicker) {
    const ball = this.ball;
    const approaching = kicker.facing < 0 ? ball.vy > 0 : ball.vy < 0;
    const distance = ball.distanceToLine(kicker.facing);
    const inWindow = approaching && distance <= KICK.window && distance > -ball.radius * 2;
    const inReach = Math.abs(ball.x - kicker.x) <= kicker.reach;
    const canKick = inWindow && inReach && !kicker.isLocked;

    let reason = 'kick';
    if (kicker.isLocked) reason = 'locked';
    else if (!approaching) reason = 'receding';
    else if (distance > KICK.window) reason = 'too-far';
    else if (!inReach) reason = 'out-of-reach';

    return { inWindow, inReach, canKick, distance, reason };
  }

  /**
   * ¿Soltar la patada AHORA todavia alcanzaria a la pelota?
   *
   * Es la senal que le sirve al jugador: con la pelota lejos todavia hay
   * tiempo, y cuando el margen se agota el aro se enciende. Si ya esta
   * dentro de la ventana, conectar igual conviene tirar.
   */
  canStillReach(kicker) {
    if (kicker.isLocked) return false;
    const state = this.evaluate(kicker);
    if (state.canKick) return true;
    if (state.reason !== 'too-far') return false;

    const arm = this.arms.get(kicker.id);
    const timeLeft = arm ? arm.time : KICK.swingTime;
    const closing = Math.max(1, Math.abs(this.ball.vy));
    return state.distance - KICK.window <= closing * timeLeft;
  }

  /** Cargar y soltar. Arma la patada; todavia no sale. */
swing(kicker, power) {
    if (kicker.isLocked) return null;
    this.arms.set(kicker.id, { power, time: KICK.swingTime });
    return power;
  }

  /**
   * Corre una vez por frame: descuenta el tiempo de las patadas armed,
   * dispara las que ya tienen la pelota a tiro y castiga las que se
   * quedaron sin tiempo.
   */
  tick(dt, kickers) {
    kickers.forEach((kicker) => {
      const arm = this.arms.get(kicker.id);
      if (!arm) return;

      const state = this.evaluate(kicker);
      if (state.canKick) {
        this.arms.delete(kicker.id);
        this.fire(kicker, arm.power);
        return;
      }

      arm.time -= dt;
      if (arm.time <= 0) {
        this.arms.delete(kicker.id);
        this.whiff(kicker, state.reason);
      }
    });
  }

  /**
   * Chequeo sin consumir tiempo, para que BallPhysics lo llame en cada
   * subpaso: a 1500 px/s la pelota puede cruzar la ventana entera entre
   * dos frames si la maquina va a 20 fps.
   */
  check(kickers) {
    kickers.forEach((kicker) => {
      const arm = this.arms.get(kicker.id);
      if (arm && this.evaluate(kicker).canKick) {
        this.arms.delete(kicker.id);
        this.fire(kicker, arm.power);
      }
    });
  }

  // Resolucion del remate: angulo segun el punto de contacto y velocidad
  // segun racha + potencia.
  fire(kicker, power) {
    const combo = this.match.registerKick(kicker.id, power);
    const contact = kicker.contactOffset(this.ball.x) + randomRange(-0.07, 0.07);
    const spread = rad(KICKER.maxSpreadDeg);
    const speed = this.resolveSpeed(power, combo);

    this.ball.launch(
      Math.sin(spread) * contact * speed,
      kicker.facing * Math.cos(spread) * speed,
      speed,
    );

    // La pelota rebota de la linea de fondo hacia el otro lado.
    this.ball.y = kicker.lineY + kicker.facing * KICK.launchDistance;

    kicker.onKick();
    kicker.ready = false;
    this.onFire?.(kicker, power);
    this.audio?.kick(power, combo);
    this.bus.emit('kick', {
      kickerId: kicker.id,
      power,
      combo,
      speed,
      contact: clamp(contact, -1, 1),
      x: this.ball.x,
      y: this.ball.y,
    });
  }

  whiff(kicker, reason = 'timeout') {
    kicker.onWhiff();
    this.match.registerWhiff();
    this.audio?.whiff();
    this.bus.emit('kick:whiff', { kickerId: kicker.id, reason });
  }

  // La velocidad depende de dos cosas: la racha acumulada y la potencia
  // que se cargo. Cada pateada sale mas rapida que la anterior.
  resolveSpeed(power, combo) {
    const multiplier = Math.min(COMBO.maxMultiplier, 1 + COMBO.step * combo);
    const target = BALL.speed * multiplier;
    const boosted = target * (COMBO.powerFloor + COMBO.powerGain * power);
    return clamp(boosted, BALL.speed, BALL.maxSpeed);
  }
}