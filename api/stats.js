const { json, redis } = require('./_kv');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return json(res, 405, { error: 'method_not_allowed' }, { Allow: 'GET' });
  }

  try {
    const uniquePlayers = await redis('scard', 'players:seen');
    const totalPlayers = await redis('zcard', 'leaderboard');
    return json(res, 200, {
      ok: true,
      uniquePlayers: Number(uniquePlayers ?? 0),
      leaderboardPlayers: Number(totalPlayers ?? 0),
    });
  } catch (err) {
    if (err.code === 'KV_MISSING') return json(res, 500, { error: 'kv_not_configured', message: err.message });
    return json(res, 500, { error: 'kv_error' });
  }
};
