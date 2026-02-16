/**
 * Launch $ARENA token on nad.fun
 * 
 * Flow: Upload image → Upload metadata → Mine salt → Create on-chain
 * 
 * Usage:
 *   NETWORK=testnet npx tsx scripts/launch-token.ts
 *   NETWORK=mainnet npx tsx scripts/launch-token.ts
 */

import 'dotenv/config';
import { createPublicClient, createWalletClient, http, formatEther, parseEther, decodeEventLog } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import fs from 'fs';
import path from 'path';

// ============================================================================
// CONFIG
// ============================================================================

const NETWORK = (process.env.NETWORK || 'testnet') as 'testnet' | 'mainnet';

const CONFIGS = {
  testnet: {
    chainId: 10143,
    rpcUrl: 'https://monad-testnet.drpc.org',
    apiUrl: 'https://dev-api.nad.fun',
    BONDING_CURVE_ROUTER: '0x865054F0F6A288adaAc30261731361EA7E908003' as `0x${string}`,
    LENS: '0xB056d79CA5257589692699a46623F901a3BB76f1' as `0x${string}`,
    CURVE: '0x1228b0dc9481C11D3071E7A924B794CfB038994e' as `0x${string}`,
  },
  mainnet: {
    chainId: 143,
    rpcUrl: 'https://monad-mainnet.drpc.org',
    apiUrl: 'https://api.nadapp.net',
    BONDING_CURVE_ROUTER: '0x6F6B8F1a20703309951a5127c45B49b1CD981A22' as `0x${string}`,
    LENS: '0x7e78A8DE94f21804F7a17F4E8BF9EC2c872187ea' as `0x${string}`,
    CURVE: '0xA7283d07812a02AFB7C09B60f8896bCEA3F90aCE' as `0x${string}`,
  },
};

const CONFIG = CONFIGS[NETWORK];

const chain = {
  id: CONFIG.chainId,
  name: 'Monad',
  nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 },
  rpcUrls: { default: { http: [CONFIG.rpcUrl] } },
};

// Token details
const TOKEN = {
  name: 'AI Arena',
  symbol: 'ARENA',
  description: 'The currency of AI Town — where AI agents autonomously build virtual civilizations. Every building, every design decision, every piece of town lore is created by LLM inference. $ARENA powers the economy: agents spend it to claim plots and build, earn it through mining (computational work), and receive passive yields from completed towns. Proof of Inference meets Proof of Stake.',
  website: 'https://github.com/axel-codes/ai-arena',
  twitter: 'https://x.com/axeeeeeeeel',
  telegram: 'https://t.me/Ai_Town_Bot',
};

// ABIs (minimal)
const curveAbi = [
  {
    type: 'function',
    name: 'feeConfig',
    inputs: [],
    outputs: [
      { name: 'deployFeeAmount', type: 'uint256' },
      { name: 'graduateFeeAmount', type: 'uint256' },
      { name: 'protocolFee', type: 'uint24' },
    ],
    stateMutability: 'view',
  },
] as const;

const lensAbi = [
  {
    type: 'function',
    name: 'getInitialBuyAmountOut',
    inputs: [{ name: 'amountIn', type: 'uint256' }],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
] as const;

const bondingCurveRouterAbi = [
  {
    type: 'function',
    name: 'create',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'name', type: 'string' },
          { name: 'symbol', type: 'string' },
          { name: 'tokenURI', type: 'string' },
          { name: 'amountOut', type: 'uint256' },
          { name: 'salt', type: 'bytes32' },
          { name: 'actionId', type: 'uint8' },
        ],
      },
    ],
    outputs: [],
    stateMutability: 'payable',
  },
] as const;

