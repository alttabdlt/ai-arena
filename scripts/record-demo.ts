/**
 * AI Arena Demo Video Recorder
 *
 * Records a full walkthrough of the platform using Playwright with video capture.
 * Showcases: 3D town, agents, Wheel of Fate match, wallet-only auth, nad.fun token.
 */
import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

const BASE_URL = 'http://localhost:8080';
const API_URL = 'http://localhost:4000/api/v1';
const VIDEO_DIR = path.join(__dirname, '..', 'demo-videos');
const VIEWPORT = { width: 1920, height: 1080 };

// Helpers
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function waitForWheel(phase: string, timeoutMs = 120_000): Promise<any> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${API_URL}/wheel/status`);
      const data = await res.json() as any;
      if (data.phase === phase) return data;
    } catch {}
    await sleep(2000);
  }
  return null;
}

async function injectDemoOverlay(page: any, text: string) {
  await page.evaluate((t: string) => {
    let el = document.getElementById('demo-overlay');
    if (!el) {
      el = document.createElement('div');
      el.id = 'demo-overlay';
      Object.assign(el.style, {
        position: 'fixed', bottom: '40px', left: '50%', transform: 'translateX(-50%)',
        zIndex: '99999', padding: '14px 32px', borderRadius: '12px',
        background: 'linear-gradient(135deg, rgba(15,15,30,0.92), rgba(30,20,50,0.92))',
        border: '1px solid rgba(245,158,11,0.4)', backdropFilter: 'blur(12px)',
        color: '#fbbf24', fontFamily: 'system-ui, sans-serif', fontSize: '22px',
        fontWeight: '700', letterSpacing: '0.5px', textShadow: '0 2px 8px rgba(0,0,0,0.5)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        transition: 'opacity 0.6s ease, transform 0.6s ease',
      });
      document.body.appendChild(el);
    }
    el.textContent = t;
    el.style.opacity = '1';
    el.style.transform = 'translateX(-50%) translateY(0)';
  }, text);
}

async function hideDemoOverlay(page: any) {
  await page.evaluate(() => {
    const el = document.getElementById('demo-overlay');
    if (el) {
      el.style.opacity = '0';
      el.style.transform = 'translateX(-50%) translateY(10px)';
    }
  });
}

async function main() {
  fs.mkdirSync(VIDEO_DIR, { recursive: true });

  console.log('🎬 Launching browser with video recording...');
  const browser = await chromium.launch({
    headless: false,
    args: [
      '--use-gl=angle',
      '--enable-webgl',
      '--ignore-gpu-blocklist',
      '--enable-gpu-rasterization',
      '--no-sandbox',
    ],
  });

  const context = await browser.newContext({
    viewport: VIEWPORT,
    recordVideo: {
      dir: VIDEO_DIR,
      size: VIEWPORT,
    },
    colorScheme: 'dark',
    deviceScaleFactor: 1,
  });

  const page = await context.newPage();

  // ─── ACT 1: Landing / Onboarding (wallet-only auth) ───
  console.log('📹 Scene 1: Landing page (wallet-only auth)');
  await page.goto(BASE_URL + '/town', { waitUntil: 'domcontentloaded' });
  await sleep(2000);
  await injectDemoOverlay(page, 'AI ARENA — Connect Wallet to Play');
  await sleep(5000);
  await hideDemoOverlay(page);
  await sleep(1000);

  // ─── ACT 2: Skip onboarding to enter town ───
  console.log('📹 Scene 2: Entering the town...');
  // Set localStorage to skip onboarding and enter 3D view
  await page.evaluate(() => {
    localStorage.setItem('ai-town-onboarded', '1');
    localStorage.setItem('ai-town-my-wallet', '0xDEMO');
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await sleep(4000); // Wait for Three.js to render
  await injectDemoOverlay(page, '3D Town — Autonomous AI Agents');
  await sleep(6000);
  await hideDemoOverlay(page);

  // ─── ACT 3: Watch agents in 3D ───
  console.log('📹 Scene 3: Watching agents...');
  await sleep(3000);
  await injectDemoOverlay(page, 'Agents Walk, Build, Trade & Fight');
  await sleep(6000);
  await hideDemoOverlay(page);
  await sleep(2000);

  // ─── ACT 4: Wait for Wheel of Fate ANNOUNCING ───
  console.log('📹 Scene 4: Waiting for Wheel of Fate...');
  await injectDemoOverlay(page, 'Wheel of Fate — PvP Every 90 Seconds');

  // Poll wheel status
  let wheelData = await waitForWheel('ANNOUNCING', 100_000);
  if (!wheelData) {
    console.log('  Wheel not announcing yet, checking current phase...');
    const res = await fetch(`${API_URL}/wheel/status`);
    wheelData = await res.json();
    console.log('  Current phase:', (wheelData as any)?.phase);
  }
  await sleep(2000);
  await hideDemoOverlay(page);

  // ─── ACT 5: ANNOUNCING phase - betting window ───
  const wheelPhase = wheelData?.phase;
  if (wheelPhase === 'ANNOUNCING' || wheelPhase === 'FIGHTING') {
    console.log('📹 Scene 5: Wheel ANNOUNCING — betting window');
    await injectDemoOverlay(page, 'Betting Window Open — Pick Your Fighter');
    await sleep(8000);
    await hideDemoOverlay(page);
    await sleep(2000);
  }

  // ─── ACT 6: FIGHTING phase ───
  console.log('📹 Scene 6: Waiting for FIGHTING phase...');
  wheelData = await waitForWheel('FIGHTING', 60_000);
  if (wheelData) {
    console.log('  FIGHTING! Match in progress...');
    await injectDemoOverlay(page, 'LIVE POKER — AI vs AI');
    await sleep(6000);
    await hideDemoOverlay(page);

    // Watch the match play out
    await sleep(15000);
    await injectDemoOverlay(page, 'Real-Time Poker Moves & AI Reasoning');
    await sleep(6000);
    await hideDemoOverlay(page);
    await sleep(10000);
  }

  // ─── ACT 7: AFTERMATH ───
  console.log('📹 Scene 7: Waiting for AFTERMATH...');
  wheelData = await waitForWheel('AFTERMATH', 60_000);
  if (wheelData) {
    console.log('  AFTERMATH — showing results');
    await injectDemoOverlay(page, 'Winner Takes the Pot');
    await sleep(8000);
    await hideDemoOverlay(page);
    await sleep(4000);
  }

  // ─── ACT 8: Show the HUD / agent stats ───
  console.log('📹 Scene 8: HUD and agent stats');
  await injectDemoOverlay(page, '$ARENA Economy — Trade on nad.fun');
  await sleep(6000);
  await hideDemoOverlay(page);
  await sleep(2000);

  // ─── ACT 9: Closing shot ───
  console.log('📹 Scene 9: Closing');
  await injectDemoOverlay(page, 'AI ARENA — Live on Monad');
  await sleep(5000);
  await hideDemoOverlay(page);
  await sleep(2000);

  // ─── Save video ───
  console.log('💾 Saving video...');
  await page.close();
  await context.close();
  await browser.close();

  // Find the recorded video
  const files = fs.readdirSync(VIDEO_DIR).filter(f => f.endsWith('.webm'));
  if (files.length > 0) {
    const latest = files.sort().pop()!;
    const videoPath = path.join(VIDEO_DIR, latest);
    const finalPath = path.join(VIDEO_DIR, 'ai-arena-demo.webm');
    if (videoPath !== finalPath) {
      fs.renameSync(videoPath, finalPath);
    }
    console.log(`\n🎬 Demo video saved: ${finalPath}`);
    const stats = fs.statSync(finalPath);
    console.log(`   Size: ${(stats.size / 1024 / 1024).toFixed(1)} MB`);
  } else {
    console.log('⚠️  No video files found in', VIDEO_DIR);
  }
}

main().catch(err => {
  console.error('❌ Recording failed:', err.message);
  process.exit(1);
});
