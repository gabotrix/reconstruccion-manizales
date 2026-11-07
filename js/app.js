/* Reconstrucción de Manizales · información pública.
   Lee SOLO dos archivos de este mismo sitio (datos/cifras.json y datos/comunas.json), que se publican cada día con cifras
   sumadas. No habla con ningún otro servidor: la política de seguridad de la página (connect-src 'self') no lo deja.
   Las gráficas se dibujan aquí, sin librerías: barras en HTML, columnas y mapa en SVG; cada una con su globo de ayuda y
   su tabla. */
'use strict';
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const SVG = 'http://www.w3.org/2000/svg';
  const fmt = n => Math.round(n).toLocaleString('es-CO');
  const pct = (a, b) => b ? (100 * a / b).toLocaleString('es-CO', { maximumFractionDigits: 1 }) + ' %' : '—';
  const pctN = (a, b) => b ? 100 * a / b : 0;
  const millones = n => '$ ' + Math.round(n / 1e6).toLocaleString('es-CO');
  const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const diaCorto = iso => { const [, m, d] = iso.split('-').map(Number); return d + ' ' + MESES[m - 1]; };
  const fechaLarga = iso => new Date(iso + (iso.length === 10 ? 'T12:00:00-05:00' : '')).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Bogota' });
  const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  const RAMPA = ['--r1', '--r2', '--r3', '--r4', '--r5'];

  // un elemento con sus atributos y sus hijos (texto o elementos); los estilos van aparte, por el DOM
  function h(tag, at = {}, ...hijos) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(at)) { if (v == null || v === false) continue; if (k === 'class') e.className = v; else e.setAttribute(k, v === true ? '' : v); }
    for (const x of hijos.flat()) if (x != null && x !== false) e.append(x.nodeType ? x : String(x));
    return e;
  }
  function s(tag, at = {}) { const e = document.createElementNS(SVG, tag); for (const [k, v] of Object.entries(at)) e.setAttribute(k, v); return e; }
  const icono = d => { const e = s('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' }); e.innerHTML = d; return e; };
  const IC = {
    casa: '<path d="M3 21h18M5 21V8l7-5 7 5v13"/><path d="M9 21v-6h6v6"/>',
    alerta: '<path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>',
    llave: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-7.9 7.9l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 7.9-7.9z"/>',
    cerrado: '<rect x="3" y="11" width="18" height="10" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    mazo: '<path d="m15 12-8.4 8.4a2.1 2.1 0 0 1-3-3L12 9"/><path d="M17.6 15 22 10.6M20.9 11.7l-6.6-6.6a2 2 0 0 0-1.4-.6H10l1.3 1.3a2 2 0 0 1 0 2.8l-.6.6"/>',
    gente: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
    lupa: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    pesos: '<path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
  };

  // ---------- el globo de ayuda: con el mouse y con el teclado
  const globo = $('#globo');
  let conPuntero = false;   // al desplazar se esconde el globo del mouse; el del teclado se queda con su elemento
  function muestra(ev, titulo, linea) {
    globo.replaceChildren(h('b', {}, titulo), h('span', {}, linea)); globo.hidden = false;
    conPuntero = !!(ev && ev.clientX != null && ev.type !== 'focus');
    let x, y;
    if (ev && ev.clientX != null && ev.type !== 'focus') { x = ev.clientX; y = ev.clientY; }
    else { const r = (ev.currentTarget || ev.target).getBoundingClientRect(); x = r.left + r.width / 2; y = r.top; }
    const w = globo.offsetWidth, hh = globo.offsetHeight;
    globo.style.left = Math.max(8, Math.min(innerWidth - w - 8, x + 14)) + 'px';
    globo.style.top = (y - hh - 12 < 8 ? y + 18 : y - hh - 12) + 'px';
  }
  const esconde = () => { globo.hidden = true; };
  function conGlobo(el, titulo, linea) {
    el.addEventListener('pointermove', e => muestra(e, titulo, linea));
    el.addEventListener('pointerleave', esconde);
    el.addEventListener('focus', e => muestra(e, titulo, linea));
    el.addEventListener('blur', esconde);
  }
  addEventListener('scroll', () => { if (conPuntero) esconde(); }, { passive: true });

  // ---------- barras horizontales: [{l, sub, n, c, total}] → filas con su etiqueta, su barra y su valor
  function barras(cont, filas, { total, grupos } = {}) {
    const max = Math.max(...filas.map(f => f.n), 1);
    cont.replaceChildren();
    for (const f of filas) {
      if (grupos && f.grupo) cont.append(h('div', { class: 'grupo' }, f.grupo));
      const bar = h('span', { class: 'bar' });
      bar.style.width = (100 * f.n / max) + '%';
      bar.style.background = css(f.c) || f.c;
      const fila = h('div', { class: 'fila', tabindex: '0', 'aria-label': `${f.l}: ${fmt(f.n)}${total ? ' (' + pct(f.n, total) + ')' : ''}` },
        h('span', { class: 'etq' }, f.l, f.sub ? h('small', {}, f.sub) : null), h('span', { class: 'pista' }, bar),
        h('span', { class: 'v' }, fmt(f.n), total ? h('small', {}, pct(f.n, total)) : null));
      conGlobo(fila, f.l, fmt(f.n) + (f.unidad ? ' ' + f.unidad : '') + (total ? ' · ' + pct(f.n, total) + ' del total' : ''));
      cont.append(fila);
    }
  }

  // ---------- la barra segmentada: una sola totalidad partida en pocas partes
  function segmentos(cont, partes, unidad) {
    const T = partes.reduce((a, p) => a + p.n, 0), barra = h('div', { class: 'segmentos', role: 'img', 'aria-label': partes.map(p => `${p.l}: ${fmt(p.n)}`).join('; ') });
    for (const p of partes) {
      if (!p.n) continue;
      const b = h('div', { tabindex: '0', class: p.oscuro ? 'oscuro' : null });
      b.style.flex = p.n + ' 1 0'; b.style.background = css(p.c) || p.c;
      if (100 * p.n / T >= 9) b.textContent = pct(p.n, T);
      conGlobo(b, p.l, `${fmt(p.n)} ${unidad} · ${pct(p.n, T)}`);
      barra.append(b);
    }
    const ley = h('div', { class: 'leyenda' }, partes.map(p => { const i = h('i'); i.style.background = css(p.c) || p.c; return h('span', {}, i, `${p.l}: ${fmt(p.n)}`); }));
    cont.replaceChildren(barra, ley);
  }

  // ---------- columnas por semana (SVG), con la tabla
  function columnas(cont, serie, tablaCont) {
    const W = 640, H = 250, ml = 44, mr = 8, mt = 22, mb = 30, iw = W - ml - mr, ih = H - mt - mb;
    const max = Math.max(...serie.map(x => x[1]), 1), paso = Math.pow(10, Math.floor(Math.log10(max))), tope = Math.ceil(max / paso) * paso;
    const ticks = [0, tope / 2, tope], band = iw / serie.length, bw = Math.min(24, band * .55);
    const g = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'grafica', role: 'img', 'aria-label': 'Inmuebles valorados por semana: ' + serie.map(x => diaCorto(x[0]) + ' ' + fmt(x[1])).join('; ') });
    for (const t of ticks) {
      const y = mt + ih - ih * t / tope;
      g.append(s('line', { x1: ml, x2: W - mr, y1: y, y2: y, class: t ? 'rejilla-l' : 'base-l' }));
      const tx = s('text', { x: ml - 8, y: y + 4, 'text-anchor': 'end' }); tx.textContent = t >= 10000 ? fmt(t / 1000) + ' mil' : fmt(t); g.append(tx);
    }
    const iMax = serie.findIndex(x => x[1] === max), ultima = serie.length - 1;
    serie.forEach(([sem, n], i) => {
      const x = ml + band * i + (band - bw) / 2, bh = ih * n / tope, y = mt + ih - bh, r = Math.min(4, bh);
      const enCurso = i === ultima && (Date.parse(sem) + 7 * 864e5 > Date.parse(DATOS.corte));
      const col = s('path', { class: 'col', d: `M${x},${mt + ih}V${y + r}Q${x},${y} ${x + r},${y}H${x + bw - r}Q${x + bw},${y} ${x + bw},${y + r}V${mt + ih}Z` });
      if (enCurso) col.setAttribute('fill', css('--r1'));
      const zona = s('rect', { class: 'zona', x: ml + band * i, y: mt, width: band, height: ih, tabindex: '0' });
      const fin = new Date(Date.parse(sem + 'T12:00:00') + 6 * 864e5).toISOString().slice(0, 10);
      conGlobo(zona, `Semana del ${diaCorto(sem)} al ${diaCorto(fin)}`, `${fmt(n)} inmuebles valorados${enCurso ? ' (semana en curso)' : ''}`);
      zona.addEventListener('pointerenter', () => col.classList.add('on')); zona.addEventListener('pointerleave', () => col.classList.remove('on'));
      zona.addEventListener('focus', () => col.classList.add('on')); zona.addEventListener('blur', () => col.classList.remove('on'));
      g.append(col, zona);
      const lx = s('text', { x: ml + band * i + band / 2, y: H - 10, 'text-anchor': 'middle' }); lx.textContent = diaCorto(sem); g.append(lx);
      if (i === iMax || i === ultima) { const v = s('text', { x: x + bw / 2, y: y - 6, 'text-anchor': 'middle', class: 'valor' }); v.textContent = fmt(n); g.append(v); }
    });
    cont.replaceChildren(g);
    if (tablaCont) tablaCont.replaceChildren(h('table', {}, h('thead', {}, h('tr', {}, h('th', {}, 'Semana'), h('th', {}, 'Inmuebles valorados'))),
      h('tbody', {}, serie.map(([sem, n]) => h('tr', {}, h('td', {}, 'Del ' + diaCorto(sem)), h('td', {}, fmt(n))))),
      h('tfoot', {}, h('tr', {}, h('td', {}, 'Total'), h('td', {}, fmt(serie.reduce((a, x) => a + x[1], 0)))))));
  }

  // ---------- una tarjeta de cifra
  function cifra(etq, val, exp, ic, heroe) {
    const v = h('span', { class: 'val' }); v.append(...(Array.isArray(val) ? val : [val]));
    return h('div', { class: 'tarjeta cifra' + (heroe ? ' heroe' : '') }, ic ? h('span', { class: 'icono' }, icono(IC[ic])) : null, h('span', { class: 'etq' }, etq), v, exp ? h('span', { class: 'exp' }, exp) : null);
  }
  const dato = (k, v) => $$(`[data-dato="${k}"]`).forEach(e => { e.textContent = v; });

  // ---------- las categorías de la visita
  const CAT = {
    sin_dano: { l: 'Sin daños', d: 'Se puede habitar y no necesita reparación con el ARP.', arp: false, g: 'Se pueden habitar' },
    menor: { l: 'Daño menor', d: 'Se puede habitar, pero tiene daños que se reparan con el ARP.', arp: true, g: 'Se pueden habitar' },
    restringido: { l: 'Uso restringido', d: 'Se puede habitar, pero hay espacios que no se deben usar hasta repararlos.', arp: true, g: 'Se pueden habitar' },
    mayor: { l: 'Daño mayor', d: 'No se puede habitar hasta repararla. Incluye el colapso parcial.', arp: true, g: 'No se pueden habitar' },
    colapso: { l: 'Colapso total', d: 'La edificación se cayó. No se repara con el ARP.', arp: false, g: 'No se pueden habitar' },
    seguro: { l: 'Lo repara el seguro', d: 'El propietario no autorizó la evaluación porque la reparación la cubre su seguro.', arp: false, g: 'Sin evaluar' },
    sin_acceso: { l: 'Sin acceso al predio', d: 'Nadie atendió la visita o el predio estaba cerrado. Queda pendiente de evaluar.', arp: false, g: 'Sin evaluar' },
  };
  const ORDEN = ['sin_dano', 'menor', 'restringido', 'mayor', 'colapso', 'seguro', 'sin_acceso'];

  let DATOS = null, GEO = null;

  function pinta(C) {
    const corte = new Date(C.corte);
    const corteTxt = corte.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Bogota' }) + ', ' +
      corte.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Bogota' });
    dato('corte', corteTxt); dato('corte-largo', 'Última actualización: ' + corteTxt + '.');
    const I = C.inmuebles, T = I.total, P = I.por_categoria, NOH = P.mayor + P.colapso, AF = C.afectados.niveles.reduce((a, x) => a + x[1], 0);

    // 1 · lo esencial
    $('#kpis').replaceChildren(
      cifra('Inmuebles valorados por los ingenieros', fmt(T), `Visitados por ${C.equipo.ingenieros} ingenieros desde el ${fechaLarga(C.equipo.desde)}.`, 'lupa', true),
      cifra('Predios afectados por el sismo', fmt(AF), 'Estimación de la Alcaldía de Manizales.', 'casa'),
      cifra('Requieren reparación con ARP', fmt(C.arp.requieren), `${pct(C.arp.requieren, T)} de los inmuebles valorados.`, 'llave'),
      cifra('No se pueden habitar hoy', fmt(NOH), `Daño mayor (${fmt(P.mayor)}) y colapso total (${fmt(P.colapso)}).`, 'alerta'),
      cifra('Expedientes de demolición', fmt(C.demoliciones.expedientes), `${fmt(C.demoliciones.demolidas)} ya demolidos; los demás, en proceso.`, 'mazo'),
      cifra('Viviendas en el RUD', fmt(C.familias.viviendas), `${fmt(C.familias.personas)} personas viven en ellas.`, 'gente'));
    dato('paso1', `${fmt(AF)} predios afectados · ${fmt(C.familias.viviendas)} viviendas en el RUD`);
    dato('paso2', `${fmt(T)} inmuebles valorados`);
    dato('paso3', `${fmt(T - NOH - P.seguro - P.sin_acceso)} habitables · ${fmt(NOH)} no habitables`);
    dato('paso4', `${fmt(C.arp.requieren)} al ARP · ${fmt(C.demoliciones.expedientes)} expedientes de demolición`);

    // 2 · predios afectados (Alcaldía), de mayor a menor impacto
    const ORD_AF = ['Reconstrucción', 'Impacto alto', 'Impacto medio', 'Impacto bajo'];
    const niv = [...C.afectados.niveles].sort((a, b) => ORD_AF.indexOf(a[0]) - ORD_AF.indexOf(b[0]));
    dato('afectados-total', `${fmt(AF)} predios afectados`);
    barras($('#g-afectados'), niv.map(([l, n], i) => ({ l, n, c: RAMPA[4 - i] || '--r1', unidad: 'predios' })), { total: AF });
    dato('afectados-fuente', `Fuente: ${C.afectados.fuente}${C.afectados.fecha ? ', ' + fechaLarga(C.afectados.fecha) : ''}. No sale de las visitas técnicas: es la estimación oficial de la afectación en toda la ciudad.`);

    // 3 · visitas por semana
    columnas($('#g-semanas'), C.semanas.inmuebles, $('#t-semanas'));
    dato('ingenieros', fmt(C.equipo.ingenieros));
    dato('ingenieros-exp', `Del ${fechaLarga(C.equipo.desde)} al ${fechaLarga(C.equipo.hasta)}.`);
    const tipos = $('[data-dato="tipos"]'); tipos.replaceChildren(fmt(I.edificios), h('small', {}, ' en edificios · '), fmt(I.casas), h('small', {}, ' casas'));

    // 4 · resultados
    dato('resultados-total', `${fmt(T)} inmuebles valorados`);
    barras($('#g-resultados'), ORDEN.map(k => ({ l: CAT[k].l, n: P[k], c: CAT[k].arp ? '--r3' : '--gris-dato', grupo: ORDEN.find(x => CAT[x].g === CAT[k].g) === k ? CAT[k].g : null, unidad: 'inmuebles' })), { total: T, grupos: true });
    $('#glosario').replaceChildren(...ORDEN.map(k => { const i = h('i'); i.style.background = css(CAT[k].arp ? '--r3' : '--gris-dato');
      return h('div', { class: 'cat' }, h('div', { class: 't' }, i, CAT[k].l), h('p', {}, CAT[k].d), h('span', { class: 'etiqueta' + (CAT[k].arp ? '' : ' no') }, CAT[k].arp ? 'Requiere ARP' : CAT[k].g === 'Sin evaluar' ? 'Sin evaluar' : 'No requiere ARP')); }));

    // 5 · por comuna
    pintaComunas(C);

    // 6 · reparación (ARP)
    const A = C.arp;
    $('#kpis-arp').replaceChildren(
      cifra('Requieren ARP', fmt(A.requieren), 'Daño menor, uso restringido y daño mayor.', 'llave'),
      cifra('Ya tienen presupuesto de obra', fmt(A.con_presupuesto), `${pct(A.con_presupuesto, A.requieren)} de los que requieren ARP.`, 'lupa'),
      cifra('Costo estimado de reparación', [millones(A.crr), h('small', {}, ' millones')], `De los ${fmt(A.con_presupuesto)} con presupuesto de obra.`, 'pesos'),
      cifra('Costo promedio por inmueble', ['$ ' + (A.crr / Math.max(1, A.con_presupuesto) / 1e6).toLocaleString('es-CO', { maximumFractionDigits: 1 }), h('small', {}, ' millones')], 'Con la lista de precios vigente de la Alcaldía.', 'casa'));
    const R = A.revision;
    dato('revision-sub', `Los ${fmt(A.con_presupuesto)} presupuestos de obra, según su revisión`);
    segmentos($('#g-revision'), [{ l: 'Verificado', n: R.verificado, c: '--r5' }, { l: 'En revisión', n: R.en_revision, c: '--r3' }, { l: 'Sin revisar', n: R.sin_revisar, c: '--r1', oscuro: true }], 'presupuestos');
    const K = ['menor', 'restringido', 'mayor'];
    $('#t-arp').replaceChildren(h('table', {}, h('thead', {}, h('tr', {}, h('th', {}, 'Tipo de daño'), h('th', {}, 'Inmuebles'), h('th', {}, 'Con presupuesto'), h('th', {}, 'Costo estimado'))),
      h('tbody', {}, K.map(k => { const x = A.por_categoria[k]; return h('tr', {}, h('td', {}, CAT[k].l), h('td', {}, fmt(x.inmuebles)), h('td', {}, fmt(x.con_presupuesto)), h('td', {}, millones(x.crr) + ' M')); })),
      h('tfoot', {}, h('tr', {}, h('td', {}, 'Total'), h('td', {}, fmt(A.requieren)), h('td', {}, fmt(A.con_presupuesto)), h('td', {}, millones(A.crr) + ' M')))));

    // 7 · demoliciones
    const D = C.demoliciones;
    $('#kpis-dem').replaceChildren(
      cifra('Expedientes de demolición', fmt(D.expedientes), 'Del programa de demoliciones de la ciudad.', 'mazo'),
      cifra('Ya demolidos', fmt(D.demolidas), `${fmt(D.por_municipio)} por el municipio y ${fmt(D.por_particular)} por particulares.`, 'casa'),
      cifra('En proceso', fmt(D.expedientes - D.demolidas), 'Entre la solicitud y la obra.', 'lupa'),
      cifra('Valor estimado', [millones(D.valor_estimado), h('small', {}, ' millones')], 'Suma del valor estimado de los expedientes que ya lo tienen.', 'pesos'));
    barras($('#g-fases'), D.fases.map((f, i) => ({ l: f.l, n: f.n, c: RAMPA[i], unidad: 'expedientes' })), { total: D.expedientes });
    const ORD_CL = ['Demolición total de vivienda', 'Demolición total de edificio', 'Demolición parcial', 'Por definir'];
    barras($('#g-clas'), [...D.clasificacion].sort((a, b) => ORD_CL.indexOf(a.l) - ORD_CL.indexOf(b.l)).map(x => ({ l: x.l, n: x.n, c: x.l === 'Por definir' ? '--gris-dato' : '--r4', unidad: 'expedientes' })), { total: D.expedientes });

    // 8 · lluvias
    const LR = C.lluvias.predios_por_riesgo, TL = Object.values(LR).reduce((a, n) => a + n, 0);
    barras($('#g-lluvias'), [['inminente', 'Riesgo inminente', '--critico'], ['alto', 'Riesgo alto', '--serio'], ['medio', 'Riesgo medio', '--aviso'], ['bajo', 'Riesgo bajo', '--r2'], ['sin', 'Sin afectación', '--sin']]
      .map(([k, l, c]) => ({ l, n: LR[k], c, unidad: 'predios' })), { total: TL });
    dato('lluvias', fmt(C.lluvias.visitas));

    // 9 · familias
    $('#kpis-rud').replaceChildren(
      cifra('Viviendas registradas', fmt(C.familias.viviendas), 'Hogares con su vivienda afectada en el RUD.', 'casa'),
      cifra('Personas en esas viviendas', fmt(C.familias.personas), 'Los integrantes de los hogares registrados.', 'gente'),
      cifra('Bienes registrados', fmt(C.familias.registros), 'Viviendas, locales, bodegas, fincas y otros bienes.', 'lupa'));
  }

  // ---------- el mapa de comunas
  let METRICA = 'noh', SEL = null;
  const MIN_N = 20;   // con menos inmuebles valorados una proporción no dice mucho: la comuna va rayada
  const valorDe = (c, m) => m === 'n' ? c.inmuebles : m === 'noh' ? pctN(c.no_habitables, c.inmuebles) : pctN(c.arp, c.inmuebles);
  const textoDe = (c, m) => m === 'n' ? fmt(c.inmuebles) + ' inmuebles valorados' : m === 'noh' ? pct(c.no_habitables, c.inmuebles) + ' no habitables (' + fmt(c.no_habitables) + ')' : pct(c.arp, c.inmuebles) + ' requieren ARP (' + fmt(c.arp) + ')';
  function cortes(vals) {   // 5 tramos por cuantiles, sin repetir
    const v = [...vals].sort((a, b) => a - b), q = [1, 2, 3, 4].map(i => v[Math.min(v.length - 1, Math.floor(i * v.length / 5))]);
    return q.filter((x, i) => i === 0 || x > q[i - 1]);
  }
  function pintaComunas(C) {
    const caja = $('#mapa'), cs = C.comunas, porClave = Object.fromEntries(cs.map(c => [c.clave, c]));
    // los contornos vienen con la y hacia arriba (negativa): el lienzo va de -h a 0 y los rótulos van en -y
    const g = s('svg', { viewBox: `-4 ${-GEO.h - 4} ${GEO.w + 8} ${GEO.h + 8}`, 'aria-hidden': 'true' });
    const defs = s('defs'), pat = s('pattern', { id: 'rayas', width: '6', height: '6', patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' });
    pat.append(s('rect', { width: '6', height: '6', fill: '#f3f5f8' }), s('rect', { width: '3', height: '6', fill: '#dfe4eb' })); defs.append(pat); g.append(defs);
    const capaP = s('g'), capaR = s('g');
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
      const t = s('text', { x: z.x, y: -z.y + 3, 'text-anchor': 'middle', class: 'rot', 'data-c': z.clave }); t.textContent = c.num; capaR.append(t);
    }
    g.append(capaP, capaR); caja.replaceChildren(g);
    $$('#metricas button').forEach(b => b.addEventListener('click', () => { METRICA = b.dataset.m; $$('#metricas button').forEach(x => x.setAttribute('aria-pressed', String(x === b))); colorea(); }));
    colorea();
    elige(SEL || [...cs].sort((a, b) => b.inmuebles - a.inmuebles)[0].clave);
    // la zona rural y lo que no se pudo ubicar
    const RU = C.rural;
    $('#rural').replaceChildren(...(RU ? [icono(IC.casa), h('span', {}, h('b', {}, 'Zona rural: '), `${fmt(RU.inmuebles)} inmuebles valorados · ${fmt(RU.no_habitables)} no habitables (${pct(RU.no_habitables, RU.inmuebles)}) · ${fmt(RU.arp)} requieren ARP (${pct(RU.arp, RU.inmuebles)}).`)] : []));
    // la tabla de todas
    const filas = [...cs, ...(RU ? [Object.assign({ nombre: 'Zona rural', num: '' }, RU)] : []), ...(C.sin_ubicar ? [Object.assign({ nombre: 'Sin ubicar', num: '' }, C.sin_ubicar)] : [])];
    const tot = k => filas.reduce((a, c) => a + c[k], 0);
    $('#t-comunas').replaceChildren(h('table', {}, h('thead', {}, h('tr', {}, h('th', {}, 'Comuna'), h('th', {}, 'Inmuebles valorados'), h('th', {}, 'No habitables'), h('th', {}, '%'), h('th', {}, 'Requieren ARP'), h('th', {}, '%'))),
      h('tbody', {}, filas.map(c => h('tr', {}, h('td', {}, (c.num ? c.num + ' · ' : '') + c.nombre), h('td', {}, fmt(c.inmuebles)), h('td', {}, fmt(c.no_habitables)), h('td', {}, pct(c.no_habitables, c.inmuebles)), h('td', {}, fmt(c.arp)), h('td', {}, pct(c.arp, c.inmuebles))))),
      h('tfoot', {}, h('tr', {}, h('td', {}, 'Total'), h('td', {}, fmt(tot('inmuebles'))), h('td', {}, fmt(tot('no_habitables'))), h('td', {}, pct(tot('no_habitables'), tot('inmuebles'))), h('td', {}, fmt(tot('arp'))), h('td', {}, pct(tot('arp'), tot('inmuebles')))))));
  }
  function colorea() {
    const ps = $$('#mapa path'), validas = ps.map(p => p.__c).filter(c => METRICA === 'n' || c.inmuebles >= MIN_N);
    const br = cortes(validas.map(c => valorDe(c, METRICA))), clase = v => br.filter(b => v >= b).length;
    const cols = RAMPA.slice(5 - (br.length + 1));
    for (const p of ps) {
      const c = p.__c, pocos = METRICA !== 'n' && c.inmuebles < MIN_N;
      p.classList.toggle('pocos', pocos);
      const k = clase(valorDe(c, METRICA));
      p.setAttribute('fill', pocos ? 'url(#rayas)' : css(cols[k]));
      p.setAttribute('aria-label', `Comuna ${c.num}, ${c.nombre}: ${pocos ? 'solo ' + fmt(c.inmuebles) + ' inmuebles valorados' : textoDe(c, METRICA)}`);
      const t = $(`#mapa text[data-c="${CSS.escape(c.clave)}"]`); if (t) t.classList.toggle('claro', pocos || k <= 1);
    }
    // la escala
    const f = v => METRICA === 'n' ? fmt(v) : Math.round(v) + ' %';
    const tramos = h('span', { class: 'tramos' }, cols.map(c => { const i = h('i'); i.style.background = css(c); return i; }));
    $('#escala').replaceChildren(h('span', {}, 'Menos'), tramos, h('span', {}, 'Más'), h('span', {}, `· tramos: ${br.map(f).join(', ')}`),
      METRICA !== 'n' ? h('span', {}, h('span', { class: 'rayas' }), '') : null, METRICA !== 'n' ? h('span', {}, `Menos de ${MIN_N} inmuebles valorados`) : null);
  }
  function elige(clave) {
    SEL = clave;
    $$('#mapa path').forEach(p => p.classList.toggle('on', p.dataset.c === clave));
    const p = $$('#mapa path').find(x => x.dataset.c === clave); if (!p) return;
    p.parentNode.append(p);   // el borde del elegido, encima de los vecinos
    const c = p.__c;
    const filas = h('div', { class: 'barras' });
    $('#ficha').replaceChildren(
      h('div', { class: 'titulo' }, h('h3', {}, `Comuna ${c.num} · ${c.nombre}`)),
      h('div', { class: 'mini' },
        h('div', {}, h('b', {}, fmt(c.inmuebles)), h('span', {}, 'inmuebles valorados')),
        h('div', {}, h('b', {}, pct(c.no_habitables, c.inmuebles)), h('span', {}, `no habitables (${fmt(c.no_habitables)})`)),
        h('div', {}, h('b', {}, pct(c.arp, c.inmuebles)), h('span', {}, `requieren ARP (${fmt(c.arp)})`))),
      ...(c.inmuebles < MIN_N ? [h('p', { class: 'nota' }, `Con solo ${fmt(c.inmuebles)} inmuebles valorados, las proporciones de esta comuna cambian mucho con cada visita.`)] : []),
      filas);
    barras(filas, ORDEN.filter(k => (c.cats || {})[k]).map(k => ({ l: CAT[k].l, n: c.cats[k], c: CAT[k].arp ? '--r3' : '--gris-dato', unidad: 'inmuebles' })), { total: c.inmuebles });
  }

  // ---------- menú y sección activa
  const menu = $('#menu'), nav = $('#nav');
  menu.addEventListener('click', () => { const ab = nav.classList.toggle('abierta'); menu.setAttribute('aria-expanded', String(ab)); });
  $$('#nav a').forEach(a => a.addEventListener('click', () => { nav.classList.remove('abierta'); menu.setAttribute('aria-expanded', 'false'); }));
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) $$('#nav a').forEach(a => a.classList.toggle('on', a.getAttribute('href') === '#' + e.target.id)); }), { rootMargin: '-45% 0px -50% 0px' });
    $$('section.bloque[id]').forEach(x => io.observe(x));
  }

  // ---------- los datos
  Promise.all(['datos/cifras.json', 'datos/comunas.json'].map(u => fetch(u, { cache: 'no-cache' }).then(r => { if (!r.ok) throw new Error(u + ': ' + r.status); return r.json(); })))
    .then(([c, g]) => { DATOS = c; GEO = g; pinta(c); })
    .catch(e => { console.error(e); $('#kpis').replaceChildren(h('p', { class: 'error-datos' }, 'No se pudieron cargar las cifras. Intente de nuevo en unos minutos.')); });
})();
