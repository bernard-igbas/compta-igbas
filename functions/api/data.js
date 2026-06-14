// functions/api/data.js
// API de synchronisation de la comptabilite familiale via Cloudflare KV.
//
// Binding KV attendu (a configurer dans Cloudflare Pages > Settings > Functions > KV bindings) :
//   Variable name : COMPTA_KV
//   KV namespace  : compta-igbas (a creer si besoin)
//
// Variable d'environnement attendue (Settings > Environment variables) :
//   COMPTA_CODE : le code numerique a 6 chiffres partage entre ML et Bernard
//
// Cle KV utilisee : "compta-data" -> contient le JSON complet de l'objet D
//
// Endpoints :
//   GET  /api/data        -> { ok:true, data: {...}, updatedAt: "..." }  (necessite header X-Compta-Code)
//   POST /api/data        -> body JSON = nouvel objet D complet. Sauvegarde et renvoie { ok:true, updatedAt }
//
// Securite : code partage simple transmis via header "X-Compta-Code".
// Ce n'est pas une authentification forte, mais suffisant pour eviter
// qu'un tiers tombant sur l'URL ne lise/modifie les donnees.

const DATA_KEY = "compta-data";
const META_KEY = "compta-meta";

function jsonResponse(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function checkAuth(request, env) {
  const code = request.headers.get("X-Compta-Code") || "";
  const expected = (env.COMPTA_CODE || "").toString().trim();
  if (!expected) {
    // Si aucun code n'est configure cote serveur, on refuse tout par securite.
    return false;
  }
  return code.trim() === expected;
}

export async function onRequestGet(context) {
  const { request, env } = context;

  if (!checkAuth(request, env)) {
    return jsonResponse({ ok: false, error: "unauthorized" }, 401);
  }

  const raw = await env.COMPTA_KV.get(DATA_KEY);
  const metaRaw = await env.COMPTA_KV.get(META_KEY);

  if (!raw) {
    return jsonResponse({ ok: true, data: null, updatedAt: null });
  }

  let meta = {};
  try {
    meta = metaRaw ? JSON.parse(metaRaw) : {};
  } catch (e) {
    meta = {};
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    return jsonResponse({ ok: false, error: "corrupted_data" }, 500);
  }

  return jsonResponse({ ok: true, data, updatedAt: meta.updatedAt || null });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!checkAuth(request, env)) {
    return jsonResponse({ ok: false, error: "unauthorized" }, 401);
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return jsonResponse({ ok: false, error: "invalid_json" }, 400);
  }

  if (!body || typeof body !== "object" || !Array.isArray(body.ops)) {
    return jsonResponse({ ok: false, error: "invalid_payload" }, 400);
  }

  const updatedAt = new Date().toISOString();

  await env.COMPTA_KV.put(DATA_KEY, JSON.stringify(body));
  await env.COMPTA_KV.put(
    META_KEY,
    JSON.stringify({ updatedAt, updatedBy: body.__updatedBy || "inconnu" })
  );

  return jsonResponse({ ok: true, updatedAt });
}

// Repondre proprement aux requetes OPTIONS (CORS) si besoin un jour
export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-Compta-Code",
    },
  });
}
