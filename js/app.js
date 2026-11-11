/* Opción A · «servicio azul». Lee solo datos/cifras.json y datos/comunas.json (las cifras públicas del día).
   La página ya trae las cifras del corte escritas en el HTML; si los archivos cargan, se reemplazan por las del día.
   Sin librerías: barras en HTML y mapa en SVG. */
'use strict';
(() => {
  const $ = (q, r = document) => r.querySelector(q);
  const $$ = (q, r = document) => [...r.querySelectorAll(q)];
  const SVG = 'http://www.w3.org/2000/svg';
  const fmt = n => Math.round(n).toLocaleString('es-CO');
  const pct = (a, b) => b ? (100 * a / b).toLocaleString('es-CO', { maximumFractionDigits: 1 }) + ' %' : '—';
  const pctN = (a, b) => b ? 100 * a / b : 0;
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

  // ---------- «Ver más» de las ayudas
  $$('button.ver-mas').forEach(b => b.addEventListener('click', () => {
    const abierto = b.getAttribute('aria-expanded') === 'true', p = document.getElementById(b.getAttribute('aria-controls'));
    b.setAttribute('aria-expanded', String(!abierto)); p.hidden = abierto;
    b.firstChild.textContent = abierto ? 'Ver más ' : 'Ver menos ';
  }));

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

  // ---------- las categorías de la visita
  const CAT = {
    sin_dano: { l: 'Sin daños', d: 'Se puede habitar y no necesita reparación.', g: 'hab' },
    menor: { l: 'Daño menor', d: 'Se puede habitar, pero tiene daños que hay que reparar.', g: 'hab', arp: true },
    restringido: { l: 'Uso restringido', d: 'Se puede habitar, pero hay espacios que no se deben usar hasta repararlos.', g: 'hab', arp: true },
    mayor: { l: 'Daño mayor', d: 'No se puede habitar hasta repararla. Incluye el colapso parcial.', g: 'noh', arp: true },
    colapso: { l: 'Colapso total', d: 'La edificación se cayó. No se repara: sigue el proceso de demolición.', g: 'noh' },
    seguro: { l: 'Lo repara el seguro', d: 'El propietario no pidió la evaluación porque su seguro cubre la reparación.', g: 'sin' },
    sin_acceso: { l: 'Sin acceso al predio', d: 'Nadie atendió la visita o el predio estaba cerrado. Queda pendiente.', g: 'sin' },
  };
  const ORDEN = Object.keys(CAT);

  function pinta(C) {
    const corte = new Date(C.corte);
    dato('corte', corte.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Bogota' }) + ', ' +
      corte.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Bogota' }));
    dato('desde', new Date(C.equipo.desde + 'T12:00:00-05:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Bogota' }));
    const I = C.inmuebles, P = I.por_categoria, T = I.total, A = C.arp, D = C.demoliciones;
    const G = { hab: P.sin_dano + P.menor + P.restringido, noh: P.mayor + P.colapso, sin: P.seguro + P.sin_acceso };
    dato('total', fmt(T)); dato('ingenieros', fmt(C.equipo.ingenieros)); dato('edificios', fmt(I.edificios)); dato('casas', fmt(I.casas));
    dato('arp', fmt(A.requieren)); dato('con_presupuesto', fmt(A.con_presupuesto)); dato('crr', '$' + fmt(A.crr / 1e6));
    dato('expedientes', fmt(D.expedientes)); dato('demolidas', fmt(D.demolidas)); dato('por_municipio', fmt(D.por_municipio)); dato('por_particular', fmt(D.por_particular));
    dato('viviendas', fmt(C.familias.viviendas)); dato('personas', fmt(C.familias.personas)); dato('lluvias', fmt(C.lluvias.visitas));
    dato('g-hab', fmt(G.hab)); dato('g-noh', fmt(G.noh)); dato('g-sin', fmt(G.sin));

    // la tira de tres grupos y las categorías
    const tira = $('#tira');
    tira.setAttribute('aria-label', `De ${fmt(T)} inmuebles valorados: se pueden habitar ${fmt(G.hab)}, no se pueden habitar hoy ${fmt(G.noh)}, todavía sin evaluar ${fmt(G.sin)}`);
    $('.t-hab', tira).style.flexGrow = G.hab; $('.t-noh', tira).style.flexGrow = G.noh; $('.t-sin', tira).style.flexGrow = G.sin;
    const max = Math.max(...ORDEN.map(k => P[k]));
    for (const g of ['hab', 'noh', 'sin']) {
      $(`.cats[data-grupo="${g}"]`).replaceChildren(...ORDEN.filter(k => CAT[k].g === g).map(k => h('li', {},
        h('div', { class: 'cat-fila' }, h('strong', {}, CAT[k].l), h('span', { class: 'n' }, fmt(P[k])), h('span', { class: 'p' }, pct(P[k], T))),
        barra(P[k] / max),
        h('p', {}, CAT[k].d),
        CAT[k].arp ? h('span', { class: 'arp-tag' }, 'Se repara con ARP') : null)));
    }

    // las fases de la demolición
    const mf = Math.max(...D.fases.map(f => f.n));
    $('#fases').replaceChildren(...D.fases.map(f => h('li', {}, h('span', { class: 'f-n' }, fmt(f.n)), h('span', { class: 'f-l' }, f.l),
      (() => { const b = h('span'); b.style.width = (100 * f.n / mf).toFixed(1) + '%'; return h('span', { class: 'f-barra', 'aria-hidden': 'true' }, b); })())));
  }

  // ---------- el mapa de comunas
  let METRICA = 'noh', SEL = null, DATOS = null, GEO = null;
  const MIN_N = 20;   // con menos inmuebles una proporción no dice mucho: la comuna va rayada
  const RAMPA = ['--r1', '--r2', '--r3', '--r4', '--r5'];
  const valorDe = (c, m) => m === 'n' ? c.inmuebles : m === 'noh' ? pctN(c.no_habitables, c.inmuebles) : pctN(c.arp, c.inmuebles);
  const textoDe = (c, m) => m === 'n' ? fmt(c.inmuebles) + ' inmuebles valorados' : m === 'noh' ? pct(c.no_habitables, c.inmuebles) + ' no habitables (' + fmt(c.no_habitables) + ')' : pct(c.arp, c.inmuebles) + ' requieren ARP (' + fmt(c.arp) + ')';
  function cortes(vals) {
    const v = [...vals].sort((a, b) => a - b), q = [1, 2, 3, 4].map(i => v[Math.min(v.length - 1, Math.floor(i * v.length / 5))]);
    return q.filter((x, i) => i === 0 || x > q[i - 1]);
  }
  function pintaComunas(C) {
    const cs = C.comunas, porClave = Object.fromEntries(cs.map(c => [c.clave, c]));
    // los contornos vienen con la y hacia arriba (negativa): el lienzo va de -h a 0 y los rótulos van en -y
    const g = s('svg', { viewBox: `-4 ${-GEO.h - 4} ${GEO.w + 8} ${GEO.h + 8}` });
    const defs = s('defs'), pat = s('pattern', { id: 'rayas', width: '6', height: '6', patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' });
    pat.append(s('rect', { width: '6', height: '6', fill: '#f3f5f8' }), s('rect', { width: '3', height: '6', fill: '#cfd6e0' })); defs.append(pat); g.append(defs);
    const capaP = s('g'), capaR = s('g', { 'aria-hidden': 'true' });
    for (const z of GEO.comunas) {
      const c = porClave[z.clave] || { clave: z.clave, num: +z.clave.slice(0, 2), nombre: z.clave.slice(5), inmuebles: 0, no_habitables: 0, arp: 0, cats: {} };
      const p = s('path', { d: z.d, tabindex: '0', role: 'button', 'data-c': z.clave });
      p.__c = c;
      p.addEventListener('click', () => elige(c.clave));
      p.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); elige(c.clave); } });
      p.addEventListener('pointermove', e => muestra(e, `Comuna ${c.num} · ${c.nombre}`, c.inmuebles < MIN_N && METRICA !== 'n' ? `Solo ${fmt(c.inmuebles)} inmuebles valorados` : textoDe(c, METRICA)));
      p.addEventListener('pointerleave', esconde);
      p.addEventListener('focus', e => muestra(e, `Comuna ${c.num} · ${c.nombre}`, textoDe(c, METRICA)));
      p.addEventListener('blur', esconde);
      capaP.append(p);
      const t = s('text', { x: z.x, y: -z.y, 'text-anchor': 'middle', 'dominant-baseline': 'central', class: 'rot', 'data-c': z.clave }); t.textContent = c.num; capaR.append(t);
    }
    g.append(capaP, capaR); $('#mapa').replaceChildren(g); rotulos();
    $$('#metricas button').forEach(b => b.addEventListener('click', () => { METRICA = b.dataset.m; $$('#metricas button').forEach(x => x.setAttribute('aria-pressed', String(x === b))); colorea(); }));
    colorea();
    elige([...cs].sort((a, b) => b.no_habitables - a.no_habitables)[0].clave);

    // la tabla: comunas, zona rural y sin ubicar
    const filas = [...cs, ...(C.rural ? [Object.assign({ nombre: 'Zona rural', num: '' }, C.rural)] : []), ...(C.sin_ubicar ? [Object.assign({ nombre: 'Sin ubicar', num: '' }, C.sin_ubicar)] : [])];
    const tot = k => filas.reduce((a, c) => a + c[k], 0);
    const celda = (n, de, l) => h('td', { 'data-l': l }, fmt(n), ' ', h('small', {}, pct(n, de)));
    $('#t-comunas').replaceChildren(h('table', {},
      h('caption', { class: 'oculto' }, 'Resultados por comuna'),
      h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, 'Comuna'), h('th', { scope: 'col' }, 'Valorados'), h('th', { scope: 'col' }, 'No habitables'), h('th', { scope: 'col' }, 'Requieren ARP'))),
      h('tbody', {}, filas.map(c => {
        const tr = h('tr', {}, h('td', {}, (c.num ? c.num + ' · ' : '') + c.nombre), h('td', { 'data-l': 'Valorados' }, fmt(c.inmuebles)), celda(c.no_habitables, c.inmuebles, 'No habitables'), celda(c.arp, c.inmuebles, 'Requieren ARP'));
        if (c.clave) tr.addEventListener('click', () => { elige(c.clave); $('#comunas').scrollIntoView({ block: 'start' }); });
        return tr;
      })),
      h('tfoot', {}, h('tr', {}, h('td', {}, 'Total'), h('td', { 'data-l': 'Valorados' }, fmt(tot('inmuebles'))), celda(tot('no_habitables'), tot('inmuebles'), 'No habitables'), celda(tot('arp'), tot('inmuebles'), 'Requieren ARP')))));
  }
  function colorea() {
    const ps = $$('#mapa path'), validas = ps.map(p => p.__c).filter(c => METRICA === 'n' || c.inmuebles >= MIN_N);
    const br = cortes(validas.map(c => valorDe(c, METRICA))), clase = v => br.filter(b => v >= b).length;
    const cols = RAMPA.slice(5 - (br.length + 1));
    for (const p of ps) {
      const c = p.__c, pocos = METRICA !== 'n' && c.inmuebles < MIN_N, k = clase(valorDe(c, METRICA));
      p.setAttribute('fill', pocos ? 'url(#rayas)' : css(cols[k]));
      p.setAttribute('aria-label', `Comuna ${c.num}, ${c.nombre}: ${pocos ? 'solo ' + fmt(c.inmuebles) + ' inmuebles valorados' : textoDe(c, METRICA)}`);
      const t = $(`#mapa text[data-c="${CSS.escape(c.clave)}"]`); if (t) t.classList.toggle('claro', pocos || k <= 1);
    }
    const f = v => METRICA === 'n' ? fmt(v) : Math.round(v) + ' %';
    const tramos = h('span', { class: 'tramos', 'aria-hidden': 'true' }, cols.map(c => { const i = h('i'); i.style.background = css(c); return i; }));
    $('#escala').replaceChildren(h('span', {}, 'Menos'), tramos, h('span', {}, 'Más'), h('span', {}, `(cortes: ${br.map(f).join(', ')})`),
      METRICA !== 'n' ? h('span', {}, h('span', { class: 'rayas', 'aria-hidden': 'true' }), ` Menos de ${MIN_N} inmuebles`) : null);
  }
  // los números de las comunas, a 16 px en la pantalla sea cual sea el ancho del mapa
  function rotulos() {
    const svg = $('#mapa svg'); if (!svg || !GEO) return;
    const k = (GEO.w + 8) / Math.max(1, svg.getBoundingClientRect().width);
    $$('#mapa .rot').forEach(t => { t.setAttribute('font-size', (16 * k).toFixed(2)); t.setAttribute('stroke-width', (3.5 * k).toFixed(2)); });
  }
  let reloj = null;
  addEventListener('resize', () => { clearTimeout(reloj); reloj = setTimeout(rotulos, 150); });
  function elige(clave) {
    SEL = clave;
    $$('#mapa path').forEach(p => p.classList.toggle('on', p.dataset.c === clave));
    const p = $$('#mapa path').find(x => x.dataset.c === clave); if (!p) return;
    p.parentNode.append(p);   // el borde del elegido, encima de los vecinos
    const c = p.__c, mx = Math.max(1, ...ORDEN.map(k => (c.cats || {})[k] || 0));
    $('#ficha').replaceChildren(...[
      h('h3', {}, `Comuna ${c.num} · ${c.nombre}`),
      h('p', { class: 'sub' }, 'Resultado de las visitas en esta comuna'),
      h('div', { class: 'mini' },
        h('div', {}, h('b', {}, fmt(c.inmuebles)), h('span', {}, 'inmuebles valorados')),
        h('div', {}, h('b', {}, pct(c.no_habitables, c.inmuebles)), h('span', {}, `no habitables (${fmt(c.no_habitables)})`)),
        h('div', {}, h('b', {}, pct(c.arp, c.inmuebles)), h('span', {}, `requieren ARP (${fmt(c.arp)})`))),
      h('ul', { class: 'ficha-cats' }, ORDEN.filter(k => (c.cats || {})[k]).map(k => h('li', {}, h('span', {}, CAT[k].l), h('b', {}, fmt(c.cats[k])), barra(c.cats[k] / mx, CAT[k].arp ? '' : ' gris')))),
      c.inmuebles < MIN_N ? h('p', { class: 'nota' }, `Con solo ${fmt(c.inmuebles)} inmuebles valorados, las proporciones de esta comuna cambian mucho con cada visita.`) : null,
      h('p', { class: 'nota' }, 'Barras azules: resultados que se reparan con el ARP.')].filter(Boolean));
  }

  // ---------- los datos
  const lee = u => fetch(u, { cache: 'no-cache' }).then(r => { if (!r.ok) throw new Error(u + ': ' + r.status); return r.json(); });
  Promise.all([lee('datos/cifras.json'), lee('datos/comunas.json')])
    .then(([c, g]) => { DATOS = c; GEO = g; pinta(c); pintaComunas(c); })
    .catch(e => { console.error(e); $('#mapa').replaceChildren(h('p', { class: 'cargando' }, 'No se pudieron cargar las cifras del día. Las de esta página son las del último corte publicado.')); });
})();
