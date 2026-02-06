/**
 * Generate $ARENA token logo using Sharp (no external APIs)
 * Creates a clean, professional token icon with pixel art vibes
 */

import sharp from 'sharp';
import path from 'path';

const OUTPUT = path.join(__dirname, '..', 'public', 'arena-token.png');
const SIZE = 512;

async function main() {
  // Create a pixel-art style token logo using SVG → Sharp
  const svg = `
  <svg width="${SIZE}" height="${SIZE}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:#1a0a2e;stop-opacity:1" />
        <stop offset="100%" style="stop-color:#16213e;stop-opacity:1" />
      </linearGradient>
      <linearGradient id="ring" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:#f59e0b;stop-opacity:1" />
        <stop offset="100%" style="stop-color:#d97706;stop-opacity:1" />
      </linearGradient>
      <linearGradient id="inner" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:#fbbf24;stop-opacity:1" />
        <stop offset="100%" style="stop-color:#f59e0b;stop-opacity:1" />
      </linearGradient>
      <filter id="glow">
        <feGaussianBlur stdDeviation="8" result="coloredBlur"/>
        <feMerge>
          <feMergeNode in="coloredBlur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
    </defs>
    
    <!-- Background circle -->
    <circle cx="256" cy="256" r="256" fill="url(#bg)"/>
    
    <!-- Outer glow ring -->
    <circle cx="256" cy="256" r="220" fill="none" stroke="#f59e0b" stroke-width="6" opacity="0.3" filter="url(#glow)"/>
    
    <!-- Gold ring -->
    <circle cx="256" cy="256" r="200" fill="none" stroke="url(#ring)" stroke-width="12"/>
    
    <!-- Inner circle -->
    <circle cx="256" cy="256" r="170" fill="url(#inner)" opacity="0.15"/>
    
    <!-- Arena symbol - crossed swords -->
    <!-- Sword 1 (left to right diagonal) -->
    <line x1="160" y1="160" x2="352" y2="352" stroke="#fbbf24" stroke-width="14" stroke-linecap="round"/>
    <!-- Sword 1 guard -->
    <line x1="175" y1="200" x2="215" y2="160" stroke="#fbbf24" stroke-width="10" stroke-linecap="round"/>
    
    <!-- Sword 2 (right to left diagonal) -->
    <line x1="352" y1="160" x2="160" y2="352" stroke="#fbbf24" stroke-width="14" stroke-linecap="round"/>
    <!-- Sword 2 guard -->
    <line x1="337" y1="200" x2="297" y2="160" stroke="#fbbf24" stroke-width="10" stroke-linecap="round"/>
    
    <!-- Shield/town center -->
    <circle cx="256" cy="256" r="50" fill="#1a0a2e" stroke="#fbbf24" stroke-width="6"/>
    
    <!-- Building silhouette in center -->
    <rect x="238" y="238" width="36" height="30" fill="#fbbf24" rx="2"/>
    <polygon points="240,238 256,222 272,238" fill="#fbbf24"/>
    <rect x="250" y="252" width="12" height="16" fill="#1a0a2e" rx="1"/>
    
    <!-- Pixel dots decoration -->
    <rect x="180" y="120" width="8" height="8" fill="#fbbf24" opacity="0.6"/>
    <rect x="324" y="120" width="8" height="8" fill="#fbbf24" opacity="0.6"/>
    <rect x="120" y="256" width="8" height="8" fill="#fbbf24" opacity="0.4"/>
    <rect x="384" y="256" width="8" height="8" fill="#fbbf24" opacity="0.4"/>
    <rect x="180" y="392" width="8" height="8" fill="#fbbf24" opacity="0.6"/>
    <rect x="324" y="392" width="8" height="8" fill="#fbbf24" opacity="0.6"/>
    
    <!-- "A" text at top -->
    <text x="256" y="410" text-anchor="middle" font-family="monospace" font-size="28" font-weight="bold" fill="#fbbf24" letter-spacing="8">ARENA</text>
  </svg>`;

  await sharp(Buffer.from(svg))
    .resize(SIZE, SIZE)
    .png()
    .toFile(OUTPUT);

  console.log(`✅ Token image saved to ${OUTPUT} (${SIZE}x${SIZE})`);
}

main().catch(console.error);
