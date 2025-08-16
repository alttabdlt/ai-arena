#!/usr/bin/env node

import { 
  Connection, 
  Keypair, 
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
  SystemProgram,
  LAMPORTS_PER_SOL
} from '@solana/web3.js';
import {
  createInitializeMintInstruction,
  createInitializeMetadataPointerInstruction,
  createInitializeMintCloseAuthorityInstruction,
  getMintLen,
  ExtensionType,
  TOKEN_2022_PROGRAM_ID,
  createMintToInstruction,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddressSync,
  ASSOCIATED_TOKEN_PROGRAM_ID
} from '@solana/spl-token';
import {
  createInitializeInstruction,
  createUpdateFieldInstruction,
  pack,
  TokenMetadata
} from '@solana/spl-token-metadata';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const DEVNET_URL = 'https://api.devnet.solana.com';

async function createIdleToken() {
  console.log('🚀 Creating $IDLE token on Solana Devnet...\n');

  // Connect to devnet
  const connection = new Connection(DEVNET_URL, 'confirmed');
  
  // Load or create wallet
  const walletPath = path.join(os.homedir(), '.config', 'solana', 'id.json');
  let payer: Keypair;
  
  if (fs.existsSync(walletPath)) {
    console.log('📂 Loading existing wallet from ~/.config/solana/id.json');
    const secretKey = JSON.parse(fs.readFileSync(walletPath, 'utf-8'));
    payer = Keypair.fromSecretKey(Uint8Array.from(secretKey));
  } else {
    console.log('🔑 Creating new wallet (save the secret key!)');
    payer = Keypair.generate();
    console.log('Secret Key:', JSON.stringify(Array.from(payer.secretKey)));
    console.log('⚠️  Save this secret key to ~/.config/solana/id.json for future use\n');
  }

  console.log('👛 Wallet Address:', payer.publicKey.toString());

  // Check balance
  const balance = await connection.getBalance(payer.publicKey);
  console.log('💰 Balance:', balance / LAMPORTS_PER_SOL, 'SOL');

  if (balance < 0.1 * LAMPORTS_PER_SOL) {
    console.log('\n⚠️  Insufficient balance! You need at least 0.1 SOL');
    console.log('🚰 Get devnet SOL from: https://faucet.solana.com');
    console.log('   or run: solana airdrop 1', payer.publicKey.toString());
    process.exit(1);
  }

  // Generate mint account
  const mintKeypair = Keypair.generate();
  const mint = mintKeypair.publicKey;
  const decimals = 9; // Standard for Solana tokens
  const mintAuthority = payer.publicKey;
  const updateAuthority = payer.publicKey;

  // Token metadata
  const metadata: TokenMetadata = {
    mint: mint,
    name: 'IDLE',
    symbol: 'IDLE',
    uri: 'https://ai-arena.com/idle-metadata.json', // You can host metadata later
    additionalMetadata: [
      ['description', 'The official token of AI Arena - Crime Metaverse'],
      ['website', 'https://ai-arena.com'],
      ['twitter', '@AIArenaGame']
    ]
  };

  console.log('\n📝 Token Details:');
  console.log('   Name:', metadata.name);
  console.log('   Symbol:', metadata.symbol);
  console.log('   Decimals:', decimals);
  console.log('   Mint Address:', mint.toString());

  // Calculate space and rent
  const extensions = [ExtensionType.MetadataPointer];
  const metadataLen = pack(metadata).length;
  const mintLen = getMintLen(extensions);
  const lamports = await connection.getMinimumBalanceForRentExemption(mintLen + metadataLen);

  console.log('\n💸 Transaction cost:', lamports / LAMPORTS_PER_SOL, 'SOL');

  // Create transaction
  const transaction = new Transaction();

  // Create mint account
  transaction.add(
    SystemProgram.createAccount({
      fromPubkey: payer.publicKey,
      newAccountPubkey: mint,
      space: mintLen,
      lamports,
      programId: TOKEN_2022_PROGRAM_ID
    })
  );

  // Initialize metadata pointer
  transaction.add(
    createInitializeMetadataPointerInstruction(
      mint,
      updateAuthority,
      mint, // Metadata account is mint itself for Token-2022
      TOKEN_2022_PROGRAM_ID
    )
  );

  // Initialize mint
  transaction.add(
    createInitializeMintInstruction(
      mint,
      decimals,
      mintAuthority,
      null, // No freeze authority
      TOKEN_2022_PROGRAM_ID
    )
  );

  // Initialize metadata
  transaction.add(
    createInitializeInstruction({
      programId: TOKEN_2022_PROGRAM_ID,
      mint: mint,
      metadata: mint,
      name: metadata.name,
      symbol: metadata.symbol,
      uri: metadata.uri,
      mintAuthority: mintAuthority,
      updateAuthority: updateAuthority
    })
  );

  // Add additional metadata fields
  for (const [key, value] of metadata.additionalMetadata) {
    transaction.add(
      createUpdateFieldInstruction({
        programId: TOKEN_2022_PROGRAM_ID,
        metadata: mint,
        updateAuthority: updateAuthority,
        field: key,
        value: value
      })
    );
  }

  console.log('\n📤 Sending transaction...');
  
  try {
    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [payer, mintKeypair],
      { commitment: 'confirmed' }
    );

    console.log('✅ Token created successfully!');
    console.log('   Transaction:', signature);
    console.log('   Explorer:', `https://explorer.solana.com/tx/${signature}?cluster=devnet`);
    
    // Create associated token account for the creator
    console.log('\n📦 Creating token account for wallet...');
    
    const associatedTokenAccount = getAssociatedTokenAddressSync(
      mint,
      payer.publicKey,
      false,
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    const createATATransaction = new Transaction().add(
      createAssociatedTokenAccountInstruction(
        payer.publicKey,
        associatedTokenAccount,
        payer.publicKey,
        mint,
        TOKEN_2022_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      )
    );

    await sendAndConfirmTransaction(
      connection,
      createATATransaction,
      [payer],
      { commitment: 'confirmed' }
    );

    // Mint initial supply (1 billion IDLE for testing)
    console.log('\n🪙 Minting initial supply (1B IDLE)...');
    
    const mintAmount = 1_000_000_000 * Math.pow(10, decimals);
    const mintTransaction = new Transaction().add(
      createMintToInstruction(
        mint,
        associatedTokenAccount,
        mintAuthority,
        mintAmount,
        [],
        TOKEN_2022_PROGRAM_ID
      )
    );

    const mintSignature = await sendAndConfirmTransaction(
      connection,
      mintTransaction,
      [payer],
      { commitment: 'confirmed' }
    );

    console.log('✅ Initial supply minted!');
    console.log('   Amount: 1,000,000,000 IDLE');
    console.log('   Transaction:', mintSignature);

    // Save token info
    const tokenInfo = {
      mint: mint.toString(),
      decimals,
      symbol: metadata.symbol,
      name: metadata.name,
      creator: payer.publicKey.toString(),
      associatedTokenAccount: associatedTokenAccount.toString(),
      createdAt: new Date().toISOString(),
      network: 'devnet'
    };

    const tokenInfoPath = path.join(process.cwd(), 'idle-token-devnet.json');
    fs.writeFileSync(tokenInfoPath, JSON.stringify(tokenInfo, null, 2));

    console.log('\n📄 Token info saved to:', tokenInfoPath);
    console.log('\n🎉 Success! Your $IDLE token is ready on devnet!');
    console.log('\n📋 Next steps:');
    console.log('1. Update VITE_IDLE_TOKEN_MINT in app/.env with:', mint.toString());
    console.log('2. Update IDLE_TOKEN_MINT in backend/.env with:', mint.toString());
    console.log('3. Share the mint address with users for testing');
    console.log('4. View token on Solana Explorer:');
    console.log(`   https://explorer.solana.com/address/${mint}?cluster=devnet`);

  } catch (error) {
    console.error('\n❌ Error creating token:', error);
    process.exit(1);
  }
}

createIdleToken().catch(console.error);