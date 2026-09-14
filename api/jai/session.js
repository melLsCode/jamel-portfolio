const {
  configured,
  json,
  readCookie,
  readUsed,
  writeSession,
  markComplete,
  ipHash,
  now,
  expired,
  publicSession,
  MAX_TURNS,
  MAX_MS,
  MSG_COMPLETE,
  MSG_UNAVAILABLE
} = require("./_lib");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    json(res, 405, { status: "unavailable", message: MSG_UNAVAILABLE });
    return;
  }
  if (!configured()) {
    json(res, 503, { status: "unavailable", message: MSG_UNAVAILABLE });
    return;
  }

  if (readUsed(req)) {
    json(res, 200, { status: "complete", message: MSG_COMPLETE });
    return;
  }

  let sess = readCookie(req);
  if (sess && sess.ip && sess.ip !== ipHash(req)) sess = null;

  if (sess && expired(sess)) {
    markComplete(res, req, sess);
    json(res, 200, { status: "complete", message: MSG_COMPLETE });
    return;
  }

  if (sess) {
    json(res, 200, { ...publicSession(sess), maxTurns: MAX_TURNS, maxMs: MAX_MS });
    return;
  }

  sess = {
    id: now().toString(36) + Math.random().toString(36).slice(2, 8),
    ip: ipHash(req),
    started: now(),
    turns: 0,
    complete: false
  };
  writeSession(res, sess);
  json(res, 200, { ...publicSession(sess), maxTurns: MAX_TURNS, maxMs: MAX_MS });
};
