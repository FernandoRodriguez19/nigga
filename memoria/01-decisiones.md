# 01 — Decisiones de diseño

Este archivo es el **"por qué"** del juego. Los números están en
`02-mecanica.md`; acá está la razón detrás de cada elección.

---

## 1. Nada de rebote pasivo: hay que cargar y soltar

La idea original "tipo Pong" sería un collider invisible en la línea de fondo y
que la pelota rebote sola. **Se descartó explícitamente** porque convertía el
juego en tenis automático: no había nada que hacer.

Ahora la pelota **no rebota contra nada**. Si llega a la línea de fondo sin que
nadie la patee, es gol. Para devolverla hay que mantener `Espacio` (0.7 s de
carga) y soltarlo en el momento justo.

Consecuencia de diseño: el juego es sobre **timing**, no sobre posición. La
puntería y el movimiento importan, pero lo que decide los partidos es cuándo
apretás.

**Consecuencia técnica:** no se usa Arcade Physics. Ver decisión 5.

## 2. La patada se "arma" en vez de pegarle al frame exacto

La primera versión exigía que la pelota estuviera exactamente en la ventana en
el frame exacto de la liberación. **Imposible de jugar**: la ventana dura ~0.14 s
y a 1500 px/s la pelota recorre 25 px por frame.

Al soltar, la patada queda **armada durante `KICK.swingTime` (0.3 s)**. Si en
ese rato la pelota entra en la ventana y en el alcance del cuerpo, sale.

Eso hace tres cosas:

- **El timing perdona:** hay ~0.3 s de tolerancia.
- **No empeora al acelerar:** el brazo dura *tiempo*, no *distancia*. Si la
  ventana fuera un rango fijo de píxeles, a 1500 px/s sería imposible; con un
  brazo de tiempo el margen en píxeles crece con la velocidad y el juego sigue
  siendo justo en rachas altas.
- **Se puede fallar de dos maneras** (soltar muy temprano → se agota; no soltar
  → gol en contra), y las dos tienen feedback claro.

**Costo:** sin señal visual, la mecánica es prueba y error. Ver decisión 8.

## 3. Humano e IA usan exactamente la misma API

Hay una sola puerta para patear: `KickSystem.swing(kicker, power)`. La usa igual
el humano (vía `MatchRunner.requestKick`) que la IA (vía `onKickRequest`).

- **Justicia:** la IA no puede hacer trampas. Si es injusta, el problema está en
  sus parámetros, no en un atajo en el código.
- **Testeable:** los smokes simulan partidos con cualquier bot y obtienen las
  mismas estadísticas que el navegador.
- **Menos código:** no hay dos implementaciones de "patear" que diverjan.

## 4. La racha acelera la pelota, no al jugador

Acumular pateadas hace que **la pelota salga más rápida**, no que el arquero se
mueva más rápido ni gane alcance.

Por qué: la velocidad de la pelota es el voltaje emocional. Una pateada que sale
a 1400 px/s se *siente* distinta a una de 400, aunque tengan el mismo resultado.
Y el jugador no tiene forma de "traducirla": a más velocidad, menos tiempo para
reaccionar, así que el castigo es real y medible.

- La racha **se resetea al hacer gol**, así no se acumula de un lado al otro del
  partido.
- Tope duro `×3.2` (1500 px/s): con racha infinita se clava ahí.

## 5. Física a mano en vez de Arcade Physics

A 1500 px/s la pelota recorre 25 px por frame y el collider del arco tiene 12 px
de radio. En una notebook floja a 20 fps la pelota **se saltaba el arco** y
metía goles fantasma.

`BallPhysics` integra a mano con **subpasos de 8 px** (`BALL.maxSubstep`): a
1500 px/s da ~3 subpasos por frame y nunca se pierde un choque. Además el
chequeo de patada corre en **cada subpaso** (`onSubstep`), no una vez por frame,
así una patada armada a 1500 px/s no se pierde entre frames.

Costo: hay que resolver a mano laterales, postes y línea de fondo. Son 88 líneas
en `BallPhysics.js`.

## 6. Emisor de eventos propio en vez de el de Phaser

