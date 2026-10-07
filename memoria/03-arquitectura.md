# 03 — Arquitectura

## Principio de diseño

**La capa de reglas no sabe qué es Phaser.** Eso permite simular partidos
completos en Node, que es la base de toda la estrategia de testing.

```
┌─────────────────────────────────────────────┐
│ ESCENAS (Phaser)                            │
│  BootScene → MenuScene → GameScene + HudScene│
│  Solo dibujan, leen teclado yacency efectos   │
└────────────────┬────────────────────────────┘
                 │  MatchRunner (no sabe de Phaser)
┌────────────────▼────────────────────────────┐
│ REGLAS (headless, corre en Node)            │
│  MatchRunner  fases, reloj, orquestación    │
│  MatchSystem  marcador, reloj, racha, fases │
│  KickSystem   carga, ventana, remate, fallos│
│  BallPhysics  integración y colisiones      │
│  AIController puntería, reacción, timing     │
│  Ball / Kicker  estado + dibujo              │
└─────────────────────────────────────────────┘
```

## Mapa de archivos

| Archivo | Responsabilidad | Estado |
|---|---|---|
| `index.html` | página, estilos, `<div id="game">` | — |
| `src/main.js` | crea el `Phaser.Game`, registra escenas, instala el overlay de errores | — |
| `src/errorOverlay.js` | muestra un cartel rojo si algo crashea | — |
| `src/bus.js` | `Emitter`, `BusBinding`, `EVENTS`, el bus singleton | — |
| `src/config.js` | **todos** los números ajustables | — |
| `src/utils/math.js` | `clamp`, `lerp`, `rad`, `randomRange`, `approach`, `formatClock` | — |
| `src/utils/color.js` | `hexToRgb`, `rgbToHex`, `mixHex`, `hexToCss` | — |
| `src/entities/Ball.js` | estado de la pelota + dibujo, `place`, `serve`, `launch`, `normalize`, `deflect` | — |
| `src/entities/Kicker.js` | movimiento, carga, potencia, lockout, aro verde, dibujo | — |
| `src/entities/AIController.js` | un solo comportamiento de IA, 4 parámetros de dificultad | — |
| `src/systems/MatchRunner.js` | el partido entero: fases, saque, gol, hitstop, update | — |
| `src/systems/MatchSystem.js` | marcador, reloj, racha, estadísticas, fin | — |
| `src/systems/KickSystem.js` | `evaluate`, `canStillReach`, `swing`, `tick`, `check`, `fire`, `whiff`, `resolveSpeed` | — |
| `src/systems/BallPhysics.js` | integración con subpasos, laterales, postes, línea de fondo | — |
| `src/systems/InputSystem.js` | teclado → acciones, eje -1/0/1 | — |
| `src/systems/AudioSystem.js` | audio sintetizado con WebAudio, sin archivos | — |
| `src/views/PitchView.js` | decorado estático de la cancha | — |
| `src/scenes/BootScene.js` | genera la textura `spark`, setea difficulty/muted, va al menú | — |
| `src/scenes/MenuScene.js` | selección de dificultad, controles, título, pelota de adorno | — |
| `src/scenes/GameScene.js` | arma las piezas, traduce eventos en efectos, input, hitstop | — |
| `src/scenes/HudScene.js` | marcador, reloj, racha, barra de carga, banners, resultado | — |

## Escenas

| Escena | Cuándo | Qué hace al crearse |
|---|---|---|
| `Boot` | arranque | textura `spark`, `registry.set('difficulty', 'normal')`, `scene.start('Menu')` |
| `Menu` | siempre al inicio, y con `ESC` | fondo, título, 3 dificultades, controles, listener de teclado, fadeOut → `scene.start('Game')` |
| `Game` | al arrancar el partido | `PitchView`, `Ball`, 2 `Kicker`, `MatchSystem`, `InputSystem`, `MatchRunner`, `runner.start()`, `scene.launch('Hud')`, fadeIn |
| `Hud` | siempre junto a `Game` | panels, listeners del bus, resultado oculto |

