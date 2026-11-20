/* Antes de pintar: marca que hay JS (las animaciones de entrada solo esconden el contenido si este archivo corrió)
   y respeta a quien pidió menos movimiento. */
document.documentElement.classList.add('js');
if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) document.documentElement.classList.add('quieto');
