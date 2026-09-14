const {
  configured,
  json,
  openaiKey,
  readCookie,
  readUsed,
  writeSession,
  markComplete,
  ipHash,
  expired,
  publicSession,
  readBody,
  TOPICS,
  MAX_AUDIO_BYTES,
  MAX_REPLY_TOKENS,
  MAX_TTS_BYTES,
  allowedMime,
  claimTurn,
  MSG_COMPLETE,
  MSG_UNAVAILABLE
} = require("./_lib");
const KNOWLEDGE = require("./_knowledge");

async function openaiJson(path, body) {
  const r = await fetch("https://api.openai.com/v1" + path, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + openaiKey(),
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error("openai_error");
  return data;
}

async function transcribe(buf, mime) {
  const form = new FormData();
  const ext = (mime || "").includes("mp4") ? "mp4" : "webm";
  form.append("file", new Blob([buf], { type: mime || "audio/webm" }), "clip." + ext);
  form.append("model", "whisper-1");
  const r = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: "Bearer " + openaiKey() },
    body: form
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error("stt_error");
  return (data.text || "").trim();
}

async function speak(text) {
  const r = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + openaiKey(),
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ model: "tts-1", voice: "alloy", input: text, response_format: "mp3" })
  });
  if (!r.ok) throw new Error("tts_error");
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length > MAX_TTS_BYTES) throw new Error("tts_too_large");
  return buf.toString("base64");
}

async function handler(req, res) {
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
  if (!sess || (sess.ip && sess.ip !== ipHash(req))) {
    json(res, 409, { status: "unavailable", message: MSG_UNAVAILABLE });
    return;
  }
  if (expired(sess)) {
    markComplete(res, req, sess);
    json(res, 200, { status: "complete", message: MSG_COMPLETE });
    return;
  }

  let body;
  try {
    body = await readBody(req);
  } catch {
    json(res, 400, { status: "unavailable", message: MSG_UNAVAILABLE });
    return;
  }

  const topic = String(body.topic || "");
  if (!TOPICS[topic]) {
    json(res, 400, { status: "unavailable", message: MSG_UNAVAILABLE });
    return;
  }
  if (!body.audio) {
    json(res, 400, { status: "unavailable", message: MSG_UNAVAILABLE });
    return;
  }
  if (!allowedMime(body.mime)) {
    json(res, 400, { status: "unavailable", message: MSG_UNAVAILABLE });
    return;
  }

  let buf;
  try {
    buf = Buffer.from(String(body.audio), "base64");
  } catch {
    json(res, 400, { status: "unavailable", message: MSG_UNAVAILABLE });
    return;
  }
  if (!buf.length || buf.length > MAX_AUDIO_BYTES) {
    json(res, 413, { status: "unavailable", message: MSG_UNAVAILABLE });
    return;
  }

  const claimed = claimTurn(sess);
  if (!claimed.ok) {
    if (claimed.reason === "limit") {
      markComplete(res, req, sess);
      json(res, 200, { status: "complete", message: MSG_COMPLETE });
      return;
    }
    json(res, 429, { status: "unavailable", message: MSG_UNAVAILABLE });
    return;
  }

  writeSession(res, sess);

  let userText = "";
  let reply = "";
  let audio = "";
  try {
    userText = await transcribe(buf, body.mime);
    const prompt = TOPICS[topic] + (userText ? " Visitor said: " + userText.slice(0, 400) : "");
    const chat = await openaiJson("/chat/completions", {
      model: "gpt-4o-mini",
      temperature: 0.3,
      max_tokens: MAX_REPLY_TOKENS,
      messages: [
        { role: "system", content: KNOWLEDGE },
        { role: "user", content: prompt }
      ]
    });
    reply = (chat.choices?.[0]?.message?.content || "").trim();
    if (!reply) throw new Error("empty");
    audio = await speak(reply);
  } catch {
    claimed.release();
    json(res, 503, { status: "unavailable", message: MSG_UNAVAILABLE });
    return;
  }

  claimed.release();
  if (expired(sess)) markComplete(res, req, sess);
  else writeSession(res, sess);

  json(res, 200, {
    ...publicSession(sess),
    topic,
    heard: userText,
    reply,
    audio,
    mime: "audio/mpeg"
  });
}

handler.config = { api: { bodyParser: false }, maxDuration: 30 };
module.exports = handler;
