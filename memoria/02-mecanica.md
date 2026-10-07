# 02 — Mecánica y números

Todos los valores viven en **`src/config.js`**. Si algo se siente mal, se toca
acá y no en las clases.

---

## CANCHA

| `CANVAS` | Valor |
|---|---|
| `width` | 640 |
| `height` | 1080 |

| `PITCH` | Valor | Significado |
|---|---|---|
| `top` | 60 | Línea de fondo de la IA (arriba) |
| `bottom` | 1020 | Tu línea de fondo (abajo) |
| `goalWidth` | 190 | Ancho del arco |
| `goalDepth` | 60 | Profundidad de la red (fuera de la línea) |
| `penaltyWidth` | 330 | Ancho del área grande |
| `penaltyDepth` | 150 | Altura del área grande |
| `goalAreaWidth` | 130 | Ancho del área chica |
| `goalAreaDepth` | 66 | Altura del área chica |
| `penaltySpot` | 96 | Distancia del punto penal |
| `centerCircle` | 72 | Radio del círculo central |

Derivados: `height = 960`, `middle = 540`, `centerX = 320`.

## PELOTA — `BALL`

| Parámetro | Valor | Qué hace |
|---|---|---|
| `radius` | 12 | Radio de la pelota (el arco se define con `PITCH.goalWidth`) |
| `speed` | 400 | Velocidad del saque y piso del remate |
| `maxSpeed` | 1500 | Tope duro de velocidad |
| `minHorizontalRatio` | 0.22 | Componente lateral mínima (evita rallies verticales aburridos) |
| `maxSubstep` | 8 | Px por subpaso de integración (evita atravesar el arco) |
| `postRestitution` | 0.92 | Rebote en travesaño/post |
| `maxAngleDeg` | 72 | Ángulo máximo fuera de la vertical |
| `trailLength` | 14 | Puntos de la estela |

## ARQUERO — `KICKER`

| Parámetro | Valor | Qué hace |
|---|---|---|
| `reach` | 92 | Medio ancho del cuerpo: alcance horizontal |
| `bodyRadius` | 27 | Radio del círculo del cuerpo |
| `moveSpeed` | 660 | Px/s de movimiento del humano |
| `chargeTime` | 0.7 | Segundos de carga de 0 a 1 de potencia |
| `minPower` | 0.35 | Potencia mínima: toque corto |
| `lockout` | 0.4 | Segundos de castigo por patear al aire |
| `maxSpreadDeg` | 55 | Dispersión horizontal según punto de contacto |

## PATADA — `KICK`

| Parámetro | Valor | Qué hace |
|---|---|---|
| `window` | 130 | Distancia a la línea dentro de la cual el tiro es válido |
| `swingTime` | 0.3 | Segundos que queda armada la patada al soltar |
| `launchDistance` | 138 | A qué distancia vuelve la pelota al patear |
| `hitstop` | 70 | Ms de congelado en el impacto |

## RACHA — `COMBO`

| Parámetro | Valor |
|---|---|
| `step` | 0.045 (4.5% por pateada) |
| `maxMultiplier` | 3.2 |
| `powerFloor` | 0.95 (potencia 0 → ×0.95) |
| `powerGain` | 0.35 (potencia 1 → ×1.30) |
| `resetOnGoal` | true |

## PARTIDO — `MATCH`

| Parámetro | Valor |
|---|---|
| `duration` | 90 segundos |
| `countdown` | 3 segundos |
| `goalPause` | 0.9 segundos |

## DIFICULTADES — `AI_LEVELS`

| Nivel | `moveSpeed` | `aimError` | `reaction` | `whiffChance` |
|---|---|---|---|---|
| `facil` | 430 | 58 | 0.40 | 0.40 |
| `normal` | 570 | 26 | 0.20 | 0.20 |
| `dificil` | 690 | 9 | 0.08 | 0.07 |

`DEFAULT_DIFFICULTY = 'normal'`.

---

## FÓRMULAS

### Velocidad del remate

```
multiplier = min(3.2, 1 + 0.045 × combo)
target     = 400 × multiplier
boosted    = target × (0.95 + 0.35 × power)
speed      = clamp(boosted, 400, 1500)
```

