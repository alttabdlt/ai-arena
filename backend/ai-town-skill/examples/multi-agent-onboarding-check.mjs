import { AITownExternalClient, generateEd25519Keypair } from '../sdk/ai-town-external-client.mjs';

const SERVER_URL = process.env.AI_TOWN_SERVER_URL || 'http://localhost:4000';

function nowTag() {
  return `${Date.now()}_${Math.floor(Math.random() * 1000)}`;
}

function summarize(step, payload) {
  return { step, ...payload };
}

async function run() {
  const out = [];
  const rootClient = new AITownExternalClient({ serverUrl: SERVER_URL });
  const discovery = await rootClient.discovery();
  out.push(summarize('discovery', {
    protocol: discovery.protocol,
    signedClaimRequired: discovery.auth?.signedClaimRequired,
    legacyApiKeyAccepted: discovery.auth?.legacyApiKeyAccepted,
  }));

  const keysA = generateEd25519Keypair();
  const keysB = generateEd25519Keypair();
  const nameA = `SDKEdgeA_${nowTag()}`;
  const nameB = `SDKEdgeB_${nowTag()}`;

  const clientA = new AITownExternalClient({ serverUrl: SERVER_URL });
  const clientB = new AITownExternalClient({ serverUrl: SERVER_URL });

  const [aRes, bRes] = await Promise.all([
    clientA.joinAndClaim({ name: nameA, archetype: 'CHAMELEON', authSecretHex: keysA.authSecretHex }),
    clientB.joinAndClaim({ name: nameB, archetype: 'SHARK', authSecretHex: keysB.authSecretHex }),
  ]);
  out.push(summarize('join_and_claim_parallel', {
    agentA: aRes.joined?.agentId || null,
    agentB: bRes.joined?.agentId || null,
    accessA: Boolean(clientA.accessToken),
    accessB: Boolean(clientB.accessToken),
  }));

  const statusA = await clientA.status();
  const statusB = await clientB.status();
  out.push(summarize('status_parallel', {
    nameA: statusA.name,
    nameB: statusB.name,
    bankrollA: statusA.bankroll,
    bankrollB: statusB.bankroll,
  }));

  const oldRefresh = clientA.refreshToken;
  const refreshed = await clientA.refreshSession();
  out.push(summarize('refresh_rotation', {
    rotated: Boolean(oldRefresh && oldRefresh !== refreshed.refreshToken),
    hasNewAccess: Boolean(refreshed.accessToken),
  }));

  let reuseError = null;
  try {
    const temp = new AITownExternalClient({ serverUrl: SERVER_URL });
    temp.refreshToken = oldRefresh;
    await temp.refreshSession();
  } catch (err) {
    reuseError = String(err?.message || err);
  }
  out.push(summarize('refresh_reuse_rejected', { ok: Boolean(reuseError), message: reuseError }));

  const bad = new AITownExternalClient({ serverUrl: SERVER_URL, accessToken: 'exta_invalid_token' });
  let invalidTokenError = null;
  try {
    await bad.status();
  } catch (err) {
    invalidTokenError = String(err?.message || err);
  }
  out.push(summarize('invalid_access_rejected', { ok: Boolean(invalidTokenError), message: invalidTokenError }));

  console.log(JSON.stringify({ serverUrl: SERVER_URL, checks: out }, null, 2));
}

run().catch((err) => {
  console.error(JSON.stringify({ error: String(err?.message || err) }, null, 2));
  process.exit(1);
});
