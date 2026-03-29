const DEFAULT_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
};

function json(res, status, body, extraHeaders = {}) {
  res.statusCode = status;
  for (const [k, v] of Object.entries({ ...DEFAULT_HEADERS, ...extraHeaders })) {
    res.setHeader(k, v);
  }
  res.end(JSON.stringify(body));
}

function getKvEnv() {
  const url =
    process.env.KV_REST_API_URL ||
    process.env.UPSTASH_REDIS_REST_URL ||
    process.env.KV_REST_API_URL ||
    process.env.UPSTASH_REDIS_REST_URL;

  const token =
    process.env.KV_REST_API_TOKEN ||
    process.env.UPSTASH_REDIS_REST_TOKEN ||
    process.env.KV_REST_API_READ_ONLY_TOKEN ||
    process.env.UPSTASH_REDIS_REST_TOKEN;

  return { url, token };
}

function encodeArg(x) {
  return encodeURIComponent(String(x));
}

async function kvFetch(path, init) {
  const { url, token } = getKvEnv();
  if (!url || !token) {
    const err = new Error('Missing KV env vars. Set KV_REST_API_URL + KV_REST_API_TOKEN (or UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN).');
    err.code = 'KV_MISSING';
    throw err;
  }

  const resp = await fetch(`${url}${path}`, {
    ...init,
    headers: {
      ...(init && init.headers ? init.headers : {}),
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await resp.json().catch(() => null);
  if (!resp.ok) {
    const err = new Error(`KV request failed: ${resp.status}`);
    err.status = resp.status;
    err.data = data;
    throw err;
  }

  return data;
}

async function redis(cmd, ...args) {
  const path = `/${cmd.toLowerCase()}/${args.map(encodeArg).join('/')}`;
  const data = await kvFetch(path, { method: 'GET' });
  return data?.result;
}

async function pipeline(commands) {
  // commands: Array<Array<string>>
  const data = await kvFetch('/pipeline', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(commands),
  });
  // Upstash pipeline typically returns a JSON array. Some wrappers return { result: [...] }.
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.result)) return data.result;
  return [];
}

function sanitizeUsername(input) {
  const raw = (input ?? '').toString().trim();
  if (!raw) return null;
  const cleaned = raw.replace(/\s+/g, ' ').slice(0, 20);
  // Allow letters/numbers/spaces/_-.
  const ok = /^[a-zA-Z0-9 _\-\.]+$/.test(cleaned);
  return ok ? cleaned : null;
}

function sanitizePlayerId(input) {
  const raw = (input ?? '').toString().trim();
  if (!raw) return null;
  // Accept UUID-ish + short ids.
  if (raw.length < 8 || raw.length > 64) return null;
  if (!/^[a-zA-Z0-9\-_:]+$/.test(raw)) return null;
  return raw;
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let buf = '';
    req.on('data', (chunk) => {
      buf += chunk;
      if (buf.length > 50_000) {
        const err = new Error('Body too large');
        err.status = 413;
        reject(err);
      }
    });
    req.on('end', () => {
      if (!buf) return resolve({});
      try {
        resolve(JSON.parse(buf));
      } catch {
        const err = new Error('Invalid JSON');
        err.status = 400;
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

module.exports = {
  json,
  redis,
  pipeline,
  parseJsonBody,
  sanitizeUsername,
  sanitizePlayerId,
};


