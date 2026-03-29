const {
  json,
  parseJsonBody,
  pipeline,
  redis,
  sanitizePlayerId,
} = require('../_kv');

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
  if (!playerId) return json(res, 400, { error: 'invalid_input' });

  try {
    // Use a set for exact counts (good enough for small projects).
    await pipeline([
      ['SADD', 'players:seen', playerId],
      ['EXPIRE', 'players:seen', String(60 * 60 * 24 * 365)],
    ]);
    const uniquePlayers = await redis('scard', 'players:seen');
    return json(res, 200, { ok: true, uniquePlayers: Number(uniquePlayers ?? 0) });
  } catch (err) {
    if (err.code === 'KV_MISSING') return json(res, 500, { error: 'kv_not_configured', message: err.message });
    return json(res, 500, { error: 'kv_error' });
  }
};