const curveCreateEventAbi = [
  {
    type: 'event',
    name: 'CurveCreate',
    inputs: [
      { name: 'token', type: 'address', indexed: true },
      { name: 'pool', type: 'address', indexed: false },
      { name: 'creator', type: 'address', indexed: true },
      { name: 'name', type: 'string', indexed: false },
      { name: 'symbol', type: 'string', indexed: false },
      { name: 'tokenURI', type: 'string', indexed: false },
    ],
  },
] as const;

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  const PRIVATE_KEY = process.env.MONAD_DEPLOYER_KEY;
  if (!PRIVATE_KEY) throw new Error('Set MONAD_DEPLOYER_KEY env var');

  const account = privateKeyToAccount(PRIVATE_KEY as `0x${string}`);
  console.log(`\n🚀 Launching $${TOKEN.symbol} on nad.fun (${NETWORK})`);
  console.log(`   Wallet: ${account.address}`);

  const publicClient = createPublicClient({ chain, transport: http(CONFIG.rpcUrl) });
  const walletClient = createWalletClient({ account, chain, transport: http(CONFIG.rpcUrl) });

  // Check balance
  const balance = await publicClient.getBalance({ address: account.address });
  console.log(`   Balance: ${formatEther(balance)} MON`);

  // Get deploy fee
  const feeConfig = await publicClient.readContract({
    address: CONFIG.CURVE,
    abi: curveAbi,
    functionName: 'feeConfig',
  });
  const deployFee = feeConfig[0];
  console.log(`   Deploy fee: ${formatEther(deployFee)} MON`);

  if (balance < deployFee) {
    console.error(`\n❌ Insufficient balance! Need ${formatEther(deployFee)} MON, have ${formatEther(balance)} MON`);
    process.exit(1);
  }

  // ---- Step 1: Upload Image ----
  console.log('\n📸 Step 1: Uploading token image...');
  const imagePath = path.join(__dirname, '..', 'public', 'arena-token.png');
  if (!fs.existsSync(imagePath)) {
    console.log(`   ⚠️  No image at ${imagePath}`);
    console.log('   Creating a placeholder... (generate a real one later)');
    // We'll generate a token image separately
    throw new Error(`Create a token image at ${imagePath} first!`);
  }

  const imageBuffer = fs.readFileSync(imagePath);
  const imageRes = await fetch(`${CONFIG.apiUrl}/agent/token/image`, {
    method: 'POST',
    headers: { 'Content-Type': 'image/png' },
    body: imageBuffer,
  });
  if (!imageRes.ok) throw new Error(`Image upload failed: ${imageRes.status} ${await imageRes.text()}`);
  const { image_uri, is_nsfw } = await imageRes.json();
  console.log(`   ✅ Image uploaded: ${image_uri}`);
  if (is_nsfw) console.log('   ⚠️  Flagged as NSFW');

  // ---- Step 2: Upload Metadata ----
  console.log('\n📝 Step 2: Uploading metadata...');
  const metadataRes = await fetch(`${CONFIG.apiUrl}/agent/token/metadata`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      image_uri,
      name: TOKEN.name,
      symbol: TOKEN.symbol,
      description: TOKEN.description,
      website: TOKEN.website,
      twitter: TOKEN.twitter,
      telegram: TOKEN.telegram,
    }),
  });
  if (!metadataRes.ok) throw new Error(`Metadata upload failed: ${metadataRes.status} ${await metadataRes.text()}`);
  const { metadata_uri } = await metadataRes.json();
  console.log(`   ✅ Metadata: ${metadata_uri}`);

  // ---- Step 3: Mine Salt ----
  console.log('\n⛏️  Step 3: Mining salt (vanity address ending in 7777)...');
  const saltRes = await fetch(`${CONFIG.apiUrl}/agent/salt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      creator: account.address,
      name: TOKEN.name,
      symbol: TOKEN.symbol,
      metadata_uri,
    }),
  });
  if (!saltRes.ok) throw new Error(`Salt mining failed: ${saltRes.status} ${await saltRes.text()}`);
  const { salt, address: predictedAddress } = await saltRes.json();
  console.log(`   ✅ Salt: ${salt}`);
  console.log(`   📍 Predicted token address: ${predictedAddress}`);

  // ---- Step 4: Create On-Chain ----
  console.log('\n🔗 Step 4: Creating token on-chain...');

  // Optional initial buy (small amount to seed the curve)
  const initialBuyAmount = parseEther('0.1'); // 0.1 MON initial buy
  let minTokens = 0n;
  
  if (initialBuyAmount > 0n && balance > deployFee + initialBuyAmount) {
    try {
      const result = await publicClient.readContract({
        address: CONFIG.LENS,
        abi: lensAbi,
        functionName: 'getInitialBuyAmountOut',
        args: [initialBuyAmount],
      });
      minTokens = (result as bigint * 95n) / 100n; // 5% slippage
      console.log(`   Initial buy: ${formatEther(initialBuyAmount)} MON → ~${formatEther(result as bigint)} ${TOKEN.symbol}`);
    } catch (e: any) {
      console.log(`   Skipping initial buy (quote failed: ${e.message})`);
    }
  } else {
    console.log('   Skipping initial buy (insufficient balance or zero amount)');
  }

  const totalValue = deployFee + (minTokens > 0n ? initialBuyAmount : 0n);
  console.log(`   Total cost: ${formatEther(totalValue)} MON (fee: ${formatEther(deployFee)}, buy: ${formatEther(minTokens > 0n ? initialBuyAmount : 0n)})`);

  const createArgs = {
    name: TOKEN.name,
    symbol: TOKEN.symbol,
    tokenURI: metadata_uri,
    amountOut: minTokens,
    salt: salt as `0x${string}`,
    actionId: 1,
  };

  // Estimate gas
  console.log('   Estimating gas...');
  const estimatedGas = await publicClient.estimateContractGas({
    address: CONFIG.BONDING_CURVE_ROUTER,
    abi: bondingCurveRouterAbi,
    functionName: 'create',
    args: [createArgs],
    account: account.address,
    value: totalValue,
  });
  console.log(`   Gas estimate: ${estimatedGas} (+10% buffer)`);

  // Send transaction
  console.log('   Sending transaction...');
  const hash = await walletClient.writeContract({
    address: CONFIG.BONDING_CURVE_ROUTER,
    abi: bondingCurveRouterAbi,
    functionName: 'create',
    args: [createArgs],
    chain,
    value: totalValue,
    gas: estimatedGas + estimatedGas / 10n,
  });
  console.log(`   📝 TX Hash: ${hash}`);

  // Wait for receipt
  console.log('   Waiting for confirmation...');
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log(`   ⛽ Gas used: ${receipt.gasUsed}`);
  console.log(`   📦 Block: ${receipt.blockNumber}`);

  // Find token address from events
  let tokenAddress = '';
  let poolAddress = '';
  for (const log of receipt.logs) {
    try {
      const event = decodeEventLog({
        abi: curveCreateEventAbi,
        data: log.data,
        topics: log.topics,
      });
      if (event.eventName === 'CurveCreate') {
        tokenAddress = (event.args as any).token;
        poolAddress = (event.args as any).pool;
        break;
      }
    } catch {}
  }

  if (!tokenAddress) {
    console.log('   ⚠️  Could not decode token address from events');
    console.log('   Check tx manually:', `https://explorer.monad.xyz/tx/${hash}`);
  }

  // ---- Summary ----
  console.log('\n' + '='.repeat(60));
  console.log('🎉 TOKEN LAUNCHED SUCCESSFULLY!');
  console.log('='.repeat(60));
  console.log(`   Name: ${TOKEN.name}`);
  console.log(`   Symbol: $${TOKEN.symbol}`);
  console.log(`   Token Address: ${tokenAddress || predictedAddress}`);
  console.log(`   Pool Address: ${poolAddress || 'check tx'}`);
  console.log(`   TX Hash: ${hash}`);
  console.log(`   Network: ${NETWORK}`);
  console.log(`   nad.fun: https://nad.fun/tokens/${tokenAddress || predictedAddress}`);
  console.log(`   Explorer: https://explorer.monad.xyz/tx/${hash}`);
  console.log('='.repeat(60));

  // Save to file for reference
  const result = {
    name: TOKEN.name,
    symbol: TOKEN.symbol,
    tokenAddress: tokenAddress || predictedAddress,
    poolAddress,
    txHash: hash,
    network: NETWORK,
    createdAt: new Date().toISOString(),
    deployerAddress: account.address,
    imageUri: image_uri,
    metadataUri: metadata_uri,
    salt,
  };
  
  const outPath = path.join(__dirname, '..', 'token-launch-result.json');
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
  console.log(`\n📄 Result saved to ${outPath}`);
}

main().catch((err) => {
  console.error('\n❌ Launch failed:', err.message);
  process.exit(1);
});
