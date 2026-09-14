const { describe, it, before, beforeEach, after } = require("node:test");
const assert = require("node:assert/strict");
const session = require("./session");
const turn = require("./turn");
const {
  COOKIE,
  USED_COOKIE,
  sign,
  ipHash,
  resetInflight,
  MAX_AUDIO_BYTES,
  MAX_TTS_BYTES,
  MSG_COMPLETE,
  MSG_UNAVAILABLE
} = require("./_lib");

function mockReq({ method = "POST", cookie = "", body = {}, ip = "203.0.113.10" } = {}) {
  return {
    method,
    headers: { cookie, "x-forwarded-for": ip },
    socket: { remoteAddress: ip },
    body
  };
}

function mockRes() {
  const headers = {};
  return {
    statusCode: 0,
    body: "",
    setHeader(k, v) {
      headers[k] = v;
    },
    getHeader(k) {
      return headers[k];
    },
    end(s) {
      this.body = s;
    }
  };
}

function parsed(res) {
  return JSON.parse(res.body);
}

function clientCookies(res, prev = "") {
  const map = {};
  prev.split(/;\s*/).forEach((p) => {
    const eq = p.indexOf("=");
    if (eq > 0) map[p.slice(0, eq)] = p.slice(eq + 1);
  });
  [].concat(res.getHeader("Set-Cookie") || []).forEach((c) => {
    const nv = String(c).split(";")[0];
    const eq = nv.indexOf("=");
    if (eq > 0) map[nv.slice(0, eq)] = nv.slice(eq + 1);
  });
  return Object.entries(map)
    .map(([k, v]) => k + "=" + v)
    .join("; ");
}

function hasCookie(res, name) {
  return [].concat(res.getHeader("Set-Cookie") || []).some((c) => String(c).startsWith(name + "="));
}

function tinyAudio() {
  return Buffer.from("webm-test").toString("base64");
}

function ipReq(cookie, body) {
  return mockReq({ cookie, body, ip: "203.0.113.10" });
}

