/**
 * Fund house agent wallets with MON (gas) and $ARENA tokens.
 *
 * Reads deployer key and house agent keys from env.
 * Run once after token launch:
 *   cd backend && npx tsx scripts/fund-house-agents.ts
 */
import 'dotenv/config';
import { createPublicClient, createWalletClient, http, parseEther, formatEther, parseUnits, formatUnits } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

const CHAIN_ID = parseInt(process.env.MONAD_CHAIN_ID || '143');
const RPC_URL = process.env.MONAD_RPC_URL || 'https://monad-mainnet.drpc.org';

const chain = {
  id: CHAIN_ID,
  name: 'Monad',
  nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
};

const ERC20_ABI = [
  {
    type: 'function',
    name: 'transfer',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'balanceOf',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
] as const;

const MON_PER_AGENT = '0.01'; // 0.01 MON for gas
const ARENA_PER_AGENT = '500'; // 500 ARENA tokens

const HOUSE_AGENT_KEYS = ['HOUSE_AGENT_1_KEY', 'HOUSE_AGENT_2_KEY', 'HOUSE_AGENT_3_KEY'];

async function main() {
  const deployerKey = process.env.MONAD_DEPLOYER_KEY;
  if (!deployerKey) throw new Error('Set MONAD_DEPLOYER_KEY in .env');

  const tokenAddress = process.env.ARENA_TOKEN_ADDRESS;
  if (!tokenAddress) throw new Error('Set ARENA_TOKEN_ADDRESS in .env');

  const deployer = privateKeyToAccount(deployerKey as `0x${string}`);
  const publicClient = createPublicClient({ chain, transport: http(RPC_URL) });
  const walletClient = createWalletClient({ account: deployer, chain, transport: http(RPC_URL) });

  console.log(`\nDeployer: ${deployer.address}`);
  const deployerBal = await publicClient.getBalance({ address: deployer.address });
  console.log(`MON balance: ${formatEther(deployerBal)}`);

  const deployerArena = await publicClient.readContract({
    address: tokenAddress as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [deployer.address],
  });
  console.log(`ARENA balance: ${formatUnits(deployerArena, 18)}\n`);

  for (const envKey of HOUSE_AGENT_KEYS) {
    const key = process.env[envKey];
    if (!key) {
      console.log(`⚠️  ${envKey} not set — skipping`);
      continue;
    }

    const account = privateKeyToAccount(key as `0x${string}`);
    console.log(`--- ${envKey} → ${account.address} ---`);

    // Send MON for gas
    console.log(`  Sending ${MON_PER_AGENT} MON...`);
    const monHash = await walletClient.sendTransaction({
      to: account.address,
      value: parseEther(MON_PER_AGENT),
      chain,
    });
    await publicClient.waitForTransactionReceipt({ hash: monHash });
    console.log(`  ✅ MON sent (tx: ${monHash.slice(0, 14)}...)`);

    // Send ARENA tokens
    console.log(`  Sending ${ARENA_PER_AGENT} ARENA...`);
    const arenaHash = await walletClient.writeContract({
      address: tokenAddress as `0x${string}`,
      abi: ERC20_ABI,
      functionName: 'transfer',
      args: [account.address, parseUnits(ARENA_PER_AGENT, 18)],
      chain,
    });
    await publicClient.waitForTransactionReceipt({ hash: arenaHash });
    console.log(`  ✅ ARENA sent (tx: ${arenaHash.slice(0, 14)}...)\n`);
  }

  console.log('🎉 All house agents funded!');
}

main().catch((err) => {
  console.error('❌ Funding failed:', err.message);
  process.exit(1);
});
