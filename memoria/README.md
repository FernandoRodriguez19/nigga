# Memoria del proyecto — Futbol Racha 1v1

Juego 1v1 de fútbol arcade vertical, al estilo Pong pero con patada cargada.
Hecho con **Phaser 3 + Vite + JavaScript** (sin TypeScript). Todo el arte es
procedural: no hay ni una imagen ni un archivo de audio en el repo.

Esta carpeta es la memoria del proyecto: decisiones, números, arquitectura,
testing, bugs y pendientes. Si estás retomando el trabajo sin contexto previo,
**leé `01-decisiones.md` primero** y después `02-mecanica.md`.

---

## Cómo arrancar

```bash
npm install      # una vez
npm run dev      # servidor de desarrollo
npm run build    # compila a dist/
npm run preview  # sirve dist/
```

Después abrí la URL que imprime Vite. Se juega con teclado.

## Controles

| Tecla | Acción |
|---|---|
| `←` `→` o `A` `D` | Moverse en tu línea |
| `Espacio` (mantener) | Cargar la patada |
| `Espacio` (soltar) | Patear — hay que hacerlo en el momento justo |
| `1` `2` `3` | Elegir dificultad en el menú |
| `Enter` | Arrancar |
| `R` | Reiniciar el partido |
| `ESC` | Volver al menú |
| `M` | Silenciar |

**La clave para entender el juego:** mantenés `Espacio` apretado y soltás cuando
se te enciende el **aro verde** alrededor de tu arquero. Ese aro significa
"soltar ahora todavía alcanza". Si soltás demasiado temprano, la patada se
arma pero se agota antes de que llegue la pelota: eso es un fallo y te deja
**castigado 0.4 s** sin poder cargar.

## Estado actual

- ✅ Partidos completos de 90 segundos con cuenta regresiva, pausa por gol,
  marcador, reloj, racha, resultado final y revancha.
- ✅ Tres dificultades calibradas: **fácil 18-10** (10 partidos), **normal 7-6**
  y **difícil 2-10** (8 partidos cada uno). Ver `06-tuning.md`.
- ✅ IA y humano con las mismas reglas, pasando por el mismo `KickSystem`.
- ✅ 5 suites de tests headless en verde (`npm test`).
- ✅ Build de producción limpio.
- ⏳ **Falta tu validación manual en el navegador**: cómo se siente, si el
  ritmo es divertido, si querés más features. Ver `07-pendientes.md`.

## Índice

| Archivo | Qué hay |
|---|---|
| [`01-decisiones.md`](01-decisiones.md) | El diseño y el porqué de cada decisión de fondo |
| [`02-mecanica.md`](02-mecanica.md) | Todos los números y fórmulas exactas |
| [`03-arquitectura.md`](03-arquitectura.md) | Mapa de archivos, flujo del bus |
| [`04-testing.md`](04-testing.md) | Los 4 scripts de `smoke/`, qué chequean y lecciones |
| [`05-bugs.md`](05-bugs.md) | Bitácora de los 8 bugs y cómo se detectaron |
| [`06-tuning.md`](06-tuning.md) | Historia del balance y resultados medidos |
| [`07-pendientes.md`](07-pendientes.md) | Lo que falta |

## Mapa rápido del proyecto

```
nigga/
├─ index.html              página + estilos
├─ package.json            scripts (dev, build, test, test:bus, ...)
├─ vite.config.js
├─ memoria/                esta carpeta
├─ smoke/                  tests headless (Node, sin navegador)
│  ├─ bus.mjs              regresión del bug de pantalla negra
│  ├─ stress.mjs           casos límite
│  ├─ simulate.mjs         partidos completos + balance
│  └─ diagnose.mjs         estadísticas por jugador
└─ src/
   ├─ main.js              config del juego Phaser
   ├─ bus.js               emisor de eventos propio
   ├─ errorOverlay.js      cartel de error si algo crashea
   ├─ config.js            TODOS los números ajustables
   ├─ entities/            Ball, Kicker, AIController
   ├─ systems/             MatchRunner, MatchSystem, KickSystem,
   │                       BallPhysics, InputSystem, AudioSystem
   ├─ scenes/              Boot, Menu, Game, Hud
   ├─ views/               PitchView (decorado de la cancha)
   └─ utils/               math, color
```

## Tips de la casa

- **Los comentarios del código están en español sin tildes ni ñ**, para evitar
  problemas de encoding en algunos editores. Los `.md` de esta carpeta sí
  llevan tildes; eso no es una contradicción, es a propósito.
- **La capa de reglas no importa Phaser.** `MatchRunner`, `KickSystem`,
  `MatchSystem`, `Ball` y `AIController` corren en Node sin adaptación: por eso
  los smokes pueden simular partidos enteros en el navegador ausente.
- **Si tocás un número, tocá `src/config.js`.** No hay números mágicos
  regados por el código. Así el tuning es un cambio de un solo lugar.
