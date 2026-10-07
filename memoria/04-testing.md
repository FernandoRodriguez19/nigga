# 04 — Testing

Todo el testing es **headless**: corre en Node, sin navegador y sin Phaser.
Eso es posible porque la capa de reglas no importa Phaser (ver
`03-arquitectura.md`).

## Cómo correr

```bash
npm test              # las 5 suites: bus + stress + 3 dificultades

npm run test:bus      # solo la regresión del bus de eventos
npm run test:stress   # solo casos límite
npm run test:balance  # simulación de partidos (npm run test:balance -- facil 8 140)
npm run test:diagnose # estadísticas por jugador
```

O directo con node:

```bash
node smoke/bus.mjs
node smoke/stress.mjs
node smoke/simulate.mjs [dificultad] [partidos] [segundos]
node smoke/diagnose.mjs [dificultad] [errorPunteria] [probDespiste]
```

Ejemplos:

```bash
node smoke/simulate.mjs facil 8 140
node smoke/diagnose.mjs normal 26 0.20
```

Los tres scripts usan el mismo stub de escena que permite instanciar `Ball` y
`Kicker` fuera de Phaser.

---

## `smoke/bus.mjs` — regresión del bug de pantalla negra

**Este es el test más importante del proyecto.** Reconstruye el cableado real de
`GameScene` y `HudScene` (suscribiendo métodos con contexto) sobre un partido
real de `MatchRunner`, y verifica que nada reviente.

13 checks:

| Check | Qué garantiza |
|---|---|
| el context llega al handler | `handler.call(context)` funciona |
| funciona también sin context | las arrow functions de los otros smokes siguen válidas |
| off desuscribe y ya no llama | la limpieza en `teardown()` funciona |
| desuscribir en el emit es seguro | un handler puede darse de baja durante el recorrido |
| BusBinding pasa el context | los 8 handlers del HUD |
| BusBinding.destroy() limpia | el `SHUTDOWN` del HUD |
| el bus queda sin listeners | sin fugas entre partidas |
| arrancar el partido no tira | el error que mataba el navegador |
| los cambios de fase llegaron a la escena | `match:phase` |
| hubo patadas y llegaron a la escena | `kick` |
| el HUD recibió el reloj | `match:timer` |
| el HUD recibió la carga | `kicker:power` |
| todo desuscripto al terminar | limpieza final |

**Verificado que atrapa el bug real:** se reintrodujo el fallo a propósito
(`context: undefined`) y el test tira exactamente el `TypeError: Cannot set
properties of undefined` que dejaba la pantalla negra.

## `smoke/stress.mjs` — casos límite

15 checks en 6 escenarios:

1. **Framerate irregular** — `dt` entre 8 y 40 ms como una notebook floja.
   Verifica que no aparecen NaN y que la pelota no atraviesa el arco.
2. **Tope de velocidad** — una racha imposible no rompe nada; con combo 9999 la
   velocidad queda clavada en `BALL.maxSpeed`; nunca hay NaN.
3. **Patear al aire se castiga** — soltar lejos arma la patada pero no remata,
   termina en lockout, la racha no suma, el castigo dura lo configurado y no se
   puede cargar durante el lockout.
4. **Patada a destiempo se pierde** — armada pero la pelota no llega a tiempo.
5. **Con la pelota a tiro, el remate sale siempre** — 30 de 30, y siempre hacia
   arriba.
6. **La IA no puede patear desde el otro lado** — con la pelota alejándose no
   remata.

## `smoke/simulate.mjs` — partidos completos y balance

Juega N partidos completos de 90 s con un bot y agrega estadísticas. 13 checks:

