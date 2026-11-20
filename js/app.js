/* Página pública del Plan de Recuperación Manizales.
   Lee datos/cifras.json (corte diario de la plataforma), datos/comunas.json (contornos) y datos/arp.json (asignaciones ARP,
   comercio y pasos). Si datos/arp.json trae «en_vivo» (la dirección de la función pública de cifras del servidor), la
   página la consulta al abrir y cada 5 minutos, y sus cifras reemplazan a las de los archivos.
   La página ya trae las cifras del último corte escritas en el HTML. Sin librerías: barras en HTML y mapa en SVG. */
'use strict';
(() => {
  const $ = (q, r = document) => r.querySelector(q);
  const $$ = (q, r = document) => [...r.querySelectorAll(q)];
  const SVG = 'http://www.w3.org/2000/svg';
  const fmt = n => Math.round(n).toLocaleString('es-CO');
  const pesos = n => '$' + fmt(n);
  const pct = (a, b) => b ? (100 * a / b).toLocaleString('es-CO', { maximumFractionDigits: 1 }) + ' %' : '—';
  const pctN = (a, b) => b ? 100 * a / b : 0;
  const num = v => typeof v === 'number' && isFinite(v);
  const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  function h(tag, at = {}, ...hijos) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(at)) { if (v == null || v === false) continue; if (k === 'class') e.className = v; else e.setAttribute(k, v === true ? '' : v); }
    for (const x of hijos.flat()) if (x != null && x !== false) e.append(x.nodeType ? x : String(x));
    return e;
  }
  const s = (tag, at = {}) => { const e = document.createElementNS(SVG, tag); for (const [k, v] of Object.entries(at)) e.setAttribute(k, v); return e; };
  const dato = (k, v) => $$(`[data-dato="${k}"]`).forEach(e => { e.textContent = v; });
  const barra = (frac, extra = '') => { const i = h('span'); i.style.width = Math.max(0, Math.min(100, frac * 100)).toFixed(1) + '%'; return h('div', { class: 'barra-c' + extra, 'aria-hidden': 'true' }, i); };

  // ---------- menú del celular
  const menu = $('#menu'), nav = $('#nav');
  const cierra = () => { nav.classList.remove('abierta'); menu.setAttribute('aria-expanded', 'false'); menu.setAttribute('aria-label', 'Abrir el menú'); };
  menu.addEventListener('click', () => {
    const ab = nav.classList.toggle('abierta');
    menu.setAttribute('aria-expanded', String(ab)); menu.setAttribute('aria-label', ab ? 'Cerrar el menú' : 'Abrir el menú');
  });
  $$('#nav a').forEach(a => a.addEventListener('click', cierra));
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && nav.classList.contains('abierta')) { cierra(); menu.focus(); } });

  // ---------- el globo del mapa
  const globo = $('#globo');
  function muestra(ev, titulo, linea) {
    globo.replaceChildren(h('b', {}, titulo), h('span', {}, linea)); globo.hidden = false;
    let x, y;
    if (ev.clientX != null && ev.type !== 'focus') { x = ev.clientX; y = ev.clientY; }
    else { const r = ev.target.getBoundingClientRect(); x = r.left + r.width / 2; y = r.top; }
    const w = globo.offsetWidth, hh = globo.offsetHeight;
    globo.style.left = Math.max(8, Math.min(innerWidth - w - 8, x + 14)) + 'px';
    globo.style.top = (y - hh - 12 < 8 ? y + 18 : y - hh - 12) + 'px';
  }
  const esconde = () => { globo.hidden = true; };
  addEventListener('scroll', esconde, { passive: true });

  // ---------- los tipos de afectación de la visita (19-nov: «afectación», no «daño»)
  const CAT = {
    sin_dano: { l: 'Sin afectación', arp: false },
    menor: { l: 'Afectación menor', arp: true },
    restringido: { l: 'Uso restringido', arp: true },
    mayor: { l: 'Afectación mayor', arp: true },
    colapso: { l: 'Colapso total', arp: false },
    seguro: { l: 'Lo repara el seguro', arp: false },
    sin_acceso: { l: 'Sin acceso al predio', arp: false },
  };
  const ORDEN = Object.keys(CAT);
  const PASOS = { visita: 'inmuebles visitados', valoracion: 'aportes valorados', socializados: 'ARP socializados', asignados: 'ARP asignados', entregados: 'aportes entregados' };

  let C = null, R = null, GEO = null, EN_VIVO = false;

  // ---------- las cifras generales
  function pinta() {
    const corte = new Date(EN_VIVO && R.corte ? R.corte : C.corte);
    dato('corte', corte.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Bogota' }) + ', ' +
      corte.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Bogota' }));
    dato('frecuencia', EN_VIVO ? 'en línea' : 'se actualizan cada día');
    const I = C.inmuebles, D = C.demoliciones;
    dato('total', fmt(I.total));
    dato('expedientes', fmt(D.expedientes)); dato('demolidas', fmt(D.demolidas)); dato('por_municipio', fmt(D.por_municipio)); dato('por_particular', fmt(D.por_particular));

    // predios afectados (registros de la Alcaldía)
    const niv = (C.afectados && C.afectados.niveles) || [];
    if (niv.length) {
      dato('predios_afectados', fmt(niv.reduce((a, n) => a + n[1], 0)));
      dato('niveles', niv.map((n, i) => (i ? n[0].replace(/^Impacto /, '') : n[0]) + ' ' + fmt(n[1])).join(' · '));
    }
    const A = R.afectados || {};
    if (num(A.comercios)) dato('comercios_afectados', fmt(A.comercios));
    if (num(A.predios)) dato('predios_afectados', fmt(A.predios));

    // las asignaciones ARP: edificaciones, comercio y total
    const S = R.asignaciones || {}, ed = S.edificaciones || {}, co = S.comercio || {};
    if (num(ed.n) && num(co.n)) {
      dato('asig_edif_n', fmt(ed.n)); dato('asig_edif_valor', pesos(ed.valor));
      dato('asig_com_n', fmt(co.n)); dato('asig_com_valor', pesos(co.valor));
      dato('asig_total_n', fmt(ed.n + co.n)); dato('asig_total_valor', pesos(ed.valor + co.valor));
    }

    // las cifras de cada paso: aparecen solo cuando se publican (con resolución entregada)
    const P = R.pasos || {};
    $$('[data-paso]').forEach(e => {
      const v = P[e.dataset.paso], n = num(v) ? v : v && num(v.n) ? v.n : null;
      e.hidden = n == null;
      if (n != null) { $('b', e).textContent = fmt(n); $('span', e).textContent = (v && v.txt) || PASOS[e.dataset.paso]; }
    });

    // las fases de la demolición (la tarjeta está oculta por ahora)
    if (D.fases && D.fases.length) {
      const mf = Math.max(1, ...D.fases.map(f => f.n));
      $('#fases').replaceChildren(...D.fases.map(f => h('li', {}, h('span', { class: 'f-n' }, fmt(f.n)), h('span', { class: 'f-l' }, f.l),
        (() => { const b = h('span'); b.style.width = (100 * f.n / mf).toFixed(1) + '%'; return h('span', { class: 'f-barra', 'aria-hidden': 'true' }, b); })())));
    }
  }

  // ---------- el mapa de comunas: capas ARP Reparación y ARP Comercio
  let CAPA = 'rep', SEL = null;
  const MIN_N = 20;   // con menos inmuebles una proporción no dice mucho: la comuna va rayada
  const RAMPA = ['--r1', '--r2', '--r3', '--r4', '--r5'];
  const extra = c => (R.comunas || {})[String(c.num)] || {};
  const rep = c => extra(c).rep || null;
  const com = c => extra(c).com || null;
  const hayCom = () => (C.comunas || []).some(c => com(c) && num(com(c).n));
  const hayRep = () => (C.comunas || []).some(c => rep(c) && num(rep(c).n));
  const valorDe = c => CAPA === 'rep' ? pctN(c.arp, c.inmuebles) : (com(c) && num(com(c).n) ? com(c).n : 0);
  const sinDato = c => CAPA === 'rep' ? c.inmuebles < MIN_N : !hayCom();
  function textoDe(c) {
    if (CAPA === 'rep') return c.inmuebles < MIN_N ? `Solo ${fmt(c.inmuebles)} inmuebles visitados` : `${pct(c.arp, c.inmuebles)} requieren ARP (${fmt(c.arp)} de ${fmt(c.inmuebles)})`;
    const k = com(c); return k && num(k.n) ? `${fmt(k.n)} comercios con ARP · ${pesos(k.valor || 0)}` : 'Detalle por comuna en consolidación';
  }
  function cortes(vals) {
    const v = [...vals].sort((a, b) => a - b), q = [1, 2, 3, 4].map(i => v[Math.min(v.length - 1, Math.floor(i * v.length / 5))]);
    return q.filter((x, i) => i === 0 || x > q[i - 1]);
  }
  function armaMapa() {
    // los contornos vienen con la y hacia arriba (negativa): el lienzo va de -h a 0 y los rótulos van en -y
    const g = s('svg', { viewBox: `-4 ${-GEO.h - 4} ${GEO.w + 8} ${GEO.h + 8}` });
    const defs = s('defs'), pat = s('pattern', { id: 'rayas', width: '6', height: '6', patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' });
    pat.append(s('rect', { width: '6', height: '6', fill: '#f3f5f8' }), s('rect', { width: '3', height: '6', fill: '#cfd6e0' })); defs.append(pat); g.append(defs);
    const capaP = s('g'), capaR = s('g', { 'aria-hidden': 'true' });
    for (const z of GEO.comunas) {
      const p = s('path', { d: z.d, tabindex: '0', role: 'button', 'data-c': z.clave });
      p.addEventListener('click', () => elige(z.clave));
      p.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); elige(z.clave); } });
      p.addEventListener('pointermove', e => muestra(e, `Comuna ${p.__c.num} · ${p.__c.nombre}`, textoDe(p.__c)));
      p.addEventListener('pointerleave', esconde);
      p.addEventListener('focus', e => muestra(e, `Comuna ${p.__c.num} · ${p.__c.nombre}`, textoDe(p.__c)));
      p.addEventListener('blur', esconde);
      capaP.append(p);
      const t = s('text', { x: z.x, y: -z.y, 'text-anchor': 'middle', 'dominant-baseline': 'central', class: 'rot', 'data-c': z.clave }); t.textContent = +z.clave.slice(0, 2); capaR.append(t);
    }
    g.append(capaP, capaR); $('#mapa').replaceChildren(g); rotulos();
    $$('#metricas button').forEach(b => b.addEventListener('click', () => {
      CAPA = b.dataset.m; $$('#metricas button').forEach(x => x.setAttribute('aria-pressed', String(x === b))); colorea(); elige(SEL);
    }));
  }
  function pintaComunas() {
    const porClave = Object.fromEntries(C.comunas.map(c => [c.clave, c]));
    $$('#mapa path').forEach(p => {
      const k = p.dataset.c;
      p.__c = porClave[k] || { clave: k, num: +k.slice(0, 2), nombre: k.slice(5), inmuebles: 0, no_habitables: 0, arp: 0, cats: {} };
    });
    colorea();
    elige(SEL || [...C.comunas].sort((a, b) => b.arp - a.arp)[0].clave);
    tabla();
  }
  function colorea() {
    const ps = $$('#mapa path'), validas = ps.map(p => p.__c).filter(c => !sinDato(c));
    const br = cortes(validas.map(valorDe)), clase = v => br.filter(b => v >= b).length;
    const cols = RAMPA.slice(5 - (br.length + 1));
    for (const p of ps) {
      const c = p.__c, pocos = sinDato(c), k = clase(valorDe(c));
      p.setAttribute('fill', pocos ? 'url(#rayas)' : css(cols[k]));
      p.setAttribute('aria-label', `Comuna ${c.num}, ${c.nombre}: ${textoDe(c)}`);
      const t = $(`#mapa text[data-c="${CSS.escape(c.clave)}"]`); if (t) t.classList.toggle('claro', pocos || k <= 1);
    }
    if (CAPA === 'com' && !hayCom()) {
      $('#escala').replaceChildren(h('span', {}, 'El detalle de los comercios por comuna se está consolidando.'));
      return;
    }
    const f = v => CAPA === 'rep' ? Math.round(v) + ' %' : fmt(v);
    const tramos = h('span', { class: 'tramos', 'aria-hidden': 'true' }, cols.map(c => { const i = h('i'); i.style.background = css(c); return i; }));
    $('#escala').replaceChildren(...[h('span', {}, 'Menos'), tramos, h('span', {}, 'Más'),
      h('span', {}, CAPA === 'rep' ? `(% que requiere ARP; cortes: ${br.map(f).join(', ')})` : `(comercios con ARP; cortes: ${br.map(f).join(', ')})`),
      CAPA === 'rep' ? h('span', {}, h('span', { class: 'rayas', 'aria-hidden': 'true' }), ` Menos de ${MIN_N} inmuebles`) : null].filter(Boolean));
  }
  // los números de las comunas, a 16 px en la pantalla sea cual sea el ancho del mapa
  function rotulos() {
    const svg = $('#mapa svg'); if (!svg || !GEO) return;
    const k = (GEO.w + 8) / Math.max(1, svg.getBoundingClientRect().width);
    $$('#mapa .rot').forEach(t => { t.setAttribute('font-size', (16 * k).toFixed(2)); t.setAttribute('stroke-width', (3.5 * k).toFixed(2)); });
  }
  let reloj = null;
  addEventListener('resize', () => { clearTimeout(reloj); reloj = setTimeout(rotulos, 150); });

  const pon = (...xs) => $('#ficha').replaceChildren(...xs.filter(Boolean));
  const mini = (valor, txt, cls) => h('div', {}, h('b', { class: cls || null }, valor), h('span', {}, txt));
  function elige(clave) {
    SEL = clave;
    $$('#mapa path').forEach(p => p.classList.toggle('on', p.dataset.c === clave));
    const p = $$('#mapa path').find(x => x.dataset.c === clave); if (!p || !p.__c) return;
    p.parentNode.append(p);   // el borde del elegido, encima de los vecinos
    const c = p.__c, cab = [h('h3', {}, `Comuna ${c.num} · ${c.nombre}`)];
    if (CAPA === 'rep') {
      const r = rep(c), cats = c.cats || {}, mx = Math.max(1, ...ORDEN.map(k => cats[k] || 0));
      pon(...cab,
        h('p', { class: 'sub' }, 'ARP Reparación · resultado de las visitas en esta comuna'),
        h('div', { class: 'mini' },
          mini(fmt(c.inmuebles), 'inmuebles visitados'),
          mini(pct(c.arp, c.inmuebles), `requieren ARP (${fmt(c.arp)})`),
          r && num(r.n) ? mini(fmt(r.n), `ARP asignados · ${pesos(r.valor || 0)}`) : mini('—', 'ARP asignados', 'pendiente')),
        h('h4', {}, 'Por tipo de afectación'),
        h('ul', { class: 'ficha-cats' }, ORDEN.filter(k => cats[k]).map(k => h('li', {}, h('span', {}, CAT[k].l), h('b', {}, fmt(cats[k])), barra(cats[k] / mx, CAT[k].arp ? '' : ' gris')))),
        c.inmuebles < MIN_N ? h('p', { class: 'nota' }, `Con solo ${fmt(c.inmuebles)} inmuebles visitados, las proporciones de esta comuna cambian mucho con cada visita.`) : null,
        h('p', { class: 'nota' }, 'Barras azules: tipos de afectación que se reparan con el ARP.'),
        r && num(r.n) ? null : h('p', { class: 'nota' }, 'El detalle de los ARP asignados por comuna se está consolidando.'));
    } else {
      const k = com(c), sev = k && k.severidad ? Object.entries(k.severidad).filter(([, n]) => n) : [], ms = Math.max(1, ...sev.map(x => x[1]));
      const co = (R.asignaciones || {}).comercio || {};
      pon(...cab,
        h('p', { class: 'sub' }, 'ARP Comercio · comercios con aporte a la recuperación'),
        k && num(k.n)
          ? h('div', { class: 'mini dos' }, mini(fmt(k.n), 'comercios recuperados (con ARP asignado)'), mini(pesos(k.valor || 0), 'valor de recuperación'))
          : h('div', { class: 'mini dos' }, mini('—', 'comercios recuperados en esta comuna', 'pendiente'), mini('—', 'valor de recuperación', 'pendiente')),
        sev.length ? h('h4', {}, 'Por severidad de la afectación') : null,
        sev.length ? h('ul', { class: 'ficha-cats' }, sev.map(([l, n]) => h('li', {}, h('span', {}, l), h('b', {}, fmt(n)), barra(n / ms)))) : null,
        num(co.n) ? h('p', { class: 'nota' }, `En toda la ciudad: ${fmt(co.n)} comercios con ARP asignado, por ${pesos(co.valor || 0)}.`) : null,
        k && num(k.n) ? null : h('p', { class: 'nota' }, 'El detalle de los comercios por comuna se está consolidando.'));
    }
  }

  // la tabla: comunas, zona rural y sin ubicar
  function tabla() {
    const filas = [...C.comunas, ...(C.rural ? [Object.assign({ nombre: 'Zona rural', num: '' }, C.rural)] : []), ...(C.sin_ubicar ? [Object.assign({ nombre: 'Sin ubicar', num: '' }, C.sin_ubicar)] : [])];
    const conRep = hayRep(), conCom = hayCom();
    const tot = f => filas.reduce((a, c) => a + (f(c) || 0), 0);
    const celdaN = (n, de, l) => h('td', { 'data-l': l }, fmt(n), ' ', h('small', {}, pct(n, de)));
    const celdaA = (x, l) => x && num(x.n) ? h('td', { 'data-l': l }, fmt(x.n), ' ', h('small', {}, pesos(x.valor || 0))) : h('td', { 'data-l': l, class: 'vacio' }, '—');
    const cols = [h('th', { scope: 'col' }, 'Comuna'), h('th', { scope: 'col' }, 'Inmuebles visitados'), h('th', { scope: 'col' }, 'Requieren ARP'),
      conRep ? h('th', { scope: 'col' }, 'ARP reparación asignados') : null, conCom ? h('th', { scope: 'col' }, 'ARP comercio asignados') : null];
    const ex = c => c.num ? (R.comunas || {})[String(c.num)] || {} : {};
    $('#t-comunas').replaceChildren(h('table', {},
      h('caption', { class: 'oculto' }, 'Resultados por comuna'),
      h('thead', {}, h('tr', {}, cols)),
      h('tbody', {}, filas.map(c => {
        const tr = h('tr', {}, h('td', {}, (c.num ? c.num + ' · ' : '') + c.nombre), h('td', { 'data-l': 'Visitados' }, fmt(c.inmuebles)), celdaN(c.arp, c.inmuebles, 'Requieren ARP'),
          conRep ? celdaA(ex(c).rep, 'ARP reparación') : null, conCom ? celdaA(ex(c).com, 'ARP comercio') : null);
        if (c.clave) tr.addEventListener('click', () => { elige(c.clave); $('#comunas').scrollIntoView({ block: 'start' }); });
        return tr;
      })),
      h('tfoot', {}, h('tr', {}, h('td', {}, 'Total'), h('td', { 'data-l': 'Visitados' }, fmt(tot(c => c.inmuebles))), celdaN(tot(c => c.arp), tot(c => c.inmuebles), 'Requieren ARP'),
        conRep ? celdaA({ n: tot(c => (ex(c).rep || {}).n), valor: tot(c => (ex(c).rep || {}).valor) }, 'ARP reparación') : null,
        conCom ? celdaA({ n: tot(c => (ex(c).com || {}).n), valor: tot(c => (ex(c).com || {}).valor) }, 'ARP comercio') : null))));
  }

  // ---------- los datos
  const lee = (u, o) => fetch(u, Object.assign({ cache: 'no-cache' }, o)).then(r => { if (!r.ok) throw new Error(u + ': ' + r.status); return r.json(); });
  const ARP_VACIO = { asignaciones: {}, afectados: {}, pasos: {}, comunas: {} };
  function todo() { pinta(); if (GEO) pintaComunas(); }

  // la función pública del servidor: { cifras: <como datos/cifras.json>, arp: <como datos/arp.json> }; cualquiera de las dos es opcional
  function enVivo(url) {
    return lee(url, { credentials: 'omit', referrerPolicy: 'no-referrer' }).then(j => {
      if (j && j.cifras && j.cifras.inmuebles) C = j.cifras;
      if (j && j.arp) R = Object.assign({}, R, j.arp);
      EN_VIVO = true; todo();
    }).catch(e => console.warn('Cifras en vivo no disponibles; quedan las del último corte.', e));
  }

  Promise.all([lee('datos/cifras.json'), lee('datos/comunas.json'), lee('datos/arp.json').catch(() => ARP_VACIO)])
    .then(([c, g, a]) => {
      C = c; GEO = g; R = a || ARP_VACIO;
      armaMapa(); todo();
      const url = R.en_vivo;
      if (typeof url === 'string' && url.startsWith('https://api.manizalesconstruye.camacolcaldas.com/')) {
        enVivo(url); setInterval(() => { if (!document.hidden) enVivo(url); }, 5 * 60 * 1000);
      }
    })
    .catch(e => { console.error(e); $('#mapa').replaceChildren(h('p', { class: 'cargando' }, 'No se pudieron cargar las cifras del día. Las de esta página son las del último corte publicado.')); });
})();
