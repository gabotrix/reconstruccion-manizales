/* Plan de Recuperación Manizales · v2.0. Lee datos/cifras.json, datos/comunas.json y datos/arp.json, y si arp.json trae
   «en_vivo», las cifras públicas del servidor (al abrir y cada 5 minutos). Sin librerías: el mapa es SVG.
   v2 · el mapa de comunas: escala de azul a amarillo, burbujas con los aportes asignados, vista «Toda la ciudad» con un
   ranking que se sincroniza con el mapa, anillo del % que requiere ARP y una barra apilada por tipo de afectación. */
'use strict';
(() => {
  const $ = (q, r = document) => r.querySelector(q);
  const $$ = (q, r = document) => [...r.querySelectorAll(q)];
  const SVG = 'http://www.w3.org/2000/svg';
  const fmt = n => Math.round(n).toLocaleString('es-CO');
  const pesos = n => '$' + fmt(n);
  const millones = n => n >= 1e9 ? '$' + (n / 1e9).toLocaleString('es-CO', { maximumFractionDigits: 2 }) + ' mil M' : n >= 1e6 ? '$' + (n / 1e6).toLocaleString('es-CO', { maximumFractionDigits: 1 }) + ' M' : pesos(n);
  const pctN = (a, b) => b ? 100 * a / b : 0;
  const pct = (a, b) => b ? pctN(a, b).toLocaleString('es-CO', { maximumFractionDigits: 1 }) + ' %' : '—';
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
  function muestra(ev, titulo, lineas) {
    globo.replaceChildren(h('b', {}, titulo), ...lineas.map(l => h('span', {}, l))); globo.hidden = false;
    let x, y;
    if (ev.clientX != null && ev.type !== 'focus') { x = ev.clientX; y = ev.clientY; }
    else { const r = ev.target.getBoundingClientRect(); x = r.left + r.width / 2; y = r.top; }
    const w = globo.offsetWidth, hh = globo.offsetHeight;
    globo.style.left = Math.max(8, Math.min(innerWidth - w - 8, x + 16)) + 'px';
    globo.style.top = (y - hh - 14 < 8 ? y + 20 : y - hh - 14) + 'px';
  }
  const esconde = () => { globo.hidden = true; };
  addEventListener('scroll', esconde, { passive: true });

  // ---------- los tipos de afectación (19-nov: «afectación», no «daño»), con colores de severidad
  const CAT = {
    sin_dano: { l: 'Sin afectación', c: '#9fb6d6' },
    menor: { l: 'Afectación menor', c: '#fcc419', arp: true },
    restringido: { l: 'Uso restringido', c: '#f59f00', arp: true },
    mayor: { l: 'Afectación mayor', c: '#e8590c', arp: true },
    colapso: { l: 'Colapso total', c: '#c92a2a' },
    seguro: { l: 'Lo repara el seguro', c: '#7d8bb8' },
    sin_acceso: { l: 'Sin acceso al predio', c: '#5d6b82' },
  };
  const ORDEN = Object.keys(CAT);
  const SEV = { 'Severo': '#e8590c', 'Leve o moderado': '#fcc419' };
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
    const niv = (C.afectados && C.afectados.niveles) || [];
    if (niv.length) {
      dato('predios_afectados', fmt(niv.reduce((a, n) => a + n[1], 0)));
      dato('niveles', niv.map((n, i) => (i ? n[0].replace(/^Impacto /, '') : n[0]) + ' ' + fmt(n[1])).join(' · '));
    }
    const A = R.afectados || {};
    if (num(A.comercios)) dato('comercios_afectados', fmt(A.comercios));
    if (num(A.predios)) dato('predios_afectados', fmt(A.predios));
    const S = R.asignaciones || {}, ed = S.edificaciones || {}, co = S.comercio || {};
    if (num(ed.n) && num(co.n)) {
      dato('asig_edif_n', fmt(ed.n)); dato('asig_edif_valor', pesos(ed.valor));
      dato('asig_com_n', fmt(co.n)); dato('asig_com_valor', pesos(co.valor));
      dato('asig_total_n', fmt(ed.n + co.n)); dato('asig_total_valor', pesos(ed.valor + co.valor));
    }
    const P = R.pasos || {};
    $$('[data-paso]').forEach(e => {
      const v = P[e.dataset.paso], n = num(v) ? v : v && num(v.n) ? v.n : null;
      e.hidden = n == null;
      if (n != null) { $('b', e).textContent = fmt(n); $('span', e).textContent = (v && v.txt) || PASOS[e.dataset.paso]; }
    });
    if (D.fases && D.fases.length) $('#fases').replaceChildren(...D.fases.map(f => h('li', {}, `${f.l}: ${fmt(f.n)}`)));
  }

  // =================== el mapa de comunas ===================
  let CAPA = 'rep', SEL = null;
  const MIN_N = 20;   // con menos inmuebles una proporción no dice mucho: la comuna va rayada
  const RAMPA = ['--m1', '--m2', '--m3', '--m4', '--m5'];
  const extra = c => (R.comunas || {})[String(c.num)] || {};
  const rep = c => extra(c).rep || null, com = c => extra(c).com || null;
  const comBase = c => { const k = com(c); return k && k.severidad ? Object.values(k.severidad).reduce((a, n) => a + (n || 0), 0) : 0; };
  const hayCom = () => (C.comunas || []).some(c => com(c));
  // el color: % que requiere ARP (reparación) o comercios en la base de la Cámara (comercio)
  const valorDe = c => CAPA === 'rep' ? pctN(c.arp, c.inmuebles) : comBase(c);
  const sinDato = c => CAPA === 'rep' ? c.inmuebles < MIN_N : !hayCom();
  // la burbuja: aportes asignados (reparación) o comercios recuperados (comercio)
  const burbuja = c => { const k = CAPA === 'rep' ? rep(c) : com(c); return k && num(k.n) ? k.n : 0; };
  function cortes(vals) {
    const v = [...vals].sort((a, b) => a - b), q = [1, 2, 3, 4].map(i => v[Math.min(v.length - 1, Math.floor(i * v.length / 5))]);
    return q.filter((x, i) => i === 0 || x > q[i - 1]);
  }
  const lineasGlobo = c => CAPA === 'rep'
    ? [c.inmuebles < MIN_N ? `Solo ${fmt(c.inmuebles)} inmuebles visitados` : `${pct(c.arp, c.inmuebles)} requiere ARP (${fmt(c.arp)} de ${fmt(c.inmuebles)})`,
       rep(c) ? `${fmt(rep(c).n)} aportes asignados · ${millones(rep(c).valor || 0)}` : 'Sin aportes asignados todavía']
    : (com(c) ? [`${fmt(comBase(c))} comercios en la base`, `${fmt(com(c).n || 0)} recuperados · ${millones(com(c).valor || 0)}`] : ['Sin comercios ubicados en esta comuna']);

  function armaMapa() {
    const g = s('svg', { viewBox: `-6 ${-GEO.h - 6} ${GEO.w + 12} ${GEO.h + 12}`, class: 'mapa-svg' });
    const defs = s('defs'), pat = s('pattern', { id: 'rayas', width: '6', height: '6', patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' });
    pat.append(s('rect', { width: '6', height: '6', fill: '#1a345f' }), s('rect', { width: '2.4', height: '6', fill: '#2c4b7c' }));
    const sombra = s('filter', { id: 'sombra', x: '-20%', y: '-20%', width: '140%', height: '140%' });
    sombra.append(s('feDropShadow', { dx: '0', dy: '3', stdDeviation: '4', 'flood-color': '#000', 'flood-opacity': '.45' }));
    defs.append(pat, sombra); g.append(defs);
    const capaP = s('g', { class: 'capa-comunas' }), capaB = s('g', { class: 'capa-burbujas', 'aria-hidden': 'true' });
    GEO.comunas.forEach((z, i) => {
      const p = s('path', { d: z.d, tabindex: '0', role: 'button', 'data-c': z.clave, class: 'comuna' });
      p.style.setProperty('--i', i);
      p.addEventListener('click', () => elige(z.clave));
      p.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); elige(z.clave); } });
      p.addEventListener('pointermove', e => muestra(e, `Comuna ${p.__c.num} · ${p.__c.nombre}`, lineasGlobo(p.__c)));
      p.addEventListener('pointerleave', esconde);
      p.addEventListener('focus', e => muestra(e, `Comuna ${p.__c.num} · ${p.__c.nombre}`, lineasGlobo(p.__c)));
      p.addEventListener('blur', esconde);
      capaP.append(p);
      const b = s('g', { class: 'pin', 'data-c': z.clave, transform: `translate(${z.x} ${-z.y})` });
      b.style.setProperty('--i', i);
      b.append(s('circle', { class: 'pin-halo', r: '0' }), s('circle', { class: 'pin-c', r: '8' }));
      const t = s('text', { class: 'pin-n', 'text-anchor': 'middle', 'dominant-baseline': 'central' }); t.textContent = +z.clave.slice(0, 2);
      b.append(t); capaB.append(b);
    });
    g.append(capaP, capaB);
    $('#mapa').replaceChildren(g); rotulos();
    // la animación de entrada se dispara cuando el mapa se ve
    new IntersectionObserver((es, o) => { if (es.some(e => e.isIntersecting)) { g.classList.add('listo'); o.disconnect(); } }, { threshold: .25 }).observe(g);
    $$('#metricas button').forEach(b => b.addEventListener('click', () => {
      CAPA = b.dataset.m; $$('#metricas button').forEach(x => x.setAttribute('aria-pressed', String(x === b))); colorea(); ficha();
    }));
  }
  function pintaComunas() {
    const porClave = Object.fromEntries(C.comunas.map(c => [c.clave, c]));
    $$('#mapa .comuna').forEach(p => {
      const k = p.dataset.c;
      p.__c = porClave[k] || { clave: k, num: +k.slice(0, 2), nombre: k.slice(5), inmuebles: 0, no_habitables: 0, arp: 0, cats: {} };
    });
    colorea(); ficha(); tabla();
  }
  function colorea() {
    const ps = $$('#mapa .comuna'), validas = ps.map(p => p.__c).filter(c => !sinDato(c));
    const br = cortes(validas.map(valorDe)), clase = v => br.filter(b => v >= b).length;
    const cols = RAMPA.slice(5 - (br.length + 1));
    for (const p of ps) {
      const c = p.__c, pocos = sinDato(c);
      p.style.fill = pocos ? 'url(#rayas)' : css(cols[clase(valorDe(c))]);
      p.setAttribute('aria-label', `Comuna ${c.num}, ${c.nombre}: ${lineasGlobo(c).join('; ')}`);
    }
    // las burbujas, con área proporcional al número
    const mx = Math.max(1, ...ps.map(p => burbuja(p.__c)));
    for (const b of $$('#mapa .pin')) {
      const p = ps.find(x => x.dataset.c === b.dataset.c), v = p ? burbuja(p.__c) : 0;
      const r = v ? 12 + 16 * Math.sqrt(v / mx) : 0;
      $('.pin-halo', b).setAttribute('r', r.toFixed(1));
      b.classList.toggle('con', v > 0);
    }
    marca();
    // la leyenda: degradado con los cortes y la burbuja
    const f = v => CAPA === 'rep' ? Math.round(v) + ' %' : fmt(v);
    const sinCom = CAPA === 'com' && !hayCom();
    $('#escala').replaceChildren(...[
      h('span', { class: 'esc-t' }, CAPA === 'rep' ? '% que requiere ARP' : 'Comercios afectados en la base'),
      sinCom ? h('span', { class: 'esc-t' }, 'Sin comercios ubicados todavía') : h('span', { class: 'esc-grad' },
        ...cols.map((c, i) => { const x = h('i', {}, i === 0 ? 'Menos' : i === cols.length - 1 ? 'Más' : ''); x.style.background = css(c); x.title = i ? '≥ ' + f(br[i - 1]) : '< ' + f(br[0] ?? 0); return x; })),
      h('span', { class: 'esc-b' }, h('i', { 'aria-hidden': 'true' }), CAPA === 'rep' ? 'Aportes asignados' : 'Comercios recuperados'),
      CAPA === 'rep' ? h('span', { class: 'esc-b rayada' }, h('i', { 'aria-hidden': 'true' }), `Menos de ${MIN_N} inmuebles`) : null].filter(Boolean));
  }
  function marca() {
    $$('#mapa .comuna').forEach(p => p.classList.toggle('on', p.dataset.c === SEL));
    $$('#mapa .pin').forEach(b => b.classList.toggle('on', b.dataset.c === SEL));
    const svg = $('#mapa svg'); if (svg) svg.classList.toggle('hay-sel', !!SEL);
    const p = SEL && $(`#mapa .comuna[data-c="${CSS.escape(SEL)}"]`); if (p) p.parentNode.append(p);
  }
  // los números de las comunas, a 13 px en la pantalla sea cual sea el ancho del mapa
  function rotulos() {
    const svg = $('#mapa svg'); if (!svg || !GEO) return;
    const k = (GEO.w + 12) / Math.max(1, svg.getBoundingClientRect().width);
    $$('#mapa .pin-n').forEach(t => t.setAttribute('font-size', (12.5 * k).toFixed(2)));
    $$('#mapa .pin-c').forEach(c => c.setAttribute('r', (11 * k).toFixed(2)));
  }
  let reloj = null;
  addEventListener('resize', () => { clearTimeout(reloj); reloj = setTimeout(rotulos, 150); });

  function elige(clave) { SEL = clave === SEL ? null : clave; marca(); ficha(); }

  // ---------- piezas de la ficha
  const kpi = (valor, txt, extraCls) => h('div', { class: 'kpi' + (extraCls ? ' ' + extraCls : '') }, h('b', {}, valor), h('span', {}, txt));
  function anillo(p, txt) {
    const r = 26, L = 2 * Math.PI * r, svg = s('svg', { viewBox: '0 0 64 64', class: 'anillo-svg', 'aria-hidden': 'true' });
    const fondo = s('circle', { cx: 32, cy: 32, r, class: 'an-f' }), arco = s('circle', { cx: 32, cy: 32, r, class: 'an-a', 'stroke-dasharray': `${L}`, 'stroke-dashoffset': `${L}` });
    svg.append(fondo, arco);
    requestAnimationFrame(() => requestAnimationFrame(() => arco.setAttribute('stroke-dashoffset', (L * (1 - Math.min(1, p / 100))).toFixed(1))));
    return h('div', { class: 'kpi kpi-anillo' }, h('div', { class: 'anillo' }, svg, h('b', {}, Math.round(p) + '%')), h('span', {}, txt));
  }
  function apilada(items, total, titulo) {
    const it = items.filter(x => x.n > 0);
    if (!it.length) return null;
    const barra = h('div', { class: 'apilada', role: 'img', 'aria-label': titulo + ': ' + it.map(x => `${x.l} ${fmt(x.n)}`).join(', ') },
      ...it.map(x => { const e = h('span'); e.style.flexGrow = x.n; e.style.background = x.c; e.title = `${x.l}: ${fmt(x.n)}`; return e; }));
    const ley = h('ul', { class: 'ap-ley' }, ...it.map(x => { const d = h('i'); d.style.background = x.c; return h('li', {}, d, h('span', {}, x.l), h('b', {}, fmt(x.n)), h('small', {}, pct(x.n, total))); }));
    return h('div', { class: 'ap' }, h('h4', {}, titulo), barra, ley);
  }
  function ranking() {
    const cs = $$('#mapa .comuna').map(p => p.__c), v = c => CAPA === 'rep' ? pctN(c.arp, c.inmuebles) : burbuja(c);
    const orden = [...cs].sort((a, b) => v(b) - v(a) || b.inmuebles - a.inmuebles), mx = Math.max(1e-9, ...orden.map(v));
    return h('div', { class: 'rank' },
      h('h4', {}, CAPA === 'rep' ? 'Comunas por % que requiere ARP' : 'Comunas por comercios recuperados'),
      h('ol', {}, ...orden.map(c => {
        const b = h('button', { type: 'button', class: 'rank-b' + (CAPA === 'rep' && c.inmuebles < MIN_N ? ' poco' : '') + (c.clave === SEL ? ' on' : ''), 'aria-pressed': String(c.clave === SEL) },
          h('span', { class: 'rank-n' }, String(c.num)), h('span', { class: 'rank-t' }, c.nombre),
          h('b', {}, CAPA === 'rep' ? pct(c.arp, c.inmuebles) : fmt(v(c))),
          (() => { const x = h('i', { class: 'rank-bar', 'aria-hidden': 'true' }); x.style.setProperty('--w', (100 * v(c) / mx).toFixed(1) + '%'); return x; })());
        b.addEventListener('click', () => elige(c.clave));
        b.addEventListener('mouseenter', () => { const p = $(`#mapa .comuna[data-c="${CSS.escape(c.clave)}"]`); if (p) p.classList.add('hover'); });
        b.addEventListener('mouseleave', () => $$('#mapa .comuna.hover').forEach(p => p.classList.remove('hover')));
        return h('li', {}, b);
      })));
  }
  function ficha() {
    const caja = $('#ficha'), A = R.asignaciones || {};
    const todos = $$('#mapa .comuna').map(p => p.__c);
    let hijos;
    if (!SEL) {
      if (CAPA === 'rep') {
        const I = C.inmuebles, P = I.por_categoria || {}, req = (P.menor || 0) + (P.restringido || 0) + (P.mayor || 0), ed = A.edificaciones || {};
        hijos = [h('p', { class: 'fi-pre' }, 'Toda la ciudad'), h('h3', {}, 'ARP Reparación'),
          h('div', { class: 'kpis' }, kpi(fmt(I.total), 'inmuebles visitados'), anillo(pctN(req, I.total), `requiere ARP (${fmt(req)})`),
            kpi(num(ed.n) ? fmt(ed.n) : '—', 'aportes asignados'), kpi(num(ed.valor) ? millones(ed.valor) : '—', 'valor asignado', 'kpi-amarillo')),
          apilada(ORDEN.map(k => ({ l: CAT[k].l, c: CAT[k].c, n: P[k] || 0 })), I.total, 'Por tipo de afectación')];
      } else {
        const co = A.comercio || {}, base = todos.reduce((a, c) => a + comBase(c), 0), sev = {};
        todos.forEach(c => Object.entries((com(c) || {}).severidad || {}).forEach(([k, n]) => { sev[k] = (sev[k] || 0) + (n || 0); }));
        hijos = [h('p', { class: 'fi-pre' }, 'Toda la ciudad'), h('h3', {}, 'ARP Comercio'),
          h('div', { class: 'kpis' }, kpi(num((R.afectados || {}).comercios) ? fmt(R.afectados.comercios) : '—', 'comercios afectados'),
            kpi(num(co.n) ? fmt(co.n) : '—', 'comercios recuperados'), kpi(num(co.valor) ? millones(co.valor) : '—', 'valor de recuperación', 'kpi-amarillo'),
            kpi(fmt(base), 'en la base de la Cámara, ubicados')),
          apilada(Object.entries(sev).map(([l, n]) => ({ l, n, c: SEV[l] || '#9fb6d6' })), base, 'Por severidad de la afectación')];
      }
    } else {
      const c = todos.find(x => x.clave === SEL); if (!c) return;
      const volver = h('button', { type: 'button', class: 'fi-volver' }, '← Toda la ciudad'); volver.addEventListener('click', () => elige(SEL));
      const cab = [volver, h('p', { class: 'fi-pre' }, `Comuna ${c.num}`), h('h3', {}, c.nombre)];
      if (CAPA === 'rep') {
        const r = rep(c), cats = c.cats || {};
        hijos = [...cab, h('div', { class: 'kpis' }, kpi(fmt(c.inmuebles), 'inmuebles visitados'), anillo(pctN(c.arp, c.inmuebles), `requiere ARP (${fmt(c.arp)})`),
          kpi(r ? fmt(r.n) : '0', 'aportes asignados'), kpi(r ? millones(r.valor || 0) : '$0', 'valor asignado', 'kpi-amarillo')),
          apilada(ORDEN.map(k => ({ l: CAT[k].l, c: CAT[k].c, n: cats[k] || 0 })), c.inmuebles, 'Por tipo de afectación'),
          c.inmuebles < MIN_N ? h('p', { class: 'fi-nota' }, `Con solo ${fmt(c.inmuebles)} inmuebles visitados, las proporciones de esta comuna cambian mucho con cada visita.`) : null];
      } else {
        const k = com(c);
        hijos = [...cab, h('div', { class: 'kpis kpis-3' }, kpi(k ? fmt(k.n || 0) : '0', 'comercios recuperados'), kpi(k ? millones(k.valor || 0) : '$0', 'valor de recuperación', 'kpi-amarillo'), kpi(fmt(comBase(c)), 'en la base, ubicados')),
          k ? apilada(Object.entries(k.severidad || {}).map(([l, n]) => ({ l, n, c: SEV[l] || '#9fb6d6' })), comBase(c), 'Por severidad de la afectación') : h('p', { class: 'fi-nota' }, 'No hay comercios de la base de la Cámara ubicados en esta comuna.')];
      }
    }
    caja.replaceChildren(...hijos.filter(Boolean));
    $('#rank').replaceChildren(...(CAPA === 'com' && !hayCom() ? [] : [ranking()]));
    caja.classList.remove('entra'); void caja.offsetWidth; caja.classList.add('entra');
  }

  // ---------- la tabla (plegable): comunas, zona rural y sin ubicar
  function tabla() {
    const filas = [...C.comunas, ...(C.rural ? [Object.assign({ nombre: 'Zona rural', num: '', k: 'rural' }, C.rural)] : []), ...(C.sin_ubicar ? [Object.assign({ nombre: 'Sin ubicar', num: '', k: 'sin_ubicar' }, C.sin_ubicar)] : [])];
    const ex = c => (R.comunas || {})[c.num ? String(c.num) : c.k] || {};
    const conRep = filas.some(c => ex(c).rep), conCom = filas.some(c => ex(c).com);
    const tot = f => filas.reduce((a, c) => a + (f(c) || 0), 0);
    const celdaN = (n, de, l) => h('td', { 'data-l': l }, fmt(n), ' ', h('small', {}, pct(n, de)));
    const celdaA = (x, l) => x && num(x.n) ? h('td', { 'data-l': l }, fmt(x.n), ' ', h('small', {}, pesos(x.valor || 0))) : h('td', { 'data-l': l, class: 'vacio' }, '—');
    $('#t-comunas').replaceChildren(h('table', {},
      h('caption', { class: 'oculto' }, 'Resultados por comuna'),
      h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, 'Comuna'), h('th', { scope: 'col' }, 'Inmuebles visitados'), h('th', { scope: 'col' }, 'Requieren ARP'),
        conRep ? h('th', { scope: 'col' }, 'ARP reparación asignados') : null, conCom ? h('th', { scope: 'col' }, 'ARP comercio asignados') : null)),
      h('tbody', {}, filas.map(c => {
        const tr = h('tr', {}, h('td', {}, (c.num ? c.num + ' · ' : '') + c.nombre), h('td', { 'data-l': 'Visitados' }, fmt(c.inmuebles)), celdaN(c.arp, c.inmuebles, 'Requieren ARP'),
          conRep ? celdaA(ex(c).rep, 'ARP reparación') : null, conCom ? celdaA(ex(c).com, 'ARP comercio') : null);
        if (c.clave) tr.addEventListener('click', () => { SEL = null; elige(c.clave); $('#comunas').scrollIntoView({ block: 'start' }); });
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
  function enVivo(url) {
    return lee(url, { credentials: 'omit', referrerPolicy: 'no-referrer' }).then(j => {
      if (j && j.cifras && j.cifras.inmuebles) C = j.cifras;
      if (j && j.arp) R = Object.assign({}, R, j.arp);
      EN_VIVO = true; todo();
    }).catch(e => console.warn('Cifras en vivo no disponibles; quedan las del último corte.', e));
  }
  Promise.all([lee('../datos/cifras.json'), lee('../datos/comunas.json'), lee('../datos/arp.json').catch(() => ARP_VACIO)])
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
