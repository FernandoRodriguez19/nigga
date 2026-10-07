// Sin esto, una excepcion en cualquier create()/update() de Phaser deja el
// canvas en negro y no hay ni una pista de que paso. Este modulo pinta un
// cartel con el error real arriba de todo, para poder diagnosticarlo sin
// adivinar.
const MAX_MESSAGE = 600;

function show(title, details) {
  if (typeof document === 'undefined') return;

  const overlay = document.createElement('div');
  overlay.style.cssText = [
    'position:fixed',
    'inset:0',
    'z-index:9999',
    'display:flex',
    'align-items:center',
    'justify-content:center',
    'padding:24px',
    'background:rgba(7,11,20,0.94)',
    'font-family:"Segoe UI",Consolas,monospace',
    'color:#ff8080',
    'white-space:pre-wrap',
    'word-break:break-word',
    'cursor:text',
    'user-select:text',
  ].join(';');

  const box = document.createElement('div');
  box.style.cssText = [
    'max-width:900px',
    'max-height:100%',
    'overflow:auto',
    'border:2px solid #ff4d4d',
    'border-radius:10px',
    'padding:20px 24px',
    'background:#0d1526',
    'font-size:14px',
    'line-height:1.5',
  ].join(';');

  const heading = document.createElement('div');
  heading.textContent = title;
  heading.style.cssText = 'font-size:20px;font-weight:700;margin-bottom:12px;color:#ff4d4d';

  const body = document.createElement('div');
  body.textContent = String(details || 'Error desconocido').slice(0, MAX_MESSAGE);

  box.append(heading, body);
  overlay.append(box);
  document.body.append(overlay);
}

export function installErrorOverlay() {
  if (typeof window === 'undefined') return;
  window.addEventListener('error', (event) => {
    show(
      'Error en el juego',
      [event.message, event.filename, event.lineno && `linea ${event.lineno}`]
        .filter(Boolean)
        .join('\n'),
    );
  });
  window.addEventListener('unhandledrejection', (event) => {
    show('Promesa rechazada en el juego', event.reason?.stack || event.reason);
  });
}

export default installErrorOverlay;
