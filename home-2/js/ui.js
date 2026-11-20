/* v2.0 · interacción: entradas al hacer scroll, titulares que suben palabra por palabra, contadores, cabecera compacta,
   enlace activo del menú, pestañas del propósito y parallax suave de la portada. Sin librerías.
   Con «menos movimiento» del sistema (clase .quieto) no se anima nada. Los datos los pinta app.js. */
'use strict';
(() => {
  const $ = (q, r = document) => r.querySelector(q);
  const $$ = (q, r = document) => [...r.querySelectorAll(q)];
  const quieto = document.documentElement.classList.contains('quieto');

  // ---------- titulares: cada palabra en su caja, para que suba
  for (const t of $$('[data-split]')) {
    let i = 0;
    const parte = nodo => {
      for (const n of [...nodo.childNodes]) {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach(p => {
            if (!p) return;
            if (/^\s+$/.test(p)) { frag.append(' '); return; }
            const w = document.createElement('span'), s = document.createElement('span');
            w.className = 'w'; s.textContent = p; s.style.setProperty('--d', (i++ * 0.055).toFixed(3) + 's');
            w.append(s); frag.append(w);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1) parte(n);
      }
    };
    parte(t);
  }

  // ---------- retraso escalonado entre hermanos que entran juntos
  for (const el of $$('[data-r]')) {
    const hermanos = [...el.parentElement.children].filter(x => x.hasAttribute('data-r'));
    const k = hermanos.indexOf(el);
    if (k > 0) el.style.setProperty('--d', Math.min(k * 0.09, 0.45).toFixed(2) + 's');
  }

  // ---------- contadores
  const fmt = n => Math.round(n).toLocaleString('es-CO');
  function cuenta(el) {
    const txt = el.textContent.trim(), pre = txt.startsWith('$') ? '$' : '', fin = Number(txt.replace(/[^\d]/g, ''));
    if (!fin || quieto) return;
    const dura = 1500, t0 = performance.now();
    let escrito = pre + '0';
    el.textContent = escrito;
    const paso = t => {
      if (el.textContent !== escrito) return;        // app.js lo cambió mientras contaba: manda el dato
      const x = Math.min(1, (t - t0) / dura), e = 1 - Math.pow(2, -10 * x);
      escrito = pre + fmt(fin * (x === 1 ? 1 : e));
      el.textContent = escrito;
      if (x < 1) requestAnimationFrame(paso);
    };
    requestAnimationFrame(paso);
  }

  // ---------- entradas al hacer scroll
  const vistos = new IntersectionObserver(es => {
    for (const e of es) {
      if (!e.isIntersecting) continue;
      e.target.classList.add('visible');
      $$('[data-cuenta]', e.target).concat(e.target.matches('[data-cuenta]') ? [e.target] : []).forEach(c => { if (!c.__contado) { c.__contado = true; cuenta(c); } });
      vistos.unobserve(e.target);
    }
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
  $$('[data-r], [data-split]').forEach(el => vistos.observe(el));
  // las marcas amarillas que no están dentro de un titular animado
  $$('.marcador').forEach(m => { if (!m.closest('[data-split]')) vistos.observe(m); });

  // ---------- cabecera compacta y parallax
  const cab = $('#cab'), foto = $('.hero-img > img');
  let pend = false;
  function alScroll() {
    pend = false;
    cab.classList.toggle('scrolled', scrollY > 24);
    if (foto && !quieto) {
      const r = foto.parentElement.getBoundingClientRect();
      if (r.bottom > 0 && r.top < innerHeight) {
        const py = Math.max(-38, Math.min(38, (r.top - innerHeight * 0.25) * -0.09));
        foto.style.setProperty('--py', py.toFixed(1) + 'px');
      }
    }
  }
  addEventListener('scroll', () => { if (!pend) { pend = true; requestAnimationFrame(alScroll); } }, { passive: true });
  alScroll();

  // ---------- enlace activo del menú según la sección en pantalla
  const enlaces = new Map($$('#nav a[href^="#"]').map(a => [a.getAttribute('href').slice(1), a]));
  const secs = new IntersectionObserver(es => {
    for (const e of es) {
      const a = enlaces.get(e.target.id);
      if (a && e.isIntersecting) { enlaces.forEach(x => x.classList.remove('activo')); a.classList.add('activo'); }
    }
  }, { rootMargin: '-45% 0px -50% 0px' });
  enlaces.forEach((a, id) => { const s = document.getElementById(id); if (s) secs.observe(s); });

  // ---------- el proceso: el paso en pantalla se resalta, la foto fija cambia y la línea amarilla se llena al bajar
  const hitos = $$('.hito'), fotosP = $$('.proc-foto img'), riel = $('#riel'), linea = $('#linea');
  const NOMBRES = hitos.map(x => $('h3', x).textContent);
  function activa(n) {
    hitos.forEach(x => x.classList.toggle('activo', x.dataset.p === String(n)));
    fotosP.forEach(f => f.classList.toggle('on', f.dataset.p === String(n)));
    const pn = $('#proc-n'), pt = $('#proc-t');
    if (pn) pn.textContent = `Paso 0${n} de 0${hitos.length}`;
    if (pt) pt.textContent = NOMBRES[n - 1];
  }
  if (hitos.length) {
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) activa(+e.target.dataset.p); }), { rootMargin: '-42% 0px -48% 0px' });
    hitos.forEach(x => io.observe(x));
    const llena = () => {
      if (!linea || !riel) return;
      const r = linea.getBoundingClientRect(), p = (innerHeight * 0.55 - r.top) / Math.max(1, r.height);
      riel.style.setProperty('--p', Math.max(0, Math.min(1, p)).toFixed(3));
    };
    addEventListener('scroll', () => requestAnimationFrame(llena), { passive: true }); llena();
  }

  // ---------- la guía de licencias: un caso a la vez (flechas arriba y abajo del teclado)
  const casos = $$('.lic-casos [role="tab"]');
  const eligeCaso = t => casos.forEach(x => {
    const si = x === t; x.setAttribute('aria-selected', String(si)); x.tabIndex = si ? 0 : -1;
    document.getElementById(x.getAttribute('aria-controls')).hidden = !si;
  });
  casos.forEach((t, i) => {
    t.addEventListener('click', () => eligeCaso(t));
    t.addEventListener('keydown', e => {
      const d = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 0;
      if (!d) return;
      e.preventDefault(); const n = casos[(i + d + casos.length) % casos.length]; eligeCaso(n); n.focus();
    });
  });

  // ---------- pestañas del propósito (con flechas del teclado)
  const tabs = $$('.tabs [role="tab"]');
  const elige = t => {
    tabs.forEach(x => {
      const si = x === t;
      x.setAttribute('aria-selected', String(si)); x.tabIndex = si ? 0 : -1;
      document.getElementById(x.getAttribute('aria-controls')).hidden = !si;
    });
  };
  // (20-nov) rotan solas cada 6 s mientras se ven: la raya amarilla se llena como barra de tiempo; se pausan con el mouse o el foco
  const lista = $('.tabs'), caja = $('.prop-tabs');
  if (lista && !quieto) {
    new IntersectionObserver(es => es.forEach(e => lista.classList.toggle('corre', e.isIntersecting)), { threshold: 0.4 }).observe(lista);
    const pausa = si => lista.classList.toggle('pausa', si);
    caja.addEventListener('mouseenter', () => pausa(true)); caja.addEventListener('mouseleave', () => pausa(false));
    caja.addEventListener('focusin', () => pausa(true)); caja.addEventListener('focusout', () => pausa(false));
    tabs.forEach((t, i) => t.addEventListener('animationend', () => {
      if (t.getAttribute('aria-selected') === 'true') elige(tabs[(i + 1) % tabs.length]);
    }));
  }
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => elige(t));
    t.addEventListener('keydown', e => {
      const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (!d) return;
      e.preventDefault(); const n = tabs[(i + d + tabs.length) % tabs.length]; elige(n); n.focus();
    });
  });
})();
