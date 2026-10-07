# 05 — Bitácora de bugs

Ocho bugs encontrados, con cómo se detectaron y qué se aprendió.

---

## #1 — Pantalla negra al elegir dificultad ⭐ el grande

**Síntoma:** elegís la dificultad en el menú y la pantalla queda completamente
negra. El build compila, el dev server responde 200, los tests dan verde.

**Causa raíz:** `src/bus.js` — el `Emitter.on(event, handler, context)` aceptaba
el tercer argumento `context` pero **no lo usaba**:

```js
on(event, handler) {          // le faltaba el context en la firma
  this.listeners.get(event).push(handler);
}
emit(event, payload) {
  handlers.forEach((handler) => handler(payload));   // this === undefined
}
```

Las escenas se suscriben pasando contexto:

```js
bus.on(EVENTS.phase, this.handlePhase, this);
```

Cuando `GameScene.create()` llama a `this.runner.start()`, el `MatchSystem`
emite `match:phase` y `handlePhase` se invoca como función suelta. En un módulo
ES (modo estricto) `this` queda `undefined`, así que
`this.runner.handlePhase(phase)` tira `TypeError` **dentro de `create()`**.

**Por qué pantalla negra:** la creación de la escena aborta a mitad de camino.
No se dibuja la cancha, y el `cameras.main.fadeIn()` del final de `create()`
nunca se ejecuta, así que la cámara queda en su estado inicial negro. Además
`scene.launch('Hud')` tampoco corre, así que ni el HUD.

**Detección:** leer el código de `GameScene.create()` siguiendo el orden de las
llamadas. Después se agregaron dos defensas: `errorOverlay.js` y
`smoke/bus.mjs`.

**El fix:**

```js
on(event, handler, context) {
  this.listeners.get(event).push({ handler, context });
}
emit(event, payload) {
  handlers.slice().forEach((entry) => entry.handler.call(entry.context, payload));
}
```

`off` pasó a matchear por referencia de handler sobre el nuevo shape.

**Lección:** un parámetro de una API que se acepta pero se ignora es un bug
silencioso. Y sobre todo: **los tests de cabeza no lo detectaron porque los
smokes se suscribían con arrow functions**, que no dependen de `this`. Los tests
tenían que replicar la forma del código real, no una versión simplificada que se
le parece.

---

## #2 — La IA no cargaba nunca

**Síntoma:** la IA pataba siempre con potencia 0.35 (el mínimo), y en simulación
perdía 4-0 o incluso 13-0. obviousmente no era nivel, era un bug.

**Causa raíz:** `MatchRunner.update` solo actualizaba al rival durante las fases
**inactivas**:

```js
if (active) this.ai.update(dt);
else this.rival.update(dt, 0);
```

Durante la fase activa, la IA se movía y llamaba a `requestKick`, pero
**`Kicker.update()` nunca corría**, así que `charge` nunca subía: siempre quedaba
en el mínimo.

**Fix:** el rival se actualiza siempre, con eje 0 (la IA ya lo mueve por su
cuenta, la carga la acumula el `Kicker`):

```js
this.player.update(dt, active ? this.getAxis() : 0);
if (active) this.ai.update(dt);
this.rival.update(dt, 0);
```

**Efecto:** la potencia media de la IA pasó de 0.00 a 1.00, y el marcador se dio
vuelta por completo.

**Detección:** `smoke/diagnose.mjs` mostrando `potencia media 0.00` en la IA
mientras el humano marcaba 1.00. Un número absurdo en un campo que debería
estar lleno es un bug, no un ajuste de balance.

---

## #3 — El aro "listo" nunca se veía

**Síntoma:** el indicador de "estás a tiro" no aparecía nunca en pantalla.

**Causa raíz:** dos condiciones incompatibles. `MatchRunner` seteaba:

```js
kicker.ready = kicker.charging && this.kick.evaluate(kicker).canKick;
```

pero `Kicker.draw()` lo dibujaba solo si:

```js
if (this.ready && chargeRatio === 0 && this.lockout <= 0) {
```

`ready` exigía `charging === true` y el `draw` exigía `charge === 0`. **Nunca
podían cumplirse las dos.**

Además el significado estaba invertido: `ready` significaba "la pelota ya está
en la ventana", que es el momento donde ya no queda margen. Lo útil es
"soltar ahora todavía alcanza".

**Fix:** se cambió el significado a una pregunta real, con un método nuevo en
`KickSystem`:

```js
canStillReach(kicker) {
  if (state.canKick) return true;
  if (state.reason !== 'too-far') return false;
  return state.distance - KICK.window <= closing * timeLeftDelBrazo;
}
```

Y ahora se dibuja como un halo verde pulsante (`PALETTE.ready`), que funciona
incluso mientras cargás.

**Lección:** un booleano cuyo nombre no describe la pregunta que responde es un
bug esperando. Y cuando dos condiciones se contradicen, el síntoma es "no pasa
nunca", que es el más difícil de ver si no lo buscas.

---

## #4 — La IA fallaba sola por soltar en el límite

**Síntoma:** la IA perdía entre 2 y 7 patadas por partido.

**Causa raíz:** `AIController` sorteaba el momento de soltar así:

```js
this.swingLead = KICK.swingTime * randomRange(0.35, 0.95);
```

