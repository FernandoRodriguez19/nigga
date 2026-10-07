# 06 — Balance y tuning

## Primero hacer los números medibles

Durante buena parte del proyecto las simulaciones dieron marcadores absurdos:
`normal 4-28`, `dificil 4-34`. No era dificultad, era el bug #2 (la IA con
potencia 0.35) y el bug #5 (potencia falsa en el bot de prueba).

**Solo con los bugs arreglados los números servían para hacer tuning.** Ese es
el orden correcto: primero que los números sean *medibles*, después ajustar.

## Herramienta de medición

`smoke/simulate.mjs` corre N partidos completos de 90 s con un bot y agrega:

```bash
node smoke/simulate.mjs facil 10 140
node smoke/diagnose.mjs normal 26 0.20    # un partido, con detalle de fallos
```

Criterio que se usó:

| Nivel | Objetivo | Resultado final |
|---|---|---|
| `facil` | el humano gana cómodo | **18-10** (10 partidos) |
| `normal` | prácticamente parejo | **7-6** (8 partidos) |
| `dificil` | la IA gana claramente | **2-10** (8 partidos) |

## Historial de cambios

### Ronda 1 — la IA no podía cargar (bug #2)

Se arregló `rival.update` y la potencia de la IA pasó de 0.00 a 1.00. El
marcador se dio vuelta. Primeros números medidos: `facil 5-7`, `normal 4-7`,
`dificil 4-4` — demasiado parejo en todos los niveles.

### Ronda 2 — abrirle a la IA un poco más

Se le subiéron `whiffChance` y `aimError` en `facil` y `normal` para que el humano
pudiera ganar:

| Nivel | aimError | reaction | whiffChance |
|---|---|---|---|
| `facil` | 46 | 0.34 | 0.30 |
| `normal` | 26 | 0.20 | 0.20 |

Resultado: `facil 10-8`, `normal 5-7`, `dificil 1-9`. Casi.

### Ronda 3 — el timing de la IA (bug #4)

Se arregló `swingLead` (de 0.35-0.95 a 0.3-0.7 del brazo). Efecto
colateral: **la IA mejoró en todos los niveles**, y `facil` volvió a perder
7-13.

### Ronda 4 — facil de verdad fácil

Se bajó la `facil` hasta que el humano ganara cómodo:

| Nivel | moveSpeed | aimError | reaction | whiffChance |
|---|---|---|---|---|
| `facil` | 430 | 58 | 0.40 | 0.40 |

Resultado final: `facil 18-10`, `normal 7-6`, `dificil 2-10`. Escala sana.

## Curva de velocidad

La racha se suavizó **antes** de calibrar las dificultades, porque una curva muy
empinada arruina cualquier ajuste posterior.

| Parámetro | Antes | Ahora | Por qué |
|---|---|---|---|
| `BALL.speed` | 440 | 400 | Menos brutal de entrada |
| `COMBO.step` | 0.09 | 0.045 | Con 9% llegaba al tope en ~14 pateadas: se jugaba al tope casi todo el partido |
| `powerFloor` | 0.92 | 0.95 | Una carga parcial ya tiene efecto |
| `powerGain` | 0.55 | 0.35 | El toque corto y la potencia full se parecen más |
| `KICK.swingTime` | 0.22 | 0.30 | Margen real para el timing |

Velocidades resultantes con carga completa (`speed = 400 × min(3.2, 1+0.045×racha) × 1.30`):

| Racha | Antes (step 0.09) | Ahora (step 0.045) |
|---|---|---|
| 1 | 627 | 543 |
| 5 | 876 | 637 |
| 15 | 1500 (tope) | 871 |
| 40 | tope (1500) | 1456 |
| tope | 1500 | 1500 (racha 42) |

Con `step 0.09` la racha llegaba al tope alrededor de la patada 15: en un partido
de 90 s con ~40 patadas, más de la mitad del partido se jugaba al tope, así que
la racha dejaba de importar a mitad de partido.

## Lecciones de tuning

### 1. No uses promedios como check

El check original era "la velocidad promedio tiene que subir con la racha". Es
un test que no detecta casi nada: un `NaN` en la velocidad de un remate
específico se diluye en el promedio, y un redondeo roto también.

Se reemplazó por **invariantes por evento**:

- cada remate real debe salir exactamente a `resolveSpeed(power, combo)`;
- la escalera de rachas `[1, 5, 15, 40]` debe ser estrictamente creciente.

Un check por evento es un test; un promedio es una observación.

### 2. Calibrá el bot antes de calibrar la dificultad

El bot de `simulate.mjs` modela a un humano. Si el bot suelta sin margen, falla
por motivos que un humano no fallaría, y los números miden al bot en vez de la
mecánica. Por eso el flag `released` y el `swingLead` con margen se arreglaron
antes de intentar cualquier ajuste de dificultad.

El indicador de calibración: **el bot debe tener 75-87% de acierto**, como un
jugador real. Con 60% de acierto, el bot es el problema, no el balance.

### 3. Un cambio de comportamiento invalida el balance

El bug #4 arregló un detalle chico (el margen del `swingLead`) y **deshizo**
todo el ajuste de dificultad de la ronda anterior. Un solo parámetro de timing
cambia la dificultad efectiva de la IA entera.

Regla: si tocás comportamiento, recalibrá desde `facil`.

### 4. Los fallos son información, no ruido

`kick:whiff` emite el motivo, y `diagnose` lo agrega. Eso convirtió "la IA
falla mucho" en mensajes accionables:

| Motivo | Qué dice sobre el balance |
|---|---|
| `too-far` | suelta antes de tiempo → problema de calibración del timing |
| `out-of-reach` | puntería mala → problema de `aimError` o `moveSpeed` |
| `receding` | suelta tarde, la pelota ya se iba → problema de anticipación |

Antes de agregar el motivo, los fallos eran un número y no había por dónde
empezar. Después, `too-far` apuntaba directo al `swingLead` y `receding` a la
anticipación de la IA.

### 5. 8 partidos por nivel no es mucho

Un partido de 90 s con ~40 patadas tiene ruido propio: un gol cambia un partido
entero. Con 8 partidos la diferencia entre `normal 5-7` y `normal 7-6` es ruido.

Para cambios chico, 10+ partidos. Para cambios grandes, re-calibrar desde cero.
Y siempre mirando los **patadas**, **fallos** y **racha máxima** además del
marcador: el marcador solo dice quién ganó, los otros tres dicen por qué.

## Estado actual y qué falta

Los números actuales están **bien calibrados contra el bot**, que es un modelo
de jugador decente pero no de un experto. Lo que falta es tu opinión real:

- ¿El ritmo se siente bien en 90 segundos?
- ¿Es viable llegar a `dificil` jugando bien?
- ¿La racha se siente gratificante o más como una muerte anunciada?

Si el juego te parece muy fácil o muy difícil, el primer número a tocar es
`whiffChance` de la dificultad, no la velocidad.
