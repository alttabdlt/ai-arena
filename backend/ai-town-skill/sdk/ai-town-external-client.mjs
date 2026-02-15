import nacl from 'tweetnacl';

function trimSlash(value) {
  return String(value || '').replace(/\/+$/, '');
}

function toHex(bytes) {
  return Buffer.from(bytes).toString('hex');
}

function fromHex(value) {
  if (!/^[a-fA-F0-9]+$/.test(value) || value.length % 2 !== 0) {
    throw new Error('Expected hex string');
  }
  return new Uint8Array(Buffer.from(value, 'hex'));
}

function signChallenge(challenge, secretHex) {
  const payload = new Uint8Array(Buffer.from(String(challenge || ''), 'utf8'));
  const secret = fromHex(String(secretHex || '').trim());
  if (secret.length !== nacl.sign.secretKeyLength) {
    throw new Error('authSecretHex must be a 64-byte ed25519 secret key (hex)');
  }
  const sig = nacl.sign.detached(payload, secret);
  return toHex(sig);
}

function derivePubkeyHex(secretHex) {
  const secret = fromHex(String(secretHex || '').trim());
  if (secret.length !== nacl.sign.secretKeyLength) {
    throw new Error('authSecretHex must be a 64-byte ed25519 secret key (hex)');
  }
  const pair = nacl.sign.keyPair.fromSecretKey(secret);
  return toHex(pair.publicKey);
}

async function parseJson(res) {
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = typeof json?.error === 'string' ? json.error : `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return json;
}

export function generateEd25519Keypair() {
  const pair = nacl.sign.keyPair();
  return {
    authPubkeyHex: toHex(pair.publicKey),
    authSecretHex: toHex(pair.secretKey),
  };
}

export class AITownExternalClient {
  constructor(opts = {}) {
    const serverUrl = trimSlash(opts.serverUrl || process.env.AI_TOWN_SERVER_URL || 'http://localhost:4000');
    this.apiBase = trimSlash(opts.apiBase || `${serverUrl}/api/v1`);
    this.fetchImpl = opts.fetchImpl || fetch;
    this.accessToken = opts.accessToken || null;
    this.refreshToken = opts.refreshToken || null;
    this.legacyApiKey = opts.legacyApiKey || null;
    this.agentId = opts.agentId || null;
  }

  authToken() {
    return this.accessToken || this.legacyApiKey || null;
  }

  async request(path, init = {}) {
    const res = await this.fetchImpl(`${this.apiBase}${path}`, init);
    return parseJson(res);
  }

  async requestAuthed(path, init = {}, retried = false) {
    const token = this.authToken();
    if (!token) throw new Error('No auth token present. Run joinAndClaim or set accessToken/apiKey first.');
    const headers = {
      ...(init.headers || {}),
      Authorization: `Bearer ${token}`,
    };
    const res = await this.fetchImpl(`${this.apiBase}${path}`, { ...init, headers });
    if (res.status === 401 && !retried && this.refreshToken) {
      await this.refreshSession();
      return this.requestAuthed(path, init, true);
    }
    return parseJson(res);
  }

  async discovery() {
    return this.request('/external/discovery');
  }

  async join({ name, personality = '', archetype = 'CHAMELEON', authPubkeyHex } = {}) {
    return this.request('/external/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        personality,
        archetype,
        ...(authPubkeyHex ? { authPubkey: authPubkeyHex } : {}),
      }),
    });
  }

  async claim({ enrollmentId, challenge, authSecretHex, authPubkeyHex }) {
    const pubkey = authPubkeyHex || derivePubkeyHex(authSecretHex);
    const signature = signChallenge(challenge, authSecretHex);
    const claimed = await this.request('/external/claim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        enrollmentId,
        authPubkey: pubkey,
        signature,
      }),
    });
    this.accessToken = claimed.accessToken || null;
    this.refreshToken = claimed.refreshToken || null;
    this.agentId = claimed.agentId || this.agentId;
    return claimed;
  }

  async joinAndClaim({ name, personality = '', archetype = 'CHAMELEON', authSecretHex, authPubkeyHex } = {}) {
    const pubkey = authPubkeyHex || (authSecretHex ? derivePubkeyHex(authSecretHex) : null);
    const joined = await this.join({
      name,
      personality,
      archetype,
      ...(pubkey ? { authPubkeyHex: pubkey } : {}),
    });
    this.agentId = joined.agentId || this.agentId;

    const onboarding = joined.onboarding || null;
    if (onboarding?.mode === 'signed_claim') {
      if (!authSecretHex) throw new Error('authSecretHex is required for signed_claim onboarding');
      const claimed = await this.claim({
        enrollmentId: onboarding.enrollmentId,
        challenge: onboarding.challenge,
        authSecretHex,
        authPubkeyHex: pubkey || undefined,
      });
      return { joined, claimed };
    }

    if (joined.apiKey) {
      this.legacyApiKey = joined.apiKey;
      return { joined, claimed: null };
    }

    throw new Error('Join completed but no signed challenge or apiKey returned');
  }

  async refreshSession() {
    if (!this.refreshToken) throw new Error('No refresh token present');
    const refreshed = await this.request('/external/session/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: this.refreshToken }),
    });
    this.accessToken = refreshed.accessToken || null;
    this.refreshToken = refreshed.refreshToken || null;
    this.agentId = refreshed.agentId || this.agentId;
    return refreshed;
  }

  async status() {
    return this.requestAuthed('/external/status');
  }

  async observe() {
    return this.requestAuthed('/external/observe');
  }

  async events({ since } = {}) {
    const query = Number.isFinite(Number(since)) ? `?since=${Number(since)}` : '';
    return this.requestAuthed(`/external/events${query}`);
  }

  async act({ type, reasoning, details = {} } = {}) {
    return this.requestAuthed('/external/act', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, reasoning, details }),
    });
  }

  async pokerMove({ action, amount = 0, reasoning = '', quip = '' } = {}) {
    return this.requestAuthed('/external/act/poker-move', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, amount, reasoning, quip }),
    });
  }
}

export default {
  AITownExternalClient,
  generateEd25519Keypair,
};
