/**
 * Generate 3 house agent wallets for AI Arena.
 *
 * Usage:
 *   npx tsx scripts/generate-house-wallets.ts
 *
 * Prints private keys + addresses to stdout.
 * Copy the output into your .env file.
 */

import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';

const AGENTS = [
  { envKey: 'HOUSE_AGENT_1_KEY', name: 'Arena Guardian (ROCK)' },
  { envKey: 'HOUSE_AGENT_2_KEY', name: 'Arena Dealer (CHAMELEON)' },
  { envKey: 'HOUSE_AGENT_3_KEY', name: 'Arena Wildcard (DEGEN)' },
];

console.log('# House Agent Wallets — generated', new Date().toISOString());
console.log('# Add these to your .env file\n');

for (const agent of AGENTS) {
  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);
  console.log(`# ${agent.name}`);
  console.log(`# Address: ${account.address}`);
  console.log(`${agent.envKey}=${privateKey}\n`);
}