`Hud` va en escena aparte para que el reinicio (`R`) no recargue la interfaz:
`restart()` hace `scene.stop('Hud')` y `scene.restart()` del Game, que vuelve a
lanzar el Hud.

## El bus

`src/bus.js` tiene tres piezas:

- **`Emitter`** — emisor propio. Guarda `{ handler, context }` y emite con
  `handler.call(context, payload)`. El `context` es lo que permite que
  `this.applyScore` funcione dentro de la escena. **Esto fue un bug crítico**
  (ver `05-bugs.md` #1).
- **`BusBinding`** — sugar para no repetir `bus.off(...)` a mano: guarda los pares
  `[event, handler]` y los saca en `destroy()`. El `HudScene` lo usa y lo
  destruye en su `SHUTDOWN`.
- **`EVENTS`** — los nombres de los eventos en un solo lugar.

**Patrón de suscripción:** las escenas pasan el `this` explícitamente:

```js
bus.on(EVENTS.kick, this.handleKick, this);
```

Si alguna vez agregás un handler, **no olvides el tercer argumento** o te va a
tirar `TypeError` en el primer evento.

**Patrón de limpieza:** en el `SHUTDOWN` de cada escena, desuscribir todo.

## Flujo de un gol

```
BallPhysics detecta la línea de fondo
  └─> MatchRunner.handleGoal('player')
        ├─> MatchSystem.registerGoal('player')
        │     ├─ score.player += 1
        │     ├─ combo = 0 (resetOnGoal)
        │     ├─> emit 'match:score'  ──> HudScene.applyScore  (marcador + pulse)
        │     ├─> emit 'match:combo'  ──> HudScene.applyCombo
        │     ├─> emit 'goal'          ──> HudScene.applyGoal   (banner GOL)
        │     └─ setPhase('goal')
        │           └─> emit 'match:phase' ──> GameScene.handlePhase
        ├─ audio.goal()
        ├─ hooks.onGoal() ──> flash de cámara
        └─ hitstop = 110 ms
```

## Inyección de dependencias

Los sistemas reciben lo que necesitan por constructor, nunca lo importan:

- `MatchSystem(bus)` — el bus entra por parámetro (bug corregido: antes usaba
  un emitter propio y nadie escuchaba nada).
- `MatchRunner({ ball, match, player, rival, level, getAxis, bus, audio, hooks })`
  — `getAxis` es la función que traduce teclado a movimiento, para que el runner
  no dependa de Phaser.
- `KickSystem({ ball, match, bus, audio, onFire })` — `onFire` es el hook que
  MatchRunner usa para el hitstop.
- `hooks.onGoal` — la escena se cuelga por acá en vez de que el runner sepa
  qué es una cámara de Phaser.

## Por qué existe `errorOverlay.js`

Phaser no tiene un evento global de error: si un `create()` o un `update()`
lanza una excepción, el canvas queda en negro y no hay ni una pista. `main.js`
llama a `installErrorOverlay()` antes de crear el juego; eso engancha
`window.addEventListener('error')` y `unhandledrejection` y pinta un cartel rojo
con el mensaje, el archivo y la línea.

Se agregó **después** de perder tiempo con la pantalla negra: convertir un fallo
mudo en un mensaje legible es la diferencia entre depurar en un minuto y en una
hora.

## Compatibilidad de los smokes

Los sistemas headless se instancian en Node con un stub de escena:

```js
const stub = () => new Proxy(function () {}, {
  get: (_t, prop) => {
    if (prop === 'width' || prop === 'height') return 100;
    if (prop === Symbol.toPrimitive || prop === 'then') return undefined;
    return stub();
  },
  set: () => true,
  apply: () => stub(),
});
const scene = { add: { graphics: stub, text: stub, circle: stub, ellipse: stub } };
```

`Ball` y `Kicker` solo piden `scene.add.graphics`, `scene.add.text`,
`scene.add.circle` y `scene.add.ellipse`; el proxy devuelve una función vacía
para cualquier otra cosa. El audio se falsea con
`new Proxy({}, { get: () => () => {} })`.
