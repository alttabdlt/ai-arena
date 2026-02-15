import { randomBytes, createHash } from 'crypto';
import nacl from 'tweetnacl';

type EnrollmentRecord = {
  enrollmentId: string;
  agentId: string;
  authPubkey: Uint8Array;
  challenge: string;
  expiresAtMs: number;
  consumed: boolean;
};

type AccessSession = {
  token: string;
  agentId: string;
  expiresAtMs: number;
};

type RefreshSession = {
  token: string;
  agentId: string;
  expiresAtMs: number;
};

export type EnrollmentChallenge = {
  enrollmentId: string;
  challenge: string;
  expiresAt: string;
};

export type SessionBundle = {
  accessToken: string;
  refreshToken: string;
  accessExpiresAt: string;
  refreshExpiresAt: string;
};

function boolEnv(name: string, fallback: boolean): boolean {
  const raw = String(process.env[name] || '').trim().toLowerCase();
  if (!raw) return fallback;
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';
}

function intEnv(name: string, fallback: number): number {
  const parsed = Number.parseInt(String(process.env[name] || ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseAuthPubkey(input: string): Uint8Array {
  const value = String(input || '').trim();
  if (!value) throw new Error('authPubkey is required');

  let bytes: Buffer;
  if (/^[a-fA-F0-9]+$/.test(value)) {
    bytes = Buffer.from(value, 'hex');
  } else {
    bytes = Buffer.from(value, 'base64');
  }
  if (bytes.length !== nacl.sign.publicKeyLength) {
    throw new Error('authPubkey must be 32-byte ed25519 key (hex or base64)');
  }
  return new Uint8Array(bytes);
}

function parseSignature(input: string): Uint8Array {
  const value = String(input || '').trim();
  if (!value) throw new Error('signature is required');

  let bytes: Buffer;
  if (/^[a-fA-F0-9]+$/.test(value)) {
    bytes = Buffer.from(value, 'hex');
  } else {
    bytes = Buffer.from(value, 'base64');
  }
  if (bytes.length !== nacl.sign.signatureLength) {
    throw new Error('signature must be 64-byte ed25519 signature (hex or base64)');
  }
  return new Uint8Array(bytes);
}

export class ExternalAgentAuthService {
  private readonly requireSignedClaim: boolean;
  private readonly allowLegacyApiKeyAuth: boolean;
  private readonly includeApiKeyInJoinResponse: boolean;
  private readonly enrollmentTtlMs: number;
  private readonly accessTtlMs: number;
  private readonly refreshTtlMs: number;
  private readonly enrollments = new Map<string, EnrollmentRecord>();
  private readonly accessSessions = new Map<string, AccessSession>();
  private readonly refreshSessions = new Map<string, RefreshSession>();

  constructor() {
    this.requireSignedClaim = boolEnv('EXTERNAL_REQUIRE_SIGNED_CLAIM', true);
    this.allowLegacyApiKeyAuth = boolEnv('EXTERNAL_ALLOW_LEGACY_API_KEY_AUTH', true);
    this.includeApiKeyInJoinResponse = boolEnv('EXTERNAL_JOIN_INCLUDE_API_KEY', false);
    this.enrollmentTtlMs = intEnv('EXTERNAL_ENROLLMENT_TTL_MS', 10 * 60 * 1000);
    this.accessTtlMs = intEnv('EXTERNAL_ACCESS_TTL_MS', 30 * 60 * 1000);
    this.refreshTtlMs = intEnv('EXTERNAL_REFRESH_TTL_MS', 7 * 24 * 60 * 60 * 1000);
  }

  private prune(nowMs = Date.now()): void {
    for (const [id, rec] of this.enrollments.entries()) {
      if (rec.expiresAtMs <= nowMs || rec.consumed) this.enrollments.delete(id);
    }
    for (const [token, session] of this.accessSessions.entries()) {
      if (session.expiresAtMs <= nowMs) this.accessSessions.delete(token);
    }
    for (const [token, session] of this.refreshSessions.entries()) {
      if (session.expiresAtMs <= nowMs) this.refreshSessions.delete(token);
    }
  }

  isSignedClaimRequired(): boolean {
    return this.requireSignedClaim;
  }

  shouldAllowLegacyApiKeyAuth(): boolean {
    return this.allowLegacyApiKeyAuth;
  }

  shouldExposeApiKeyOnJoin(): boolean {
    return this.includeApiKeyInJoinResponse;
  }

  validateAuthPubkey(authPubkeyRaw: string): void {
    parseAuthPubkey(authPubkeyRaw);
  }

  createEnrollmentChallenge(agentId: string, authPubkeyRaw: string): EnrollmentChallenge {
    const authPubkey = parseAuthPubkey(authPubkeyRaw);
    const nowMs = Date.now();
    const enrollmentId = randomBytes(16).toString('hex');
    const expiresAtMs = nowMs + this.enrollmentTtlMs;
    const challenge = `AI_TOWN_ENROLL:${enrollmentId}:${agentId}:${expiresAtMs}`;
    this.enrollments.set(enrollmentId, {
      enrollmentId,
      agentId,
      authPubkey,
      challenge,
      expiresAtMs,
      consumed: false,
    });
    this.prune(nowMs);
    return {
      enrollmentId,
      challenge,
      expiresAt: new Date(expiresAtMs).toISOString(),
    };
  }

  claimEnrollment(input: { enrollmentId: string; signature: string; authPubkey: string }): { agentId: string; session: SessionBundle } {
    const enrollmentId = String(input.enrollmentId || '').trim();
    if (!enrollmentId) throw new Error('enrollmentId is required');

    const signature = parseSignature(input.signature);
    const authPubkey = parseAuthPubkey(input.authPubkey);
    const nowMs = Date.now();
    this.prune(nowMs);

    const record = this.enrollments.get(enrollmentId);
    if (!record) throw new Error('Enrollment challenge expired or invalid');
    if (record.consumed) throw new Error('Enrollment challenge already consumed');
    if (record.expiresAtMs <= nowMs) {
      this.enrollments.delete(enrollmentId);
      throw new Error('Enrollment challenge expired');
    }

    if (record.authPubkey.length !== authPubkey.length || !record.authPubkey.every((v, i) => v === authPubkey[i])) {
      throw new Error('authPubkey mismatch for enrollment');
    }

    const payload = new Uint8Array(Buffer.from(record.challenge, 'utf8'));
    const ok = nacl.sign.detached.verify(payload, signature, authPubkey);
    if (!ok) throw new Error('Invalid enrollment signature');

    record.consumed = true;
    this.enrollments.set(enrollmentId, record);
    const session = this.issueSession(record.agentId, nowMs);
    return { agentId: record.agentId, session };
  }

  refreshSession(refreshTokenRaw: string): { agentId: string; session: SessionBundle } {
    const refreshToken = String(refreshTokenRaw || '').trim();
    if (!refreshToken) throw new Error('refreshToken is required');
    const nowMs = Date.now();
    this.prune(nowMs);

    const rec = this.refreshSessions.get(refreshToken);
    if (!rec || rec.expiresAtMs <= nowMs) {
      this.refreshSessions.delete(refreshToken);
      throw new Error('Refresh token expired or invalid');
    }

    this.refreshSessions.delete(refreshToken);
    const session = this.issueSession(rec.agentId, nowMs);
    return { agentId: rec.agentId, session };
  }

  authenticateAccessToken(tokenRaw: string): string | null {
    const token = String(tokenRaw || '').trim();
    if (!token) return null;
    const nowMs = Date.now();
    this.prune(nowMs);
    const rec = this.accessSessions.get(token);
    if (!rec || rec.expiresAtMs <= nowMs) {
      this.accessSessions.delete(token);
      return null;
    }
    return rec.agentId;
  }

  private issueSession(agentId: string, nowMs = Date.now()): SessionBundle {
    const accessToken = `exta_${randomBytes(24).toString('hex')}`;
    const refreshToken = `extr_${randomBytes(24).toString('hex')}`;
    const accessExpiresAtMs = nowMs + this.accessTtlMs;
    const refreshExpiresAtMs = nowMs + this.refreshTtlMs;

    this.accessSessions.set(accessToken, {
      token: accessToken,
      agentId,
      expiresAtMs: accessExpiresAtMs,
    });
    this.refreshSessions.set(refreshToken, {
      token: refreshToken,
      agentId,
      expiresAtMs: refreshExpiresAtMs,
    });
    return {
      accessToken,
      refreshToken,
      accessExpiresAt: new Date(accessExpiresAtMs).toISOString(),
      refreshExpiresAt: new Date(refreshExpiresAtMs).toISOString(),
    };
  }

  // For deterministic assertions in tests and smoke scripts only.
  debugState() {
    this.prune(Date.now());
    return {
      enrollmentCount: this.enrollments.size,
      accessSessionCount: this.accessSessions.size,
      refreshSessionCount: this.refreshSessions.size,
      checksum: createHash('sha256')
        .update(`${this.enrollments.size}:${this.accessSessions.size}:${this.refreshSessions.size}`)
        .digest('hex')
        .slice(0, 16),
    };
  }
}

export const externalAgentAuthService = new ExternalAgentAuthService();
