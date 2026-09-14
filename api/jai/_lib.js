const crypto = require("crypto");

const COOKIE = "jai_demo";
const USED_COOKIE = "jai_used";
const MAX_TURNS = 3;
const MAX_MS = 90 * 1000;
const MAX_AUDIO_BYTES = 1_200_000;
const MAX_REPLY_TOKENS = 220;
const MAX_TTS_BYTES = 250_000;
const MIN_SECRET_LEN = 32;
const USED_MAX_AGE = 7 * 24 * 60 * 60;
const ALLOWED_MIME = new Set(["audio/webm", "audio/mp4", "audio/mpeg"]);
const MSG_COMPLETE = "J.AI // DEMO COMPLETE";
const MSG_UNAVAILABLE = "J.AI // TEMPORARILY UNAVAILABLE";

const inflight = new Map();

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

function secret() {
  return process.env.JAI_SESSION_SECRET || "";
}

function openaiKey() {
  return process.env.OPENAI_API_KEY || "";
}

function configured() {
  return Boolean(openaiKey() && secret().length >= MIN_SECRET_LEN);
}

function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", secret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

function unsign(token) {
  if (!token || !configured()) return null;
  const i = token.lastIndexOf(".");
  if (i < 1) return null;
  const body = token.slice(0, i);
  const sig = token.slice(i + 1);
  const expect = crypto.createHmac("sha256", secret()).update(body).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expect);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    return JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

function parseCookieHeader(req) {
  const raw = req.headers.cookie || "";
  const out = {};
  raw.split(/;\s*/).forEach((p) => {
    const eq = p.indexOf("=");
    if (eq > 0) out[p.slice(0, eq)] = p.slice(eq + 1);
  });
  return out;
}

function readCookie(req) {
  return unsign(parseCookieHeader(req)[COOKIE]);
}

function readUsed(req) {
  const payload = unsign(parseCookieHeader(req)[USED_COOKIE]);
  if (!payload || payload.t !== "used") return null;
  if (payload.exp && now() > payload.exp) return null;
  return payload;
}

function cookiePair(name, token, maxAge) {
  const parts = [`${name}=${token}`, "HttpOnly", "Path=/", "SameSite=Lax", `Max-Age=${maxAge}`];
  if (process.env.VERCEL) parts.push("Secure");
  return parts.join("; ");
}

function appendCookie(res, pair) {
  const prev = res.getHeader && res.getHeader("Set-Cookie");
  const list = prev ? [].concat(prev) : [];
  list.push(pair);
  res.setHeader("Set-Cookie", list);
}

function writeSession(res, payload) {
  appendCookie(res, cookiePair(COOKIE, sign(payload), 60 * 60 * 24));
}

function writeUsed(res, req) {
  const payload = {
    t: "used",
    exp: now() + USED_MAX_AGE * 1000,
    ip: ipHash(req)
  };
  appendCookie(res, cookiePair(USED_COOKIE, sign(payload), USED_MAX_AGE));
}

function markComplete(res, req, sess) {
  sess.complete = true;
  writeSession(res, sess);
  writeUsed(res, req);
}

function clientIp(req) {
  const fwd = (req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return fwd || req.socket?.remoteAddress || "unknown";
}

function ipHash(req) {
  return crypto.createHash("sha256").update(clientIp(req)).digest("hex").slice(0, 16);
}

function now() {
  return Date.now();
}

function expired(sess) {
  if (!sess) return true;
  return sess.complete || now() - sess.started > MAX_MS || sess.turns >= MAX_TURNS;
}

function publicSession(sess) {
  if (!sess) return { status: "idle", remainingTurns: MAX_TURNS, remainingMs: MAX_MS };
  if (expired(sess)) return { status: "complete", remainingTurns: 0, remainingMs: 0, message: MSG_COMPLETE };
  return {
    status: "available",
    remainingTurns: Math.max(0, MAX_TURNS - sess.turns),
    remainingMs: Math.max(0, MAX_MS - (now() - sess.started))
  };
}

function allowedMime(mime) {
  const base = String(mime || "").split(";")[0].trim().toLowerCase();
  return ALLOWED_MIME.has(base);
}

function pruneInflight() {
  const cutoff = now() - (MAX_MS + 60_000);
  for (const [id, st] of inflight) {
    if (st.ts < cutoff) inflight.delete(id);
  }
}

function claimTurn(sess) {
  pruneInflight();
  const id = sess.id;
  let st = inflight.get(id);
  if (!st) {
    st = { turns: sess.turns, busy: false, ts: now() };
    inflight.set(id, st);
  }
  st.turns = Math.max(st.turns, sess.turns);
  st.ts = now();
  if (st.busy) return { ok: false, reason: "busy" };
  if (st.turns >= MAX_TURNS) return { ok: false, reason: "limit" };
  st.busy = true;
  st.turns += 1;
  sess.turns = st.turns;
  return {
    ok: true,
    release() {
      st.busy = false;
      st.ts = now();
    }
  };
}

function resetInflight() {
  inflight.clear();
}

function readBody(req) {
  if (req.body && typeof req.body === "object") return Promise.resolve(req.body);
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (c) => {
      size += c.length;
      if (size > 2_000_000) {
        reject(new Error("payload too large"));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => {
      if (!chunks.length) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        reject(new Error("invalid json"));
      }
    });
    req.on("error", reject);
  });
}

const TOPICS = {
  projects: "The visitor asked about Jamel's projects. Summarize the featured work from the knowledge file. Mention Food & Nutrition, Orban, Payload CMS, and that there are also AI/mobile products. Do not invent extra projects.",
  stack: "The visitor asked about Jamel's technical stack. Cover the stacks actually listed in the knowledge file. Do not add technologies that are not listed.",
  workflow: "The visitor asked about Jamel's AI-assisted development workflow. Explain Accelerate, Verify, Own. AI is an accelerator; Jamel reviews, tests, and owns shipped code.",
  food: "The visitor asked about the Food & Nutrition Subscription Platform. Use only the architecture, Stripe test-mode details, and validated subscription flow from the knowledge file."
};

module.exports = {
  COOKIE,
  USED_COOKIE,
  MAX_TURNS,
  MAX_MS,
  MAX_AUDIO_BYTES,
  MAX_REPLY_TOKENS,
  MAX_TTS_BYTES,
  MIN_SECRET_LEN,
  ALLOWED_MIME,
  MSG_COMPLETE,
  MSG_UNAVAILABLE,
  TOPICS,
  json,
  secret,
  openaiKey,
  configured,
  sign,
  readCookie,
  readUsed,
  writeSession,
  writeUsed,
  markComplete,
  ipHash,
  now,
  expired,
  publicSession,
  allowedMime,
  claimTurn,
  resetInflight,
  readBody
};