`src/bus.js` tiene un `Emitter` propio (75 líneas con `BusBinding` incluido) en
vez de `Phaser.Events.EventEmitter`.

Motivo: **la capa de reglas no debe depender de Phaser**. Si `MatchSystem`
usara el emitter de Phaser, los smokes de Node no podrían correr partidos sin
mockear el motor entero. Con el emitter propio, `MatchRunner`, `MatchSystem`,
`KickSystem`, `Ball`, `Kicker` y `AIController` se instancian en Node sin tocar
una línea.

Esa separación es la que hace posible toda la suite de tests.

## 7. La capa de reglas es headless

`MatchRunner` es "el partido entero en una clase": fases, reloj, pelota,
patadas, IA y fin de partido. No sabe qué es Phaser ni qué es un canvas.

`GameScene` solo lo instancia, le pasa el teclado y traduce eventos en chispas,
sonido y hitstop. Por eso `smoke/simulate.mjs` juega 10 partidos de 90 s en Node
en un segundo.

## 8. El aro verde: hacer enseñable el timing

La mecánica perdona, pero sin señal visual es prueba y error. El aro verde
(`Kicker.ready`) significa literalmente **"soltar ahora todavía alcanza"**
(`KickSystem.canStillReach`).

Se enciende cuando, a la velocidad actual, la distancia hasta la ventana es
menor que lo que el brazo puede cubrir. Convierte el timing en algo visible y
hace obvia la diferencia entre soltar bien y mal.

**Bug relacionado:** el indicador existía pero nunca se veía (`05-bugs.md` #3).

## 9. Castigo por fallar, no por no hacer nada

Patear al aire (soltar con la pelota lejos) no es gratis:

- **0.4 s de lockout** sin poder cargar (`KICKER.lockout`).
- La racha **no** suma.
- Flash rojo + círculo de castigo sobre el arquero.
- La barra del HUD muestra "FALLO".

Esto crea la decisión interesante del juego: ¿suelto ahora que puedo, o espero
un frame más? Sin penalty, la estrategia óptima sería soltar siempre al primer
oportunidad. Con penalty, hay que calibrar.

## 10. Feedback de cada evento

| Evento | Visual | Audio | HUD |
|---|---|---|---|
| Gol | Flash de cámara + banner | Fanfarria de 3 notas | Marcador con pulse |
| Patada | Estela + 8 a 24 chispas | Golpe + tono con pitch según racha | Racha amarillo→rojo |
| Fallo | Flash rojo + lockout | Sonido de aire | "FALLO" en rojo |
| Falta | Aro verde encendido | — | — |
| Poste | Hitstop 45 ms | Tono agudo | — |
| Impacto | Hitstop 70 ms | — | — |

El **hitstop** (70 ms al patear) es clave para que un remate rápido se sienta
**pesado** y no como un cambio de posición instantáneo.

## 11. Dificultad = 4 parámetros, no comportamientos distintos

La IA tiene un solo comportamiento. La dificultad solo cambia cuánto lo calcula
bien:

| Parámetro | Qué simula |
|---|---|
| `moveSpeed` | Qué tan rápido llega a la posición correcta |
| `aimError` | Qué tan torpe apunta (px de error) |
| `reaction` | Retardo antes de reaccionar a un cambio de dirección |
| `whiffChance` | Probabilidad de calcular mal el momento de soltar |

No hay "IA difícil" con reglas distintas: hay la misma IA con 4 números más
agresivos. Si alguna vez se quiere una IA de otro estilo, se agrega un
comportamiento nuevo, no un parche.

## 12. Racha de escalones, no lineal

`COMBO.step` bajó de 0.09 a **0.045** (4.5% por pateada). Con 9% la pelota
llegaba a 1500 px/s en ~14 pateadas: en un partido de 90 s la mayor parte del
tiempo se jugaba al tope y el ritmo se volvía uniforme y frustrante. Con 4.5% la
aceleración se nota por etapas y da tiempo a adaptarse.

La potencia también se suavizó: `powerFloor 0.92 → 0.95` y `powerGain 0.55 →
0.35`. Así una carga parcial ya sirve, sin que la diferencia entre toque y
remate sea un abismo.
