import 'dotenv/config';
import { createPublicClient, http, formatEther, formatUnits, getAddress } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

const RPC = 'https://monad-mainnet.drpc.org';
const chain = { id: 143, name: 'Monad', nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 }, rpcUrls: { default: { http: [RPC] } } };
const TOKEN = getAddress(process.env.ARENA_TOKEN_ADDRESS || '');
const publicClient = createPublicClient({ chain, transport: http(RPC) });

const balanceAbi = [{ type: 'function' as const, name: 'balanceOf' as const, stateMutability: 'view' as const, inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }] }] as const;

const wallets = [
  { label: 'Deployer', key: process.env.MONAD_DEPLOYER_KEY },
  { label: 'Arena Guardian (ROCK)', key: process.env.HOUSE_AGENT_1_KEY },
  { label: 'Arena Dealer (CHAMELEON)', key: process.env.HOUSE_AGENT_2_KEY },
  { label: 'Arena Wildcard (DEGEN)', key: process.env.HOUSE_AGENT_3_KEY },
];

async function main() {
  console.log('Token:', TOKEN, '\n');
  for (const w of wallets) {
    if (!w.key) { console.log(w.label, '— key not set'); continue; }
    const acct = privateKeyToAccount(w.key as `0x${string}`);
    const mon = await publicClient.getBalance({ address: acct.address });
    const arena = await publicClient.readContract({ address: TOKEN, abi: balanceAbi, functionName: 'balanceOf', args: [acct.address] });
    console.log(`${w.label.padEnd(28)} ${acct.address} | ${formatEther(mon).padStart(14)} MON | ${formatUnits(arena, 18).padStart(12)} ARENA`);
  }
}

main().catch(e => { console.error(e.message); process.exit(1); });
