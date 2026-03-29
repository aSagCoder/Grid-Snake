const {
  json,
  parseJsonBody,
  pipeline,
  redis,
  sanitizePlayerId,
  sanitizeUsername,
} = require('./_kv');

function clampInt(n, lo, hi) {
  const x = Number(n);
  if (!Number.isFinite(x)) return null;
  const i = Math.trunc(x);
  if (i < lo || i > hi) return null;
  return i;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return json(res, 405, { error: 'method_not_allowed' }, { Allow: 'POST' });
  }

  let body;
  try {
    body = await parseJsonBody(req);
  } catch (err) {
    return json(res, err.status || 400, { error: 'bad_request', message: err.message });
  }

  const playerId = sanitizePlayerId(body.playerId);
  const username = sanitizeUsername(body.username);
  const score = clampInt(body.score, 0, 1000000);

  const grid = clampInt(body.grid, 10, 60);
  const speed = clampInt(body.speed, 40, 400);
  const startLen = clampInt(body.startLen, 2, 60);

  if (!playerId || !username || score == null) {
    return json(res, 400, { error: 'invalid_input' });
  }

  // Very small per-player rate limit (prevents spam).
  const rlKey = `ratelimit:${playerId}`;
  try {
    const set = await redis('set', rlKey, '1', 'EX', '5', 'NX');
    if (set !== 'OK') {
      return json(res, 429, { error: 'rate_limited' });
    }
  } catch (err) {
    if (err.code === 'KV_MISSING') return json(res, 500, { error: 'kv_not_configured', message: err.message });
    return json(res, 500, { error: 'kv_error' });
  }

  const bestKey = `best:${playerId}`;
  const lbKey = 'leaderboard';
  const playerKey = `player:${playerId}`;
  const now = new Date().toISOString();

  try {
    const prevBestRaw = await redis('get', bestKey);
    const prevBest = prevBestRaw == null ? null : Number(prevBestRaw);

    const cmds = [];

    // Always store player metadata.
    cmds.push([
      'HSET',
      playerKey,
      'username',
      username,
      'updatedAt',
      now,
      'lastScore',
      String(score),
    ]);

    if (grid != null) cmds[0].push('grid', String(grid));
    if (speed != null) cmds[0].push('speed', String(speed));
    if (startLen != null) cmds[0].push('startLen', String(startLen));

    const isNewBest = prevBest == null || score > prevBest;
    if (isNewBest) {
      cmds.push(['SET', bestKey, String(score)]);
      cmds.push(['ZADD', lbKey, String(score), playerId]);
    }

    await pipeline(cmds);

    return json(res, 200, {
      ok: true,
      saved: true,
      isNewBest,
      best: isNewBest ? score : prevBest,
    });
  } catch (err) {
    if (err.code === 'KV_MISSING') return json(res, 500, { error: 'kv_not_configured', message: err.message });
    return json(res, 500, { error: 'kv_error' });
  }
};
