import { afterEach, describe, expect, it } from 'vitest';
import nacl from 'tweetnacl';
import { ExternalAgentAuthService } from './externalAgentAuthService';

function toHex(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('hex');
}

function signHex(message: string, secretKey: Uint8Array): string {
  const sig = nacl.sign.detached(new Uint8Array(Buffer.from(message, 'utf8')), secretKey);
  return toHex(sig);
}

function withEnv(patch: Record<string, string | undefined>): () => void {
  const prev: Record<string, string | undefined> = {};
  Object.keys(patch).forEach((key) => {
    prev[key] = process.env[key];
    const next = patch[key];
    if (next == null) delete process.env[key];
    else process.env[key] = next;
  });
  return () => {
    Object.keys(patch).forEach((key) => {
      const old = prev[key];
      if (old == null) delete process.env[key];
      else process.env[key] = old;
    });
  };
}

describe('ExternalAgentAuthService onboarding edge cases', () => {
  let restoreEnv: (() => void) | null = null;

  afterEach(() => {
    if (restoreEnv) {
      restoreEnv();
      restoreEnv = null;
    }
  });

  it('handles concurrent multi-agent signed onboarding correctly', () => {
    restoreEnv = withEnv({
      EXTERNAL_REQUIRE_SIGNED_CLAIM: '1',
      EXTERNAL_ACCESS_TTL_MS: '600000',
      EXTERNAL_REFRESH_TTL_MS: '600000',
      EXTERNAL_ENROLLMENT_TTL_MS: '600000',
    });
    const service = new ExternalAgentAuthService();

    const aKeys = nacl.sign.keyPair();
    const bKeys = nacl.sign.keyPair();
    const aAgentId = 'agent_alpha';
    const bAgentId = 'agent_beta';

    const aEnrollment = service.createEnrollmentChallenge(aAgentId, toHex(aKeys.publicKey));
    const bEnrollment = service.createEnrollmentChallenge(bAgentId, toHex(bKeys.publicKey));

    const aClaim = service.claimEnrollment({
      enrollmentId: aEnrollment.enrollmentId,
      authPubkey: toHex(aKeys.publicKey),
      signature: signHex(aEnrollment.challenge, aKeys.secretKey),
    });
    const bClaim = service.claimEnrollment({
      enrollmentId: bEnrollment.enrollmentId,
      authPubkey: toHex(bKeys.publicKey),
      signature: signHex(bEnrollment.challenge, bKeys.secretKey),
    });

    expect(aClaim.agentId).toBe(aAgentId);
    expect(bClaim.agentId).toBe(bAgentId);
    expect(service.authenticateAccessToken(aClaim.session.accessToken)).toBe(aAgentId);
    expect(service.authenticateAccessToken(bClaim.session.accessToken)).toBe(bAgentId);
    expect(aClaim.session.accessToken).not.toBe(bClaim.session.accessToken);
  });

  it('rejects mismatched key and invalid signatures', () => {
    restoreEnv = withEnv({ EXTERNAL_REQUIRE_SIGNED_CLAIM: '1' });
    const service = new ExternalAgentAuthService();
    const keys = nacl.sign.keyPair();
    const other = nacl.sign.keyPair();

    const enrollment = service.createEnrollmentChallenge('agent_sigma', toHex(keys.publicKey));

    expect(() =>
      service.claimEnrollment({
        enrollmentId: enrollment.enrollmentId,
        authPubkey: toHex(other.publicKey),
        signature: signHex(enrollment.challenge, other.secretKey),
      }),
    ).toThrow(/authPubkey mismatch/i);

    expect(() =>
      service.claimEnrollment({
        enrollmentId: enrollment.enrollmentId,
        authPubkey: toHex(keys.publicKey),
        signature: signHex(`${enrollment.challenge}:tampered`, keys.secretKey),
      }),
    ).toThrow(/Invalid enrollment signature/i);
  });

  it('prevents claim replay and rotates refresh tokens', () => {
    restoreEnv = withEnv({
      EXTERNAL_REQUIRE_SIGNED_CLAIM: '1',
      EXTERNAL_ACCESS_TTL_MS: '600000',
      EXTERNAL_REFRESH_TTL_MS: '600000',
    });
    const service = new ExternalAgentAuthService();
    const keys = nacl.sign.keyPair();
    const enrollment = service.createEnrollmentChallenge('agent_replay', toHex(keys.publicKey));

    const first = service.claimEnrollment({
      enrollmentId: enrollment.enrollmentId,
      authPubkey: toHex(keys.publicKey),
      signature: signHex(enrollment.challenge, keys.secretKey),
    });

    expect(() =>
      service.claimEnrollment({
        enrollmentId: enrollment.enrollmentId,
        authPubkey: toHex(keys.publicKey),
        signature: signHex(enrollment.challenge, keys.secretKey),
      }),
    ).toThrow(/expired|consumed/i);

    const refreshed = service.refreshSession(first.session.refreshToken);
    expect(refreshed.agentId).toBe('agent_replay');
    expect(refreshed.session.refreshToken).not.toBe(first.session.refreshToken);
    expect(service.authenticateAccessToken(first.session.accessToken)).toBe('agent_replay');
    expect(service.authenticateAccessToken(refreshed.session.accessToken)).toBe('agent_replay');

    expect(() => service.refreshSession(first.session.refreshToken)).toThrow(/expired|invalid/i);
  });

  it('expires enrollment challenges and access sessions', async () => {
    restoreEnv = withEnv({
      EXTERNAL_REQUIRE_SIGNED_CLAIM: '1',
      EXTERNAL_ENROLLMENT_TTL_MS: '5',
      EXTERNAL_ACCESS_TTL_MS: '5',
      EXTERNAL_REFRESH_TTL_MS: '20',
    });
    const service = new ExternalAgentAuthService();
    const keys = nacl.sign.keyPair();
    const enrollment = service.createEnrollmentChallenge('agent_ttl', toHex(keys.publicKey));

    await new Promise((resolve) => setTimeout(resolve, 12));
    expect(() =>
      service.claimEnrollment({
        enrollmentId: enrollment.enrollmentId,
        authPubkey: toHex(keys.publicKey),
        signature: signHex(enrollment.challenge, keys.secretKey),
      }),
    ).toThrow(/expired/i);

    const enrollment2 = service.createEnrollmentChallenge('agent_ttl2', toHex(keys.publicKey));
    const claimed = service.claimEnrollment({
      enrollmentId: enrollment2.enrollmentId,
      authPubkey: toHex(keys.publicKey),
      signature: signHex(enrollment2.challenge, keys.secretKey),
    });
    await new Promise((resolve) => setTimeout(resolve, 12));
    expect(service.authenticateAccessToken(claimed.session.accessToken)).toBeNull();
  });
});
