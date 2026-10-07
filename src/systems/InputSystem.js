// Traduce el teclado a acciones del juego. No sabe nada de reglas:
// solo reporta "mover", "empezar a cargar", "soltar" y teclas de menu.
export default class InputSystem {
  constructor(scene, handlers = {}) {
    this.scene = scene;
    this.handlers = handlers;
    const keyboard = scene.input.keyboard;

    this.keys = keyboard.addKeys('LEFT,RIGHT,UP,DOWN,A,D,SPACE,R,ESC,M,ENTER,ONE,TWO,THREE');

    keyboard.addCapture(['SPACE', 'LEFT', 'RIGHT', 'UP', 'DOWN', 'A', 'D']);

    keyboard.on('keydown-SPACE', () => this.handlers.onChargeStart?.());
    keyboard.on('keyup-SPACE', () => this.handlers.onChargeRelease?.());
    keyboard.on('keydown-R', () => this.handlers.onRestart?.());
    keyboard.on('keydown-ESC', () => this.handlers.onMenu?.());
    keyboard.on('keydown-M', () => this.handlers.onMute?.());
  }

  // -1, 0 o 1
  get axis() {
    const left = this.keys.LEFT.isDown || this.keys.A.isDown;
    const right = this.keys.RIGHT.isDown || this.keys.D.isDown;
    if (left && !right) return -1;
    if (right && !left) return 1;
    return 0;
  }
}