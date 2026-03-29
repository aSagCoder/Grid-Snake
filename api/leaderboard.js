const { json, pipeline, redis, sanitizePlayerId } = require('./_kv');

function clampInt(n, lo, hi) {
  const x = Number(n);
  if (!Number.isFinite(x)) return null;
  const i = Math.trunc(x);
  if (i < lo || i > hi) return null;
  return i;
}

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return json(res, 405, { error: 'method_not_allowed' }, { Allow: 'GET' });
  }

  const u = new URL(req.url, 'http://localhost');
  const limit = clampInt(u.searchParams.get('limit') ?? 10, 1, 50) ?? 10;

  try {
    const raw = await redis('zrevrange', 'leaderboard', '0', String(limit - 1), 'WITHSCORES');
    const flat = Array.isArray(raw) ? raw : [];

    /** @type {{playerId:string, score:number}[]} */
    const pairs = [];
    for (let i = 0; i + 1 < flat.length; i += 2) {
      const playerId = sanitizePlayerId(flat[i]);
      const score = Number(flat[i + 1]);
      if (!playerId || !Number.isFinite(score)) continue;
      pairs.push({ playerId, score });
    }

    const cmds = pairs.map((p) => ['HGET', `player:${p.playerId}`, 'username']);
    const meta = cmds.length ? await pipeline(cmds) : [];

    const items = pairs.map((p, idx) => {
      const username = meta[idx]?.result ? String(meta[idx].result) : 'Anonymous';
      return {
        rank: idx + 1,
        playerId: p.playerId,
        username,
        score: p.score,
      };
    });

    const totalPlayers = await redis('zcard', 'leaderboard');

    return json(res, 200, {
      ok: true,
      items,
      totalPlayers: Number(totalPlayers ?? items.length),
    });
  } catch (err) {
    if (err.code === 'KV_MISSING') return json(res, 500, { error: 'kv_not_configured', message: err.message });
    return json(res, 500, { error: 'kv_error' });
  }
};
