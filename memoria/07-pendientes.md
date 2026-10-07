# 07 — Pendientes

## Lo más importante: validar en el navegador

Todo el testing es headless y **las escenas de Phaser nunca se ejecutaron en un
test**. El juego se verificó con simulaciones de la lógica, checks de que los
módulos cargan, y el build. Falta que lo juegues.

Preguntas concretas para responderte:

| Pregunta | Cómo ajustarla |
|---|---|
| ¿El ritmo de 90 s se siente bien? | `MATCH.duration` |
| ¿Se puede jugar en `dificil` jugando bien? | `AI_LEVELS.dificil.whiffChance` y `aimError` |
| ¿La racha se siente gratificante? | `COMBO.step` y `COMBO.maxMultiplier` |
| ¿Es difícil entender cuándo soltar? | `KICK.swingTime` y la ayuda del aro verde |
| ¿Los fallos se sienten justos? | `KICKER.lockout` |
| ¿El remate se siente pesado o pegado? | `KICK.hitstop` |

**Si el juego se siente muy fácil o muy difícil, el primer número a tocar es
`whiffChance` de la dificultad**, no la velocidad. La velocidad afecta la
sensación; `whiffChance` afecta la dificultad.

## Bugs conocidos / pendientes técnicos

Ninguno bloqueante, pero anotados:

1. **El HUD no recibe los eventos iniciales.** `GameScene.create()` llama a
   `runner.start()` (que emite `match:start`, `match:score`, `match:combo`,
   `match:timer`) **antes** de `scene.launch('Hud')`. El HUD arranca con sus
   valores por defecto (`0`, `1:30`), que coinciden con el estado inicial, así
   que no se nota. Pero es frágil: si mañana el estado inicial cambia, el HUD
   va a mostrar valores viejos. La solución sería pasar los datos por `init()`.

2. **No hay tests de escenas de Phaser.** Es el hueco grande de la cobertura
   (ver `04-testing.md`). Cerrarlo requiere correr Phaser en modo `HEADLESS` bajo
   Node con un stub de DOM, o agregar Playwright.

3. **`EVENTS.whiff` y `EVENTS.post` no tienen consumidores.** Los eventos se
   emiten pero nadie los escucha; el feedback de esos casos va por otros caminos
   (el `Kicker` y el audio). Si alguna vez querés mostrar "FALLO" en el centro de
   la pantalla, el evento ya está listo.

4. **`npm install` reporta 2 vulnerabilidades** y un aviso `allow-scripts`
   (pnpm). Son de dependencias de desarrollo (Vite / esbuild). El build y el dev
   server funcionan bien. Si te importa, se puede hacer `npm audit` y ver de
   qué se trata.

5. **El bundle es de 1.48 MB** (351 KB gzip). Es Phaser completo. Si el tamaño
   importa, se puede cargar con `dynamic import` o usar `Phaser.HEADLESS` en
   builds sin render.

## Ideas de features (nunca implementadas)

Ordenadas por relación esfuerzo/beneficio:

- **Partido a mejor de 3** — reutiliza `MatchSystem` entero, es agregar un
  contador de rondas. Poco esfuerzo, mucho beneficio.
- **Selección de arquero / personaje** — todo el dibujo de `Kicker` es procedural
  y parametrizado por `accent`/`dark`. Agregar variantes es cambiar colores y
  formas en `draw()`.
- **Rebote de la pelota en las paredes con ángulo visible** — `Ball.deflect()`
  ya existe; falta un efecto visual del punto de rebote.
- **Power-ups de racha** (por ejemplo, cada 10 de racha, un tiro imparable) —
  `MatchSystem` ya lleva el conteo; falta el efecto.
- **Tocar la pantalla / mouse** — el juego es teclado puro. `InputSystem` podría
  leer el eje del mouse.
- **Estadísticas persistentes** entre partidas (partidos jugados, racha máxima
  histórica) — `registry` de Phaser o `localStorage`.

## Cosas que se probaron y se descartaron

Anotadas para no volver a intentarlo:

- **Rebote pasivo / collider en la línea de fondo.** Descartado por decisión de
  diseño: convertía el juego en tenis automático. Ver `01-decisiones.md` #1.
- **Ventana de tiro como rango fijo de distancia en vez de brazo de tiempo.**
  Descartado: a 1500 px/s el rango fijo es imposible de clavar, y el timing se
  volvía injusto en rachas altas. Ver `01-decisiones.md` #2.
- **Arco de 55° con el bot soltando en el límite del brazo.** causing fallos
  falsos. El margen tiene que estar en el medio del rango.
- **Check de balance por promedio de velocidad.** No detecta `NaN` ni redondeos
  rotos. Reemplazado por invariantes por evento. Ver `06-tuning.md`.
- **Usar el emitter de Phaser.** Rompería la capacidad de testear la lógica en
  Node. Ver `01-decisiones.md` #6.

## Cómo retomar el trabajo

1. Leé `README.md` (índice) y `01-decisiones.md` (por qué).
2. `02-mecanica.md` para los números: casi todo el tuning pasa por
   `src/config.js`.
3. Corré `npm test` para ver el estado.
4. Si tocás comportamiento de la IA, **recalibrá desde `facil`** y mirá los
   4 indicadores (marcador, patadas, fallos, racha máxima), no solo el marcador.
5. Si tocás el bus o las suscripciones, corré `npm run test:bus` — es el test
   que protege el bug que rompió todo.
