// cifras-publicas: las cifras sumadas de la página pública del Plan de Recuperación, en vivo.
// GET público, sin sesión: solo cifras sumadas (sin nombres, cédulas, direcciones ni números prediales).
// Devuelve { cifras: <como datos/cifras.json>, arp: <como datos/arp.json> }.
// publico_cifras() tarda unos segundos: la respuesta se guarda 5 minutos en public.publico_web_cache.
import { createClient } from "jsr:@supabase/supabase-js@2";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false, autoRefreshToken: false } });

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Max-Age": "86400",
};
const DURA = 5 * 60 * 1000;
const CLAVE = "pagina_publica";
const CATS = ["sin_dano", "menor", "restringido", "mayor", "colapso", "seguro", "sin_acceso"];

type Cats = Record<string, number>;
const suma = (o: Cats) => Object.values(o ?? {}).reduce((a, n) => a + (Number(n) || 0), 0);
const nombre = (s: string) => s.replace(/ (De|Del) /g, (m) => m.toLowerCase());
function cuenta(o: Cats) {
  const cats = Object.fromEntries(CATS.map((k) => [k, Number(o?.[k]) || 0]));
  return { inmuebles: suma(o), no_habitables: cats.mayor + cats.colapso, arp: cats.menor + cats.restringido + cats.mayor, cats };
}

// las 10 etapas del CMGR en las 5 fases de la página
function demoliciones(D: Record<string, any>) {
  const fases = { solicitud: 0, validacion: 0, comite: 0, obra: 0, terminada: 0 };
  let particular = 0, sinEtapa = 0;
  for (const [e, n0] of Object.entries(D?.por_etapa ?? {})) {
    const n = Number(n0) || 0, k = parseInt(e, 10);
    if (!k) { sinEtapa += n; continue; }
    if (k <= 2) fases.solicitud += n;
    else if (k <= 5) fases.validacion += n;
    else if (k === 6) fases.comite += n;
    else if (k <= 9) fases.obra += n;
    else { fases.terminada += n; if (/particular/i.test(e)) particular += n; }
  }
  return {
    expedientes: Number(D?.expedientes) || 0,
    demolidas: fases.terminada,
    por_municipio: fases.terminada - particular,
    por_particular: particular,
    fases: [
      { k: "solicitud", l: "Solicitud y visita técnica", n: fases.solicitud },
      { k: "validacion", l: "Validación y declaratoria de ruina", n: fases.validacion },
      { k: "comite", l: "Aprobación del Comité del Fondo", n: fases.comite },
      { k: "obra", l: "Contratación y obra", n: fases.obra },
      { k: "terminada", l: "Demolición terminada", n: fases.terminada },
    ],
    sin_etapa: sinEtapa,
  };
}

async function arma() {
  const [a, b] = await Promise.all([db.rpc("publico_cifras"), db.rpc("publico_arp")]);
  if (a.error) throw a.error;
  if (b.error) throw b.error;
  const P = a.data ?? {}, crudas: Record<string, Cats> = P.comunas ?? {};
  const comunas = Object.entries(crudas).filter(([k]) => /^\d{2} · /.test(k))
    .map(([k, o]) => ({ clave: k, num: +k.slice(0, 2), nombre: nombre(k.slice(5)), ...cuenta(o) }))
    .sort((x, y) => x.num - y.num);
  const porCategoria = Object.fromEntries(CATS.map((k) => [k, Object.values(crudas).reduce((s, o) => s + (Number(o?.[k]) || 0), 0)]));
  const cifras = {
    corte: P.corte,
    inmuebles: { total: Object.values(crudas).reduce((s, o) => s + suma(o), 0), por_categoria: porCategoria },
    comunas,
    rural: crudas["Rural"] ? cuenta(crudas["Rural"]) : null,
    sin_ubicar: crudas["Sin ubicar"] ? cuenta(crudas["Sin ubicar"]) : null,
    afectados: P.graficas?.afectados ?? null,
    lluvias: { visitas: Number(P.graficas?.lluvias) || 0 },
    demoliciones: demoliciones(P.demoliciones),
  };
  return { cifras, arp: b.data };
}

let memoria: { en: number; datos: unknown } | null = null;
let enCurso: Promise<unknown> | null = null;

// lo último guardado, y si ya pasaron 5 minutos, se recalcula (una sola vez a la vez)
async function datos(): Promise<unknown> {
  if (memoria && Date.now() - memoria.en < DURA) return memoria.datos;
  const { data: fila } = await db.from("publico_web_cache").select("datos, en").eq("clave", CLAVE).maybeSingle();
  if (fila && Date.now() - new Date(fila.en).getTime() < DURA) {
    memoria = { en: new Date(fila.en).getTime(), datos: fila.datos };
    return fila.datos;
  }
  enCurso ??= arma().then(async (d) => {
    await db.from("publico_web_cache").upsert({ clave: CLAVE, datos: d, en: new Date().toISOString() });
    memoria = { en: Date.now(), datos: d };
    return d;
  }).finally(() => { enCurso = null; });
  try {
    return await enCurso;
  } catch (e) {
    if (fila) return fila.datos;   // si falla, lo último que hubo
    throw e;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Solo GET." }), { status: 405, headers: { ...CORS, "Content-Type": "application/json" } });
  }
  try {
    return new Response(JSON.stringify(await datos()), {
      headers: { ...CORS, "Content-Type": "application/json", "Cache-Control": "public, max-age=60" },
    });
  } catch (e) {
    console.error("cifras-publicas", e);
    return new Response(JSON.stringify({ error: "Las cifras no están disponibles en este momento." }), {
      status: 503, headers: { ...CORS, "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  }
});