| Check | Qué garantiza |
|---|---|
| sin NaN en la simulación | — |
| la pelota nunca sale del campo | clamp de laterales |
| la pelota no atraviesa la línea de fondo | subpasos |
| hubo patadas | la mecánica funciona |
| hay fallos por patear al aire | el castigo es alcanzable |
| hubo goles | el partido se puede ganar |
| la racha creció | la mecánica de racha anda |
| la velocidad respeta el tope | ≤ 1500 |
| la velocidad no baja del piso | ≥ 400 |
| todos los partidos terminan | la fase `over` se alcanza |
| el reloj llega a 0 | la duración es 90 s |
| **cada remate usa la velocidad de su racha** | invariante determinista |
| **la racha acelera de forma monótona** | escalera `[1, 5, 15, 40]` |

Los dos últimos son los que importan: comparan la velocidad de cada remate real
contra `KickSystem.resolveSpeed(power, combo)`, y verifican que la escalera de
rachas sea estrictamente creciente. Un promedio de velocidad no detecta ni un
`NaN` ni un redondeo roto; un invariante por evento sí.

**El bot de prueba** (`makeBot`) imita a una persona: mantiene el botón apretado
y suelta una sola vez por ataque (flag `released`), con `aimError` en la puntería
y `missChance` de timing.

## `smoke/diagnose.mjs` — estadísticas por jugador

Un partido, contando por separado las patadas, fallos, acierto y potencia media
de cada uno, y **por qué** falló cada patada.

```bash
node smoke/diagnose.mjs normal 26 0.20
```

```
marcador 1-0 · racha max x28
player  patadas 26 · fallos 4 · acierto 87% · potencia media 1.00 · fallos: too-far 4
ai      patadas 22 · fallos 7 · acierto 76% · potencia media 1.00 · fallos: receding 6 · out-of-reach 1
```

Motivos de fallo, los 4 que emite `KickSystem.whiff`:

| Motivo | Significado |
|---|---|
| `too-far` | soltó demasiado temprano: el brazo venció con la pelota lejos |
| `out-of-reach` | la pelota pasó pero no por donde estaba el arquero |
| `receding` | soltó mientras la pelota ya se alejaba |
| `locked` | seguía en lockout |

**Este script es el que destapó el bug de la IA:** mostraba `potencia media 0.00`
para la IA, cuando debería ser 1.00 (mantiene la carga hasta que suelta).

---

## La lección del testing

**El bug de la pantalla negra (`05-bugs.md` #1) sobrevivió a todas las suites
existentes.** ¿Por qué?

Todos los smokes se suscribían al bus con **arrow functions**:

```js
bus.on('match:phase', (phase) => runner.handlePhase(phase));   // no necesita this
```

Una arrow function no depende de `this`, así que el bug del `context` descartado
era invisible. Peor: las escenas reales nunca se ejecutaban en los tests, porque
requieren Phaser.

Dos reglas que salen de eso:

1. **Los tests tienen que replicar la forma del código real**, no una versión
   simplificada que se parece. `smoke/bus.mjs` existe precisamente para usar
   `bus.on(event, this.metodo, this)` como lo hacen las escenas.
2. **Un test que no puede fallar no sirve de nada.** Por eso el test del bus se
   validó reintroduciendo el bug a propósito.

## Limitación conocida

**No hay test de las escenas de Phaser.** `GameScene`, `HudScene` y `MenuScene`
no se ejecutan en ningún test: requieren el motor. Eso significa que un error de
integración entre escenas y sistemas solo se ve en el navegador.

Mitigaciones actuales:

- `errorOverlay.js` convierte cualquier crash en un mensaje legible en vez de
  una pantalla negra.
- La verificación de que los módulos cargan se hizo a mano contra el dev server
  (los 8 módulos dan 200).
- `smoke/bus.mjs` cubre la mitad del problema: la forma de suscribirse y el
  contrato del bus, que es donde estuvo el bug.

Si querés cerrar ese hueco de verdad, el camino sería correr Phaser en modo
`HEADLESS` bajo Node con un stub de DOM, o agregar Playwright. Es trabajo
considerable; hasta entonces, la validación del navegador es manual.