Con `swingTime = 0.3`, un `swingLead` de 0.95 significa soltar cuando faltan
0.285 s para que la pelota entre en la ventana. Si por un frame la pelota
entra un pelo más tarde, el brazo (0.3 s) vence **un frame antes** y la patada
se pierde. Probabilidad de fallo alta, sin margen.

**Fix:** se solta con margen real:

```js
this.swingLead = KICK.swingTime * randomRange(0.3, 0.7);
```

Mismo bug estaba en el bot de `smoke/simulate.mjs` (era `0.92..1.08`, o sea
peor: a veces más que el brazo entero) y se reprodujo el fix con margen
`0.3..0.65`.

**Lección:** cuando un personaje se calibra contra un sistema de brazo, nunca
sortees el lead cerca del límite. Sortealo en el medio del rango válido.

---

## #5 — Potencia 0.35 falso en los tests

**Síntoma:** el bot de simulación reportaba potencia media 0.35, siempre el
mínimo.

**Causa raíz:** el bot llamaba `releaseCharge()` en cada frame mientras la
condición se cumpliera. La primera llamada consumía la carga y ponía
`charging = false`, pero el bot volvía a cumplir la condición y volvía a soltar.
Con muchos intentos fallidos en una fila, la media de todos los kicks (fallidos
incluidos) quedaba en el mínimo.

**Fix:** un flag `released` por ataque, que se limpia cuando la pelota cambia de
sentido vertical:

```js
if (vertical !== 0 && vertical !== lastVertical) { released = false; }
if (released) return;   // una sola liberación por ataque
```

**Lección:** un personaje artificial que modela a un humano tiene que
**parecerse** al humano. Un bot que puede reintentar infinitamente no mide la
mecánica, mide una mecánica distinta.

---

## #6 — `MatchSystem` usaba el emitter equivocado

**Síntoma:** el marcador y el reloj no se actualizaban en el HUD.

**Causa raíz:** `MatchSystem` se construía sin recibir el bus y usaba su propio
`Emitter` interno, así que los eventos de `match:score` / `match:timer` nunca
llegaban al bus que escuchaba el HUD.

**Fix:** `MatchSystem(bus)` recibe el bus por constructor, igual que todos los
demás sistemas.

**Lección:** el mismo bug conceptual del #1: **inyección de dependencias**. Si un
sistema "no necesita" un collaborator externo, es porque lo está creando por su
cuenta, y eso rompe la cadena.

---

## #7 — Escalera de dificultades al revés

**Síntoma:** después de arreglar el bug de la IA, el balance quedó al revés: en
`facil` el humano perdía 7-13 y en `dificil` perdía 2-10 pero antes ganaba.

**Causa raíz:** dos problemas encadenados.

1. La IA con los parámetros nuevos (`whiffChance 0.16`, `aimError 22`) era
   demasiado precisa en `facil`.
2. `swingLead` viejo (bug #4) la hacía fallar en `dificil` y eso compensaba
   parcialmente.

Al arreglar el #4, la `facil` empezó a perder más.

**Fix:** se bajó la `facil` hasta que el humano ganara cómodo
(`moveSpeed 430`, `aimError 58`, `reaction 0.4`, `whiffChance 0.4`) y se ajustó
`normal` a un empate técnico.

**Detección:** los números de `smoke/simulate.mjs` con 8-10 partidos.

**Lección:** **calibrar un personaje artificial es la parte más difícil del
balance.** El bot de prueba es un humano simulado; si el bot es malo, los
números miden al bot. Y un cambio en un comportamiento (el timing de la IA)
puede invalidar todo un balance ya ajustado: hay que recalibrar de abajo.

---

## #8 — La pelota atravesaba el arco

**Síntoma:** a velocidad alta la pelota pasaba del otro lado de la línea de
fondo sin registrar gol ni poste.

**Causa raíz:** integración de Euler con paso variable. A 1500 px/s y 20 fps
(filas la máquina), la pelota avanza 75 px por frame, pero el arco tiene 12 px
de radio: el paso se saltaba la línea entera sin intersectarla.

**Fix:** `BallPhysics` integra en subpasos de 8 px (`BALL.maxSubstep`), y el
chequeo de patada se corre en cada subpaso vía `onSubstep`, no una vez por
frame.

**Lección:** nunca confíes en la detección de colisiones discretas a alta
velocidad. Subpasos siempre. Y si el chequeo de gameplay (patear) es un
"hitbox", tiene que ir en el mismo paso que la física, no aparte.

---

## Resumen

| # | Bug | Detección | Tipo |
|---|---|---|---|
| 1 | Pantalla negra por `context` del bus | leyendo `create()` | integración |
| 2 | IA con potencia 0.35 | `diagnose` mostraba 0.00 | lógica |
| 3 | Aro "listo" invisible | condiciones contradictorias | lógica |
| 4 | IA falla por soltar en el límite | conteo de fallos | calibración |
| 5 | Potencia 0.35 falsa en tests | media absurda | test artefacto |
| 6 | `MatchSystem` con emitter propio | HUD congelado | arquitectura |
| 7 | Dificultad al revés | agregados de simulación | balance |
| 8 | Pelota atraviesa el arco | visuales de alta velocidad | física |
