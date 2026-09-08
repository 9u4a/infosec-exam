/**
 * 정보보안기사·CPPG 학습 사이트 — 학습기록 동기화 서버 (Cloudflare Worker)
 *
 *   POST /login   { passphrase }                 -> { token }
 *   GET  /state   Authorization: Bearer <token>  -> { state, rev, updatedAt }
 *   PUT  /state   { state, baseRev, force? }      -> { rev, updatedAt }  |  409 { conflict, state, rev, updatedAt }
 *
 * 필요 설정 (wrangler.toml + secret):
 *   - KV 네임스페이스 바인딩:  STORE
 *   - Secret:  PASSPHRASE     (로그인 암호 — 충분히 길게)
 *   - Secret:  TOKEN_SECRET   (토큰 서명용 임의 문자열 — 32자 이상 권장)
 *   - Var:     ALLOW_ORIGIN   (예: "https://9u4a.github.io", 로컬 테스트 시 "*")
 *
 * 저장 구조: KV 키 하나(state:v1)에 전체 학습기록 JSON 을 통째로 보관(공유 암호 방식).
 */

const STATE_KEY = 'state:v1';
const TOKEN_TTL_MS = 365 * 24 * 3600 * 1000; // 1년
const MAX_BODY = 5 * 1024 * 1024;            // 5MB

export default {
  async fetch(request, env) {
    const allow = env.ALLOW_ORIGIN || '*';
    const cors = {
      'Access-Control-Allow-Origin': allow,
      'Access-Control-Allow-Methods': 'GET, PUT, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
      Vary: 'Origin',
    };
    const json = (obj, status = 200) =>
      new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json', ...cors } });

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    const url = new URL(request.url);

    try {
      // ---- GET / , /health : 상태 확인 (인증 불필요) ----
      if ((url.pathname === '/' || url.pathname === '/health') && request.method === 'GET') {
        return json({ ok: true, configured: !!(env.PASSPHRASE && env.TOKEN_SECRET) });
      }

      if (!env.PASSPHRASE || !env.TOKEN_SECRET) return json({ error: 'server_not_configured' }, 500);

      // ---- POST /login ----
      if (url.pathname === '/login' && request.method === 'POST') {
        const ip = request.headers.get('cf-connecting-ip') || 'unknown';
        const tkey = `throttle:${ip}`;
        const tries = parseInt((await env.STORE.get(tkey)) || '0', 10);
        if (tries >= 10) return json({ error: 'too_many_attempts' }, 429);
        await env.STORE.put(tkey, String(tries + 1), { expirationTtl: 60 });

        const body = await readJson(request);
        if (!body || !timingSafeEqual(String(body.passphrase || ''), env.PASSPHRASE)) {
          return json({ error: 'invalid_passphrase' }, 401);
        }
        return json({ token: await makeToken(env.TOKEN_SECRET) });
      }

      // ---- 이하 인증 필요 ----
      const token = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
      if (!(await verifyToken(token, env.TOKEN_SECRET))) return json({ error: 'unauthorized' }, 401);

      // ---- GET /state ----
      if (url.pathname === '/state' && request.method === 'GET') {
        const raw = await env.STORE.get(STATE_KEY);
        return json(raw ? JSON.parse(raw) : { state: null, rev: 0, updatedAt: null });
      }

      // ---- PUT /state ----
      if (url.pathname === '/state' && request.method === 'PUT') {
        const len = parseInt(request.headers.get('content-length') || '0', 10);
        if (len > MAX_BODY) return json({ error: 'too_large' }, 413);
        const body = await readJson(request);
        if (!body || typeof body.state !== 'object' || body.state === null) return json({ error: 'bad_body' }, 400);

        const raw = await env.STORE.get(STATE_KEY);
        const cur = raw ? JSON.parse(raw) : { state: null, rev: 0, updatedAt: null };
        if (body.baseRev != null && body.baseRev !== cur.rev && !body.force) {
          return json({ conflict: true, ...cur }, 409);
        }
        const next = { state: body.state, rev: cur.rev + 1, updatedAt: new Date().toISOString() };
        await env.STORE.put(STATE_KEY, JSON.stringify(next));
        return json({ rev: next.rev, updatedAt: next.updatedAt });
      }

      return json({ error: 'not_found' }, 404);
    } catch (e) {
      return json({ error: 'server_error', detail: String(e && e.message || e) }, 500);
    }
  },
};

async function readJson(request) {
  try { return await request.json(); } catch (e) { return null; }
}

function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

async function hmac(secret, msg) {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(msg));
  return btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}

async function makeToken(secret) {
  const payload = `v1.${Date.now()}`;
  return `${payload}.${await hmac(secret, payload)}`;
}

async function verifyToken(token, secret) {
  const m = /^v1\.(\d+)\.([A-Za-z0-9_-]+)$/.exec(token || '');
  if (!m) return false;
  const iat = parseInt(m[1], 10);
  if (!Number.isFinite(iat) || Date.now() - iat > TOKEN_TTL_MS) return false;
  return timingSafeEqual(m[2], await hmac(secret, `v1.${iat}`));
}