describe("J.AI session + turn protection", () => {
  const prevSecret = process.env.JAI_SESSION_SECRET;
  const prevKey = process.env.OPENAI_API_KEY;
  let fetchCalls;

  before(() => {
    process.env.JAI_SESSION_SECRET = "j".repeat(32);
    process.env.OPENAI_API_KEY = "test-not-a-real-key";
  });

  after(() => {
    process.env.JAI_SESSION_SECRET = prevSecret;
    process.env.OPENAI_API_KEY = prevKey;
  });

  beforeEach(() => {
    resetInflight();
    fetchCalls = [];
    global.fetch = async (url, opts) => {
      fetchCalls.push(String(url));
      if (String(url).includes("/audio/transcriptions")) {
        return { ok: true, json: async () => ({ text: "tell me about the stack" }) };
      }
      if (String(url).includes("/chat/completions")) {
        return { ok: true, json: async () => ({ choices: [{ message: { content: "Jamel builds Next.js and Express apps." } }] }) };
      }
      if (String(url).includes("/audio/speech")) {
        return { ok: true, arrayBuffer: async () => new Uint8Array(32).buffer };
      }
      return { ok: false, json: async () => ({}) };
    };
  });

  it("GET cannot mint a session", async () => {
    const res = mockRes();
    await session(mockReq({ method: "GET" }), res);
    assert.equal(res.statusCode, 405);
    assert.equal(hasCookie(res, COOKIE), false);
    assert.equal(parsed(res).status, "unavailable");
  });

  it("POST can create a session", async () => {
    const res = mockRes();
    await session(mockReq({ method: "POST" }), res);
    assert.equal(res.statusCode, 200);
    assert.equal(parsed(res).status, "available");
    assert.equal(parsed(res).remainingTurns, 3);
    assert.equal(hasCookie(res, COOKIE), true);
  });

  it("does not replace a valid existing session", async () => {
    const first = mockRes();
    await session(mockReq({ method: "POST" }), first);
    const cookie = clientCookies(first);
    const second = mockRes();
    await session(ipReq(cookie), second);
    assert.equal(parsed(second).status, "available");
    assert.equal(parsed(second).remainingTurns, 3);
    assert.equal(hasCookie(second, COOKIE), false);
  });

  it("already-used visitor cannot create another demo", async () => {
    const minted = mockRes();
    await session(mockReq({ method: "POST" }), minted);
    const req = ipReq(clientCookies(minted));
    const used = mockRes();
    const payload = { t: "used", exp: Date.now() + 86400000, ip: ipHash(req) };
    req.headers.cookie = clientCookies(minted) + "; " + USED_COOKIE + "=" + sign(payload);
    await session(req, used);
    assert.equal(parsed(used).status, "complete");
    assert.equal(parsed(used).message, MSG_COMPLETE);
    assert.equal(hasCookie(used, COOKIE), false);
  });

  it("missing/invalid session is rejected on turn", async () => {
    const res = mockRes();
    await turn(ipReq("", { topic: "stack", audio: tinyAudio(), mime: "audio/webm" }), res);
    assert.equal(res.statusCode, 409);
    assert.equal(fetchCalls.length, 0);
  });

  it("expired session is complete and marked used", async () => {
    const req = mockReq();
    const token = sign({
      id: "old",
      ip: ipHash(req),
      started: Date.now() - 120000,
      turns: 0,
      complete: false
    });
    req.headers.cookie = COOKIE + "=" + token;
    const res = mockRes();
    await turn(req, res);
    assert.equal(parsed(res).status, "complete");
    assert.equal(hasCookie(res, USED_COOKIE), true);
    assert.equal(fetchCalls.length, 0);
  });

  it("invalid audio MIME is rejected before OpenAI", async () => {
    const minted = mockRes();
    await session(mockReq({ method: "POST" }), minted);
    const res = mockRes();
    await turn(ipReq(clientCookies(minted), { topic: "stack", audio: tinyAudio(), mime: "audio/wav" }), res);
    assert.equal(res.statusCode, 400);
    assert.equal(fetchCalls.length, 0);
  });

  it("oversized audio is rejected before OpenAI", async () => {
    const minted = mockRes();
    await session(mockReq({ method: "POST" }), minted);
    const res = mockRes();
    const audio = Buffer.alloc(MAX_AUDIO_BYTES + 1).toString("base64");
    await turn(ipReq(clientCookies(minted), { topic: "stack", audio, mime: "audio/webm" }), res);
    assert.equal(res.statusCode, 413);
    assert.equal(fetchCalls.length, 0);
  });

  it("missing audio is rejected before OpenAI", async () => {
    const minted = mockRes();
    await session(mockReq({ method: "POST" }), minted);
    const res = mockRes();
    await turn(ipReq(clientCookies(minted), { topic: "stack", mime: "audio/webm" }), res);
    assert.equal(res.statusCode, 400);
    assert.equal(fetchCalls.length, 0);
  });

  it("enforces a 3-turn limit", async () => {
    const minted = mockRes();
    await session(mockReq({ method: "POST" }), minted);
    let cookie = clientCookies(minted);
    for (let i = 0; i < 3; i++) {
      const res = mockRes();
      await turn(ipReq(cookie, { topic: "stack", audio: tinyAudio(), mime: "audio/webm" }), res);
      assert.equal(res.statusCode, 200);
      cookie = clientCookies(res, cookie);
    }
    const last = mockRes();
    await turn(ipReq(cookie, { topic: "food", audio: tinyAudio(), mime: "audio/webm" }), last);
    assert.equal(parsed(last).status, "complete");
    assert.equal(parsed(last).message, MSG_COMPLETE);
  });

  it("rejects a parallel second turn before OpenAI doubles", async () => {
    const minted = mockRes();
    await session(mockReq({ method: "POST" }), minted);
    const cookie = clientCookies(minted);
    let release;
    let started;
    const startedP = new Promise((r) => {
      started = r;
    });
    global.fetch = async (url) => {
      fetchCalls.push(String(url));
      if (String(url).includes("/audio/transcriptions")) {
        started();
        await new Promise((r) => {
          release = r;
        });
        return { ok: true, json: async () => ({ text: "projects" }) };
      }
      if (String(url).includes("/chat/completions")) {
        return { ok: true, json: async () => ({ choices: [{ message: { content: "Jamel ships web apps." } }] }) };
      }
      return { ok: true, arrayBuffer: async () => new Uint8Array(8).buffer };
    };
    const a = mockRes();
    const b = mockRes();
    const p1 = turn(ipReq(cookie, { topic: "projects", audio: tinyAudio(), mime: "audio/webm" }), a);
    await startedP;
    const p2 = turn(ipReq(cookie, { topic: "stack", audio: tinyAudio(), mime: "audio/webm" }), b);
    await p2;
    assert.equal(b.statusCode, 429);
    assert.equal(parsed(b).message, MSG_UNAVAILABLE);
    release();
    await p1;
    assert.equal(a.statusCode, 200);
    assert.equal(fetchCalls.filter((u) => u.includes("/audio/transcriptions")).length, 1);
  });

  it("rejects oversized TTS before returning audio", async () => {
    const minted = mockRes();
    await session(mockReq({ method: "POST" }), minted);
    global.fetch = async (url) => {
      fetchCalls.push(String(url));
      if (String(url).includes("/audio/transcriptions")) {
        return { ok: true, json: async () => ({ text: "stack" }) };
      }
      if (String(url).includes("/chat/completions")) {
        return { ok: true, json: async () => ({ choices: [{ message: { content: "Jamel uses TypeScript." } }] }) };
      }
      return { ok: true, arrayBuffer: async () => new Uint8Array(MAX_TTS_BYTES + 1).buffer };
    };
    const res = mockRes();
    await turn(ipReq(clientCookies(minted), { topic: "stack", audio: tinyAudio(), mime: "audio/webm" }), res);
    assert.equal(res.statusCode, 503);
    assert.equal(parsed(res).audio, undefined);
  });

  it("rejects missing or short JAI_SESSION_SECRET", async () => {
    const keep = process.env.JAI_SESSION_SECRET;
    process.env.JAI_SESSION_SECRET = "short";
    const res = mockRes();
    await session(mockReq({ method: "POST" }), res);
    assert.equal(res.statusCode, 503);
    assert.equal(parsed(res).message, MSG_UNAVAILABLE);
    process.env.JAI_SESSION_SECRET = keep;
  });
});
