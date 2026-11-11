/* Ventanilla única de la reconstrucción de Manizales.
   Habla con UNA sola función (API) por POST con JSON y nada más: sin cabeceras extra, sin cookies, sin referer.
   Cuatro trámites con ancla propia (#consultar, #pedir-visita, #seguimiento, #ayudas); la tarjeta del trámite abre su
   sección. Validación al salir del campo (no en cada tecla), aria-invalid + aria-describedby, foco al primer error o al
   resumen al enviar. Todo el contenido que viene del servidor se pinta con textContent. */
'use strict';

const API = 'https://api.manizalesconstruye.camacolcaldas.com/functions/v1/ventanilla';
const ESPERA_MS = 20000;

(() => {
  const $ = (q, r = document) => r.querySelector(q);
  const $$ = (q, r = document) => [...r.querySelectorAll(q)];
  const SVGNS = 'http://www.w3.org/2000/svg';
  const reducido = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function h(tag, at = {}, ...hijos) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(at)) {
      if (v == null || v === false) continue;
      if (k === 'class') e.className = v; else e.setAttribute(k, v === true ? '' : v);
    }
    for (const x of hijos.flat()) if (x != null && x !== false) e.append(x.nodeType ? x : String(x));
    return e;
  }
  // íconos sencillos en SVG (trazos)
  const TRAZOS = {
    ok: 'M20 6 9 17l-5-5',
    alerta: 'M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
    info: 'M12 16v-4M12 8h.01M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z',
    casa: 'M3 11 12 4l9 7M5 10v10h14V10M9 15l2 2 4-4',
    alto: 'M7.9 2h8.2L22 7.9v8.2L16.1 22H7.9L2 16.1V7.9zM12 8v4M12 16h.01',
    copiar: 'M9 9h11v11H9zM5 15H4V4h11v1',
    flecha: 'M5 12h14M13 6l6 6-6 6',
    lupa: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-3.5-3.5',
    otra: 'M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5'
  };
  function icono(n) {
    const s = document.createElementNS(SVGNS, 'svg'); s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('aria-hidden', 'true');
    const p = document.createElementNS(SVGNS, 'path'); p.setAttribute('d', TRAZOS[n]); s.append(p); return s;
  }
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  function fecha(s) {
    if (!s) return '';
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s));
    return m ? `${+m[3]} de ${MESES[+m[2] - 1]} de ${m[1]}` : String(s);
  }
  const mayus = s => { s = String(s || '').trim(); return s ? s[0].toUpperCase() + s.slice(1) : s; };
  const soloDigitos = v => String(v || '').replace(/\D/g, '');

  // ---------- menú del celular (igual que la página pública)
  const menu = $('#menu'), nav = $('#nav');
  const cierraMenu = () => { nav.classList.remove('abierta'); menu.setAttribute('aria-expanded', 'false'); menu.setAttribute('aria-label', 'Abrir el menú'); };
  menu.addEventListener('click', () => {
    const ab = nav.classList.toggle('abierta');
    menu.setAttribute('aria-expanded', String(ab)); menu.setAttribute('aria-label', ab ? 'Cerrar el menú' : 'Abrir el menú');
  });
  $$('#nav a').forEach(a => a.addEventListener('click', cierraMenu));
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && nav.classList.contains('abierta')) { cierraMenu(); menu.focus(); } });

  // ---------- los cuatro trámites: cada uno se abre con su ancla
  const SECCIONES = ['consultar', 'pedir-visita', 'seguimiento', 'ayudas'];
  function abre(id, enfoca) {
    SECCIONES.forEach(s => { document.getElementById(s).hidden = s !== id; });
    $$('.tarjeta-v, #nav a').forEach(a => {
      if (a.getAttribute('href') === '#' + id) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
    });
    $('#elija').hidden = true;
    if (enfoca) {
      const sec = document.getElementById(id);
      sec.querySelector('h2').focus({ preventScroll: true });
      sec.scrollIntoView({ behavior: reducido() ? 'auto' : 'smooth', block: 'start' });
    }
  }
  const desdeAncla = enfoca => { const id = decodeURIComponent(location.hash.slice(1)); if (SECCIONES.includes(id)) abre(id, enfoca); };
  window.addEventListener('hashchange', () => desdeAncla(true));
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href').slice(1);
    if (SECCIONES.includes(id) && location.hash === '#' + id) { e.preventDefault(); abre(id, true); }
  });
  desdeAncla(true);

  // ---------- validación: al salir del campo, y al enviar
  const anunciador = $('#anunciador');
  let tAnuncio;
  const anuncia = txt => { clearTimeout(tAnuncio); anunciador.textContent = ''; tAnuncio = setTimeout(() => { anunciador.textContent = txt; }, 500); };

  const MSG_CEDULA = 'La cédula debe tener entre 5 y 12 números. Escríbala completa, sin puntos ni letras.';
  const REGLAS = {
    busqueda: el => {
      const v = el.value.trim();
      if (!v) return 'Escriba la dirección o el número predial del predio.';
      const d = v.replace(/[\s.\-]/g, '');
      if (/^\d+$/.test(d) && (d.length < 20 || d.length > 30))
        return `El número predial tiene de 20 a 30 dígitos y usted escribió ${d.length}. Revíselo en el recibo del impuesto predial, o busque por dirección.`;
      if (v.length < 4) return 'Escriba al menos la calle y el número, por ejemplo Calle 22 # 24-11.';
      return '';
    },
    cedula: el => {
      const v = el.value.trim();
      if (!v) return 'Escriba el número de la cédula.';
      if (/[^\d.\s]/.test(v)) return 'Escriba solo los números de la cédula, sin letras ni signos.';
      const d = soloDigitos(v);
      return d.length < 5 || d.length > 12 ? MSG_CEDULA : '';
    },
    nombre: el => {
      const v = el.value.trim();
      if (!v) return 'Escriba su nombre completo.';
      return v.length < 3 || !/\p{L}/u.test(v) ? 'Escriba su nombre completo, como aparece en la cédula.' : '';
    },
    celular: el => {
      const v = el.value.trim();
      if (!v) return 'Escriba su número de celular.';
      let d = soloDigitos(v); if (d.length === 12 && d.startsWith('57')) d = d.slice(2);
      return /^(3\d{9}|60\d{8})$/.test(d) ? '' : 'Escriba el celular de 10 dígitos, que empieza por 3. Por ejemplo: 310 555 0000.';
    },
    correo: el => {
      const v = el.value.trim();
      if (!v) return '';
      return el.validity.typeMismatch || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v) ? 'Escriba el correo completo, por ejemplo nombre@correo.com, o déjelo vacío.' : '';
    },
    direccion: el => el.value.trim().length < 6 ? 'Escriba la dirección del predio, por ejemplo Carrera 23 # 30-15.' : '',
    barrio: el => el.value.trim().length < 2 ? 'Escriba el barrio o la vereda donde queda el predio.' : '',
    dano: el => el.value.trim().length < 10 ? 'Cuéntenos el daño con al menos 10 letras. Por ejemplo: grieta grande en el muro de la cocina.' : '',
    autoriza: el => el.checked ? '' : 'Para enviar la solicitud debe marcar la autorización de datos.',
    radicado: el => {
      if (!el.value.trim()) return 'Escriba el número de radicado.';
      return normalizaRadicado(el.value) ? '' : 'Escriba el radicado como aparece en su constancia, por ejemplo VU-2026-00001.';
    }
  };
  const MSG_GRUPO = {
    'c-predios-grupo': 'Elija su predio en la lista. Si no aparece, búsquelo de nuevo con otras palabras.',
    'p-calidad-grupo': 'Elija quién pide la visita.',
    'p-predios-grupo': 'Busque el predio y elíjalo en la lista, o marque «No lo encuentro» y escriba la dirección.',
    'p-peligro-grupo': 'Responda si hay peligro de que se caiga algo.'
  };

  function normalizaRadicado(v) {
    const s = String(v || '').toUpperCase().replace(/[\s_./]/g, '').replace(/[–—]/g, '-');
    const m = /^(?:VU)?-?(20\d{2})-?(\d{1,5})$/.exec(s);
    return m && +m[2] > 0 ? `VU-${m[1]}-${m[2].padStart(5, '0')}` : null;
  }

  const esGrupo = el => el.matches('fieldset.grupo-radios');
  const visible = el => !el.closest('[hidden]');
  function mensajeDe(el) {
    if (!visible(el)) return '';
    if (esGrupo(el)) return $$('input', el).some(i => i.checked) ? '' : (MSG_GRUPO[el.id] || 'Elija una opción.');
    const r = REGLAS[el.dataset.valida];
    return r ? r(el) : '';
  }
  // Lista el error en aria-describedby solo mientras se muestra
  function enlazaError(c, idError, mostrado) {
    const ids = (c.getAttribute('aria-describedby') || '').split(/\s+/).filter(x => x && x !== idError);
    if (mostrado) ids.push(idError);
    if (ids.length) c.setAttribute('aria-describedby', ids.join(' ')); else c.removeAttribute('aria-describedby');
  }
  function marca(el, msg) {
    const idError = el.dataset.error, err = document.getElementById(idError);
    const controles = esGrupo(el) ? $$('input', el) : [el];
    err.textContent = msg; err.hidden = !msg;
    controles.forEach(c => {
      c.setAttribute('aria-invalid', msg ? 'true' : 'false');
      enlazaError(c, idError, !!msg);
      if (c.setCustomValidity && c.type !== 'radio') c.setCustomValidity(msg);
    });
    (el.closest('.campo') || el).classList.toggle('invalido', !!msg);
  }
  const unidad = c => c.closest('fieldset.grupo-radios[data-error]') || (c.dataset && c.dataset.valida ? c : null);
  const tocados = new WeakSet();
  const invalido = el => (esGrupo(el) ? $('input', el) : el).getAttribute('aria-invalid') === 'true';

  function preparaValidacion(form) {
    $$('[data-valida], fieldset.grupo-radios[data-error]', form).forEach(el => (esGrupo(el) ? $$('input', el) : [el]).forEach(c => c.setAttribute('aria-invalid', 'false')));
    form.addEventListener('input', e => {
      const u = unidad(e.target); if (!u) return;
      tocados.add(u);
      if (invalido(u)) { const m = mensajeDe(u); if (!m) marca(u, ''); }   // al escribir solo se limpia
    });
    form.addEventListener('change', e => {
      const u = unidad(e.target); if (!u) return;
      tocados.add(u);
      if (esGrupo(u) || e.target.type === 'checkbox') marca(u, mensajeDe(u));
    });
    form.addEventListener('focusout', e => {
      const u = unidad(e.target); if (!u || esGrupo(u)) return;
      if (!tocados.has(u) && !invalido(u)) return;
      if (u.id === 'p-q' && !u.value.trim()) { marca(u, ''); return; }   // el buscador de la solicitud no es obligatorio
      const m = mensajeDe(u), antes = invalido(u);
      marca(u, m);
      if (m && !antes) anuncia(`${u.labels && u.labels[0] ? u.labels[0].textContent.trim() + ': ' : ''}${m}`);
    });
  }
  // Revisa todo lo visible del formulario. Devuelve la lista de errores [{el, msg}].
  function revisaTodo(form, excluye = []) {
    const errores = [];
    $$('[data-valida], fieldset.grupo-radios[data-error]', form).forEach(el => {
      if (excluye.includes(el) || (!esGrupo(el) && el.closest('fieldset.grupo-radios'))) return;
      const m = mensajeDe(el); marca(el, m); if (m) errores.push({ el, msg: m });
    });
    return errores;
  }
  const controlDe = el => esGrupo(el) ? ($('input:checked', el) || $('input', el)) : el;
  function limpia(form) { $$('[data-valida], fieldset.grupo-radios[data-error]', form).forEach(el => { marca(el, ''); tocados.delete(el); }); }

  // ---------- la API
  async function api(cuerpo) {
    const ctrl = new AbortController(), t = setTimeout(() => ctrl.abort(), ESPERA_MS);
    try {
      const r = await fetch(API, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo),
        signal: ctrl.signal, credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'no-store', mode: 'cors'
      });
      let d = null; try { d = await r.json(); } catch (_) { d = null; }
      if (r.ok && d && typeof d === 'object') return { ok: true, d };
      return { ok: false, status: r.status, error: d && d.error };
    } catch (_) {
      return { ok: false, status: 0, error: 'red' };
    } finally { clearTimeout(t); }
  }
  const MSG_CAIDO = 'El servicio no responde en este momento. Intente de nuevo en unos minutos; si hay peligro, llame al 123.';
  function textoError(res) {
    if (res.status === 429 || res.error === 'demasiados') return 'Hizo demasiados intentos. Espere una hora y vuelva a intentarlo.';
    if (res.status === 400 && res.error === 'datos') return 'Faltan datos o alguno está mal escrito. Revíselos y vuelva a intentarlo.';
    if (res.status === 400 && res.error === 'predio') return 'No encontramos ese predio. Búsquelo de nuevo, o marque «No lo encuentro» y escriba la dirección.';
    if (res.status === 400 && res.error === 'autoriza') return 'Debe marcar la autorización de datos para enviar la solicitud.';
    return MSG_CAIDO;
  }
  const aviso = (tipo, ...hijos) => h('div', { class: 'aviso ' + tipo }, icono(tipo === 'ok' ? 'ok' : tipo === 'malo' ? 'alerta' : 'info'), h('div', {}, ...hijos));
  const pinta = (estado, ...nodos) => estado.replaceChildren(...nodos);
  const cargando = (estado, txt) => pinta(estado, h('p', { class: 'cargando' }, txt || 'Consultando…'));

  // Corre una petición con el botón deshabilitado (solo después de un envío válido) y el estado «Consultando…»
  async function conEspera(boton, estado, txt, cuerpo) {
    boton.disabled = true;
    const zona = boton.form || boton.closest('form'); if (zona) zona.setAttribute('aria-busy', 'true');
    cargando(estado, txt);
    try { return await api(cuerpo); }
    finally { boton.disabled = false; if (zona) zona.removeAttribute('aria-busy'); }
  }

  // ---------- el buscador de predios (lo usan «Consultar» y «Pedir una visita»)
  function opcionPredio(p, nombre) {
    const lugar = [p.barrio && `Barrio ${p.barrio}`, p.comuna && `Comuna ${p.comuna}`].filter(Boolean).join(' · ');
    const u = +p.unidades || 0;
    return h('label', { class: 'opcion predio-op' },
      h('input', { type: 'radio', name: nombre, value: p.id22, required: true }),
      h('span', { class: 'op-txt' },
        h('b', {}, p.direccion || 'Predio sin dirección registrada'),
        lugar && h('small', {}, lugar),
        u > 1 && h('span', { class: 'op-unid' }, `Edificio con ${u.toLocaleString('es-CO')} unidades`)));
  }
  function avisoSinPredios(q, aviso_, enPedir) {
    if (aviso_ === 'npn_corto')
      return aviso('info', h('p', {}, h('b', {}, 'El número predial está incompleto.'), ' Debe tener de 20 a 30 dígitos. Revíselo en el recibo del impuesto predial, o busque por dirección.'));
    return aviso('info',
      h('p', {}, h('b', {}, `No encontramos predios con «${q}».`)),
      h('p', {}, 'Pruebe escribiendo solo la calle y el número, por ejemplo «Calle 22 # 24-11», sin barrio ni ciudad.'),
      h('p', {}, enPedir ? 'Si no aparece, marque «No lo encuentro» y escriba la dirección.' : h('span', {}, 'Si su predio no aparece, puede ', h('a', { href: '#pedir-visita' }, 'pedir una visita técnica'), '.')));
  }

  // ================= 1. CONSULTAR MI PREDIO =================
  const fBuscar = $('#f-buscar'), fConsultar = $('#f-consultar'), bQ = $('#b-q'), bEstado = $('#b-estado');
  const cPredios = $('#c-predios'), cResultado = $('#c-resultado');
  preparaValidacion(fBuscar); preparaValidacion(fConsultar);
  function pasoConsulta(n) {
    const p1 = $('#c-paso-1'), p2 = $('#c-paso-2');
    p1.classList.toggle('hecho', n > 1); p2.classList.toggle('hecho', n > 2);
    [p1, p2].forEach((p, i) => { if (n === i + 1) p.setAttribute('aria-current', 'step'); else p.removeAttribute('aria-current'); });
  }
  fBuscar.addEventListener('submit', async e => {
    e.preventDefault();
    const errores = revisaTodo(fBuscar);
    if (errores.length) { controlDe(errores[0].el).focus(); return; }
    const boton = $('button[type="submit"]', fBuscar), q = bQ.value.trim();
    cResultado.replaceChildren();
    const res = await conEspera(boton, bEstado, 'Buscando el predio…', { accion: 'buscar', q });
    if (!res.ok) { fConsultar.hidden = true; pasoConsulta(1); pinta(bEstado, aviso('malo', h('p', {}, textoError(res)))); return; }
    const predios = Array.isArray(res.d.predios) ? res.d.predios : [];
    if (!predios.length) { fConsultar.hidden = true; pasoConsulta(1); pinta(bEstado, avisoSinPredios(q, res.d.aviso, false)); return; }
    cPredios.replaceChildren(...predios.map(p => opcionPredio(p, 'id22')));
    if (predios.length === 1) $('input', cPredios).checked = true;
    marca($('#c-predios-grupo'), '');
    fConsultar.hidden = false; pasoConsulta(2);
    pinta(bEstado, h('p', { class: 'nota' }, predios.length === 1
      ? 'Encontramos 1 predio. Ahora confirme con una cédula.'
      : `Encontramos ${predios.length} predios. Elija el suyo y confirme con una cédula.`));
  });

  const ALCANCE = {
    todo: 'Visita a todo el predio',
    zonas_comunes: 'Visita a las zonas comunes del edificio',
    ficha: 'Visita a una unidad'
  };
  // Clave del dictamen → [texto, tono, qué sigue]. El «qué sigue» es borrador: prudente, sin montos ni plazos.
  const DICTAMEN = {
    habitable: ['Se puede habitar', 'bien', 'Puede seguir en su vivienda. Si aparecen grietas nuevas o el daño crece, pida una nueva visita.'],
    habitable_dano_menor: ['Se puede habitar; tiene daño menor', 'cuidado', 'Puede seguir en su vivienda. El daño menor puede entrar al aporte a la reparación (ARP): el equipo revisa el presupuesto de obra y le contará los pasos siguientes.'],
    restringido_habitable: ['Uso restringido: se puede habitar con cuidado', 'cuidado', 'Use solo las partes de la vivienda que el ingeniero indicó y no entre a las zonas dañadas. La reparación se revisa con el ARP.'],
    restringido_no_habitable: ['Uso restringido: no se puede habitar por ahora', 'grave', 'Por ahora no habite la vivienda. El equipo revisa qué hay que reparar para que pueda volver. Si el daño crece, salga y llame al 123.'],
    no_habitable: ['No se puede habitar', 'grave', 'No habite la vivienda. El equipo definirá si se puede reparar o si debe ir a demolición. Esté atento a lo que informe la Alcaldía.'],
    colapso_parcial: ['Colapso parcial', 'grave', 'No entre a la vivienda: una parte se cayó. El caso se revisa para definir si se repara o se demuele.'],
    colapso_total: ['Colapso total', 'grave', 'No entre al predio. El caso pasa a revisión de demolición, que tiene sus propias etapas.'],
    sin_dictamen: ['Lo repara el seguro', 'neutro', 'Según la visita, la reparación le corresponde al seguro. Comuníquese con su aseguradora; si tiene dudas, pregunte en la Alcaldía.'],
    sin_acceso: ['No se pudo entrar a la vivienda', 'neutro', 'El ingeniero no pudo entrar. Pida una nueva visita y procure que haya alguien en la vivienda para abrir.'],
    sin_danos_reportados: ['Sin daños por el sismo', 'bien', 'La visita no encontró daños por el sismo. Si aparecen daños nuevos, pida otra visita.'],
    reparacion_sin_clasificar: ['Reparación sin clasificar', 'cuidado', 'El ingeniero vio daños que hay que reparar, pero falta clasificarlos. El equipo completará la revisión.']
  };
  const ICONO_TONO = { bien: 'casa', cuidado: 'alerta', grave: 'alto', neutro: 'info' };
  const ESTADO_SOL = {
    pendiente: s => 'Recibida, pendiente de programar',
    programada: s => s.programada ? `Visita programada para el ${fecha(s.programada)}` : 'Visita programada, fecha por confirmar',
    visitada: () => 'Visitada',
    descartada: () => 'Cerrada sin visita: comuníquese con la Alcaldía'
  };
  const ORIGEN = { ventanilla: 'Ventanilla única', ventanilla_unica: 'Ventanilla única', VENTANILLA: 'Ventanilla única',
    PLANEACION: 'Planeación municipal', SISBEN: 'Sisbén', 'BOMBEROS NC': 'Bomberos' };
  // Las claves que guarda la base, en palabras (11-nov-2026, contra los valores reales de cada tabla).
  const ARP = { menor: 'Requiere ARP · daño menor', restringido: 'Requiere ARP · uso restringido', mayor: 'Requiere ARP · daño mayor',
    colapso: 'Requiere ARP · colapso parcial' };
  const PRESUPUESTO = { estructurando: 'En preparación', revision: 'En revisión', listo: 'Revisado', no_arp: 'No aplica ARP' };
  const SOCIALIZACION = { aceptado: 'Socializado y aceptado', agendada: 'Socialización agendada', novedad: 'Socialización con novedad',
    no_localizado: 'No se localizó al propietario' };
  const DEMOLICION = { abierto: 'En trámite', terminado: 'Demolición terminada', descartado: 'Descartado' };
  const palabra = (mapa, k) => (k && mapa[k]) || mayus(String(k || '').replace(/_/g, ' '));

  function tarjetaVisita(v) {
    const d = DICTAMEN[v.dictamen] || [`Resultado: ${v.dictamen || 'sin dato'}`, 'neutro', 'Pregunte en la Alcaldía de Manizales qué significa este resultado para su vivienda.'];
    const alcance = v.alcance === 'ficha' && v.unidad ? `Visita a una unidad: ${v.unidad}` : (ALCANCE[v.alcance] || 'Visita técnica');
    const filas = [];
    if (v.arp) filas.push(['Aporte a la reparación (ARP)', palabra(ARP, v.arp)]);
    if (v.presupuesto) filas.push(['Presupuesto de obra', palabra(PRESUPUESTO, v.presupuesto)]);
    if (v.socializacion && (v.socializacion.estado || v.socializacion.fecha))
      filas.push(['Socialización del ARP', [palabra(SOCIALIZACION, v.socializacion.estado), fecha(v.socializacion.fecha)].filter(Boolean).join(' · ')]);
    return h('article', { class: 'visita' },
      h('div', {},
        h('div', { class: 'v-meta' }, v.fecha && h('span', { class: 'chip' }, fecha(v.fecha)), h('span', { class: 'chip' }, alcance)),
        h('p', { class: 'dictamen ' + d[1] }, icono(ICONO_TONO[d[1]]), h('span', {}, d[0])),
        filas.length > 0 && h('dl', { class: 'detalle' }, filas.map(([k, x]) => h('div', {}, h('dt', {}, k), h('dd', {}, String(x)))))),
      h('div', { class: 'que-sigue' },
        h('h5', {}, 'Qué sigue'),
        h('p', {}, d[2]),
        h('p', { class: 'borrador' }, 'Borrador: pendiente de validación')));
  }

  function pintaEstado(est) {
    const p = est.predio || {}, visitas = (est.visitas || []).slice().sort((a, b) => String(b.fecha || '').localeCompare(String(a.fecha || '')));
    const demol = est.demoliciones || [], sols = est.solicitudes || [];
    const u = +p.unidades || 0;
    const titulo = h('h3', { tabindex: '-1', id: 'c-res-titulo' }, 'Estado de su predio');
    const otra = h('button', { type: 'button', class: 'boton borde' }, icono('otra'), 'Hacer otra consulta');
    otra.addEventListener('click', () => {
      cResultado.replaceChildren(); fConsultar.hidden = true; bEstado.replaceChildren(); $('#c-doc').value = '';
      limpia(fConsultar); pasoConsulta(1); bQ.focus(); bQ.select();
    });
    const tarjetas = [
      h('section', { class: 'res-tarjeta predio ancha', 'aria-label': 'El predio' },
        h('span', { class: 'r-rot' }, 'El predio'),
        h('h4', {}, p.direccion || 'Predio sin dirección registrada'),
        h('div', { class: 'datos-predio' },
          p.barrio && h('span', {}, `Barrio ${p.barrio}`),
          p.comuna && h('span', {}, `Comuna ${p.comuna}`),
          u > 1 && h('span', {}, `Edificio con ${u.toLocaleString('es-CO')} unidades`))),
      h('section', { class: 'res-tarjeta ancha', 'aria-label': 'Visitas técnicas' },
        h('span', { class: 'r-rot' }, 'Visitas técnicas'),
        visitas.length
          ? [h('h4', {}, visitas.length === 1 ? '1 visita registrada' : `${visitas.length} visitas registradas`), ...visitas.map(tarjetaVisita)]
          : [h('h4', {}, 'Todavía no hay una visita registrada'),
            h('p', {}, 'Si su vivienda tiene daños por el sismo, pida una visita técnica.'),
            h('a', { class: 'boton amarillo', href: '#pedir-visita' }, 'Pedir una visita técnica')]),
      h('section', { class: 'res-tarjeta', 'aria-label': 'Registro Único de Damnificados' },
        h('span', { class: 'r-rot' }, 'RUD · Registro Único de Damnificados'),
        est.rud === 'si'
          ? [h('h4', {}, 'Inscrito en el RUD'), h('p', {}, 'Estar en el RUD es la base para recibir ayudas.')]
          : est.rud === 'nc'
          ? [h('h4', {}, 'Todavía no se ha verificado en el RUD'), h('p', {}, 'Si no se ha inscrito, hágalo ante la Alcaldía de Manizales: es el primer paso para recibir ayudas.')]
          : [h('h4', {}, 'No encontramos una inscripción en el RUD para este predio'), h('p', {}, 'Inscribirse es el primer paso para recibir ayudas. Se hace ante la Alcaldía de Manizales.')])
    ];
    if (demol.length) tarjetas.push(h('section', { class: 'res-tarjeta', 'aria-label': 'Demolición' },
      h('span', { class: 'r-rot' }, 'Demolición'),
      h('h4', {}, demol.length === 1 ? 'Hay un expediente de demolición' : `Hay ${demol.length} expedientes de demolición`),
      h('ul', { class: 'lista-r' }, demol.map(x => h('li', {}, h('span', { class: 'rad' }, x.radicado || 'Sin radicado'), h('span', { class: 'est' }, `Etapa: ${x.estado ? palabra(DEMOLICION, x.estado) : 'sin dato'}`))))));
    if (sols.length) tarjetas.push(h('section', { class: 'res-tarjeta' + (demol.length ? ' ancha' : ''), 'aria-label': 'Solicitudes de visita' },
      h('span', { class: 'r-rot' }, 'Solicitudes de visita'),
      h('h4', {}, sols.length === 1 ? '1 solicitud' : `${sols.length} solicitudes`),
      h('ul', { class: 'lista-r' }, sols.map(s => h('li', {},
        h('span', {}, h('span', { class: 'rad' }, s.radicado || ''), h('br'), h('span', { class: 'est' }, [ORIGEN[s.origen] || mayus(s.origen), fecha(s.fecha)].filter(Boolean).join(' · '))),
        h('span', { class: 'est' }, (ESTADO_SOL[s.estado] || (() => mayus(s.estado)))(s)))))));
    cResultado.replaceChildren(
      h('div', { class: 'res-cabeza' }, titulo, otra),
      h('div', { class: 'res-grid' }, tarjetas));
    titulo.focus({ preventScroll: true });
    cResultado.scrollIntoView({ behavior: reducido() ? 'auto' : 'smooth', block: 'start' });
  }

  fConsultar.addEventListener('submit', async e => {
    e.preventDefault();
    const errores = revisaTodo(fConsultar);
    if (errores.length) { controlDe(errores[0].el).focus(); return; }
    const boton = $('button[type="submit"]', fConsultar);
    const id22 = $('input[name="id22"]:checked', cPredios).value, documento = soloDigitos($('#c-doc').value);
    cResultado.replaceChildren();
    const res = await conEspera(boton, bEstado, 'Consultando…', { accion: 'consultar', id22, documento });
    if (!res.ok) { pinta(bEstado, aviso('malo', h('p', {}, textoError(res)))); return; }
    if (!res.d.encontrado || !res.d.estado) {
      pinta(bEstado, aviso('malo',
        h('p', {}, h('b', {}, 'No encontramos un registro de ese predio con esa cédula.')),
        h('ul', {},
          h('li', {}, 'Revise que la cédula esté bien escrita, solo con números.'),
          h('li', {}, 'Pruebe con la cédula del titular o del propietario.'),
          h('li', {}, 'Si nadie del predio ha tenido visita, ', h('a', { href: '#pedir-visita' }, 'pida una visita técnica'), '.'))));
      return;
    }
    bEstado.replaceChildren(); pasoConsulta(3);
    pintaEstado(res.d.estado);
  });

  // ================= 2. PEDIR UNA VISITA TÉCNICA =================
  const fPedir = $('#f-pedir'), pQ = $('#p-q'), pBuscar = $('#p-buscar'), pBEstado = $('#p-b-estado'), pPredios = $('#p-predios');
  const pManual = $('#p-manual'), pAlerta = $('#p-alerta'), pResumen = $('#p-resumen'), pEstado = $('#p-estado'), pResultado = $('#p-resultado');
  preparaValidacion(fPedir);

  async function buscaParaPedir() {
    const m = REGLAS.busqueda(pQ); marca(pQ, m);
    if (m) { pQ.focus(); return; }
    const q = pQ.value.trim();
    const res = await conEspera(pBuscar, pBEstado, 'Buscando el predio…', { accion: 'buscar', q });
    $$('.predio-op', pPredios).forEach(x => x.remove());
    if (!res.ok) { pinta(pBEstado, aviso('malo', h('p', {}, textoError(res)))); return; }
    const predios = Array.isArray(res.d.predios) ? res.d.predios : [];
    if (!predios.length) { pinta(pBEstado, avisoSinPredios(q, res.d.aviso, true)); return; }
    $('.manual', pPredios).before(...predios.map(p => opcionPredio(p, 'id22')));
    $$('input', pPredios).forEach(i => i.setAttribute('aria-invalid', 'false'));
    pManual.hidden = !$('input[value="manual"]', pPredios).checked;
    pinta(pBEstado, h('p', { class: 'nota' }, predios.length === 1 ? 'Encontramos 1 predio. Elíjalo en la lista.' : `Encontramos ${predios.length} predios. Elija el suyo en la lista.`));
  }
  pBuscar.addEventListener('click', buscaParaPedir);
  pQ.addEventListener('keydown', e => {   // Enter en el buscador busca; no envía la solicitud
    if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); buscaParaPedir(); }
  });
  pPredios.addEventListener('change', e => {
    if (e.target.name !== 'id22') return;
    pManual.hidden = e.target.value !== 'manual';
    if (pManual.hidden) { marca($('#p-dir'), ''); marca($('#p-barrio'), ''); }
  });
  $('#p-peligro-grupo').addEventListener('change', e => {
    if (e.target.value === 'si')
      pinta(pAlerta, icono('alerta'), h('span', {}, 'Salga de la vivienda y llame al 123 ahora.'));
    else pAlerta.replaceChildren();
  });

  function resumenErrores(errores) {
    pResumen.replaceChildren(
      h('h3', {}, errores.length === 1 ? 'Falta corregir 1 dato' : `Faltan corregir ${errores.length} datos`),
      h('ul', {}, errores.map(({ el, msg }) => {
        const c = controlDe(el);
        const a = h('a', { href: '#' + (c.id || el.id) }, msg);
        a.addEventListener('click', ev => { ev.preventDefault(); c.focus(); });
        return h('li', {}, a);
      })));
    pResumen.hidden = false; pResumen.focus();
  }

  let enviando = false;
  fPedir.addEventListener('submit', async e => {
    e.preventDefault();
    if (enviando) return;
    marca(pQ, '');
    const errores = revisaTodo(fPedir, [pQ]);
    if (errores.length) { resumenErrores(errores); return; }
    pResumen.hidden = true;
    const elegido = $('input[name="id22"]:checked', pPredios).value, manual = elegido === 'manual';
    let cel = soloDigitos($('#p-cel').value); if (cel.length === 12 && cel.startsWith('57')) cel = cel.slice(2);
    const cuerpo = {
      accion: 'solicitar',
      nombre: $('#p-nombre').value.trim(),
      documento: soloDigitos($('#p-doc').value),
      celular: cel,
      calidad: $('input[name="calidad"]:checked', fPedir).value,
      afectacion: $('#p-dano').value.trim(),
      peligro: $('input[name="peligro"]:checked', fPedir).value === 'si',
      autoriza: true,
      sitio: $('#p-sitio').value
    };
    const correo = $('#p-correo').value.trim(); if (correo) cuerpo.correo = correo;
    if (manual) { cuerpo.direccion = $('#p-dir').value.trim(); cuerpo.barrio = $('#p-barrio').value.trim(); }
    else cuerpo.id22 = elegido;
    enviando = true;
    const boton = $('button[type="submit"]', fPedir);
    const res = await conEspera(boton, pEstado, 'Enviando su solicitud…', cuerpo);
    enviando = false;
    if (!res.ok || !res.d.radicado) {
      pinta(pEstado, aviso('malo', h('p', {}, res.ok ? MSG_CAIDO : textoError(res))));
      if (res.error === 'predio') { $$('.predio-op', pPredios).forEach(x => x.remove()); }
      return;
    }
    pEstado.replaceChildren();
    muestraRadicado(String(res.d.radicado), !!res.d.repetida, cuerpo.documento, cuerpo.peligro);
  });

  function muestraRadicado(rad, repetida, documento, peligro) {
    const copiado = h('p', { class: 'copiado', role: 'status' });
    const num = h('strong', { class: 'radicado-num', id: 'p-radicado-num' }, rad);
    const copiar = h('button', { type: 'button', class: 'boton azul' }, icono('copiar'), 'Copiar');
    copiar.setAttribute('aria-describedby', 'p-radicado-num');
    copiar.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(rad); copiado.textContent = 'Radicado copiado.'; }
      catch (_) {
        const r = document.createRange(); r.selectNodeContents(num); const s = getSelection(); s.removeAllRanges(); s.addRange(r);
        copiado.textContent = 'Seleccionamos el número: cópielo con el menú de su celular.';
      }
    });
    const seguir = h('button', { type: 'button', class: 'boton amarillo' }, 'Seguir esta solicitud', icono('flecha'));
    seguir.addEventListener('click', () => {
      $('#s-rad').value = rad; $('#s-doc').value = documento; limpia(fSeguir);
      history.pushState(null, '', '#seguimiento');
      abre('seguimiento', true);
      fSeguir.requestSubmit();
    });
    const otra = h('button', { type: 'button', class: 'boton borde' }, 'Pedir otra visita');
    otra.addEventListener('click', () => {
      fPedir.reset(); limpia(fPedir); $$('.predio-op', pPredios).forEach(x => x.remove());
      pManual.hidden = true; pAlerta.replaceChildren(); pBEstado.replaceChildren();
      pResultado.hidden = true; pResultado.replaceChildren(); fPedir.hidden = false; $('#p-nombre').focus();
    });
    pResultado.replaceChildren(
      h('div', { class: 'r-ok' }, icono('ok')),
      h('h3', {}, repetida ? 'Usted ya tenía una solicitud abierta' : 'Recibimos su solicitud'),
      h('p', {}, repetida ? 'Usted ya tenía una solicitud abierta para este predio: su radicado es' : 'Su número de radicado es'),
      num,
      h('p', {}, repetida
        ? 'No hace falta pedirla otra vez. Un coordinador la programará y lo llamará al celular que nos dio.'
        : 'Guárdelo: con él puede ver en qué va. Un coordinador revisará su solicitud y programará la visita; lo llamará al celular que nos dio.'),
      h('div', { class: 'res-acciones' }, copiar, seguir, otra),
      copiado,
      peligro && aviso('malo', h('p', {}, h('b', {}, 'Si hay peligro de que algo se caiga, no espere la visita:'), ' salga de la vivienda y llame al 123.')));
    fPedir.hidden = true; pResultado.hidden = false; pResultado.focus();
    pResultado.scrollIntoView({ behavior: reducido() ? 'auto' : 'smooth', block: 'start' });
  }

  // ================= 3. SEGUIR MI RADICADO =================
  const fSeguir = $('#f-seguir'), sEstado = $('#s-estado'), sResultado = $('#s-resultado');
  preparaValidacion(fSeguir);
  fSeguir.addEventListener('submit', async e => {
    e.preventDefault();
    const errores = revisaTodo(fSeguir);
    if (errores.length) { controlDe(errores[0].el).focus(); return; }
    const rad = normalizaRadicado($('#s-rad').value); $('#s-rad').value = rad;
    const documento = soloDigitos($('#s-doc').value);
    sResultado.replaceChildren();
    const res = await conEspera($('button[type="submit"]', fSeguir), sEstado, 'Consultando…', { accion: 'seguimiento', radicado: rad, documento });
    if (!res.ok) { pinta(sEstado, aviso('malo', h('p', {}, textoError(res)))); return; }
    if (!res.d.encontrado || !res.d.solicitud) {
      pinta(sEstado, aviso('malo', h('p', {}, h('b', {}, 'No encontramos una solicitud con ese radicado y esa cédula.')), h('p', {}, 'Revise los dos datos y vuelva a intentarlo.')));
      return;
    }
    sEstado.replaceChildren();
    pintaSeguimiento(res.d.solicitud);
  });

  function pintaSeguimiento(s) {
    const titulo = h('h3', { tabindex: '-1' }, 'Solicitud ', h('span', { class: 'nowrap' }, s.radicado || ''));
    const cuerpo = [];
    if (s.estado === 'descartada') {
      cuerpo.push(aviso('malo', h('p', {}, h('b', {}, 'Esta solicitud se cerró sin visita.')), h('p', {}, 'Comuníquese con la Alcaldía de Manizales para saber el motivo y qué hacer.')));
    } else {
      const orden = ['pendiente', 'programada', 'visitada'];
      const actual = Math.max(0, orden.indexOf(s.estado));
      const pasos = [
        ['Recibida', s.fecha ? fecha(s.fecha) : ''],
        ['Visita programada', s.programada ? fecha(s.programada) : (actual >= 1 ? 'Fecha por confirmar' : 'Todavía sin fecha')],
        ['Visitada', s.visitada_en ? fecha(s.visitada_en) : 'Pendiente']
      ];
      cuerpo.push(h('ol', { class: 'linea', 'aria-label': 'En qué va la solicitud' }, pasos.map(([t, f], i) => {
        const hecho = i < actual || (i === actual && s.estado === 'visitada');
        const li = h('li', { class: hecho ? 'hecho' : null },
          h('span', { class: 'marca-e' }, hecho ? icono('ok') : null),
          h('b', {}, t), f && h('span', { class: 'l-f' }, f),
          i === actual && h('span', { class: 'ahora' }, 'Estado actual'));
        if (i === actual) li.setAttribute('aria-current', 'step');
        return li;
      })));
      if (s.estado === 'visitada')
        cuerpo.push(aviso('ok', h('p', {}, 'El ingeniero ya visitó el predio. Vea el resultado en ', h('a', { href: '#consultar' }, 'Consultar mi predio'), '.')));
      else if (s.estado === 'programada')
        cuerpo.push(aviso('info', h('p', {}, 'Procure que haya alguien en el predio ese día para abrirle al ingeniero.')));
      else cuerpo.push(aviso('info', h('p', {}, 'Un coordinador revisará su solicitud y lo llamará para programar la visita.')));
      if (s.ubicada === false && s.estado !== 'visitada')
        cuerpo.push(aviso('info', h('p', {}, 'El equipo todavía está ubicando el predio con la dirección que usted dio. Es posible que lo llamen para confirmarla.')));
    }
    sResultado.replaceChildren(h('div', { class: 'res-tarjeta' },
      h('span', { class: 'r-rot' }, 'Su solicitud'), titulo,
      h('p', {}, [s.direccion, s.fecha && `pedida el ${fecha(s.fecha)}`].filter(Boolean).join(' · ')),
      h('div', { class: 'seg-cuerpo' }, cuerpo)));
    titulo.focus({ preventScroll: true });
    sResultado.scrollIntoView({ behavior: reducido() ? 'auto' : 'smooth', block: 'start' });
  }
})();