Nota: `combo` es el valor que devuelve `registerKick()`, que ya suma antes de
devolver, así que la **primera** patada de la racha usa `combo = 1`.

Velocidades reales medidas con `KickSystem.resolveSpeed()`:

| Racha | Potencia 1 | Potencia 0.5 | Potencia 0 |
|---|---|---|---|
| 0 (tras un gol) | 520 | 450 | 400 |
| 1 | 543 | 470 | 400 |
| 5 | 637 | 551 | 466 |
| 15 | 871 | 754 | 636 |
| 40 | 1456 | 1260 | 1064 |
| 42 | **1500** (tope) | 1300 | 1098 |

Con carga completa el tope de 1500 se toca en la **racha 42**; con potencia
media, en la racha 49+. Con potencia 0 la velocidad nunca baja de 400
(`powerFloor` + el `clamp` del piso).

### Dirección según punto de contacto

```
contact = clamp((ballX - kickerX) / reach, -1, 1) + random(-0.07, 0.07)
spread  = 55° en radianes
vx = sin(spread) × contact × speed
vy = facing × cos(spread) × speed
```

`facing` es `-1` para el jugador (mira arriba) y `+1` para la IA (mira abajo).

Interpretación: si pegás con el borde externo (`contact = +1`) sale bastante
abierto; con el interno, choca contra el otro lateral. El centro del cuerpo da
el remate más vertical. `maxSpreadDeg = 55` permite un ángulo muy abierto, así
que apuntar mal se nota mucho.

### Ciclo completo de una patada

1. **Cargar** — `Espacio` mantenido. `charge` sube de 0 a 1 en 0.7 s. El aro se
   va llenando de amarillo a rojo.
2. **Soltar** — `KickSystem.swing(kicker, power)` arma la patada por 0.3 s.
   Inmediatamente el poder sube a `power`.
3. **Acercarse** — la pelota entra en la ventana (130 px) y en el alcance
   horizontal (92 px) mientras se acerca.
4. **Sale** — `fire()` calcula velocidad y dirección, reposiciona la pelota a
   138 px de la línea, aplica hitstop de 70 ms, emite chispas y sonido.
5. **O se pierde** — si pasan los 0.3 s sin que entre en ventana: `whiff()`,
   flash rojo, lockout de 0.4 s, la racha no suma.

### Cuándo se enciende el aro verde

`KickSystem.canStillReach(kicker)`:

```
si está en la ventana y en alcance       → sí (tocá ahora)
si ya se aleja o está bloqueado          → no
si está lejos pero approaching:
    distance - window ≤ |vy| × tiempoRestanteDelBrazo  → sí
    (sin brazo armado, tiempoRestante = 0.3 s)
```

---

## EVENTOS DEL BUS — `EVENTS`

| Constante | String | Quién lo emite | Quién lo escucha |
|---|---|---|---|
| `matchStart` | `match:start` | `MatchSystem.start()` | nadie |
| `phase` | `match:phase` | `MatchSystem.setPhase()` | `GameScene.handlePhase` |
| `score` | `match:score` | `MatchSystem.emitScore()` | `HudScene.applyScore` |
| `timer` | `match:timer` | `MatchSystem.update()` | `HudScene.applyTimer` |
| `combo` | `match:combo` | `MatchSystem.emitCombo()` | `HudScene.applyCombo` |
| `matchOver` | `match:over` | `MatchSystem.finish()` | `HudScene.applyMatchOver` |
| `goal` | `goal` | `MatchSystem.registerGoal()` | `HudScene.applyGoal` |
| `kick` | `kick` | `KickSystem.fire()` | `GameScene.handleKick` |
| `whiff` | `kick:whiff` | `KickSystem.whiff()` | nadie (feedback va en el Kicker) |
| `post` | `ball:post` | — | nadie |
| `countdown` | `countdown` | `MatchSystem.update()` | `HudScene.applyCountdown` |
| `serve` | `serve` | `MatchRunner.serve()` | nadie |
| `power` | `kicker:power` | `GameScene.update()` | `HudScene.applyPower` |
