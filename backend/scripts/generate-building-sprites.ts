/**
 * Generate clean pixel art building sprites programmatically
 * Each building is a 64x64 or 96x96 PNG with transparency
 * 
 * Run: npx tsx scripts/generate-building-sprites.ts
 */

import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const OUTPUT_DIR = path.join(__dirname, '../public/sprite-library');

// Color palette (RPG style)
const COLORS = {
  // Roofs
  roofRed: '#8B2323',
  roofBrown: '#5D4037',
  roofBlue: '#2E4A62',
  roofGreen: '#2E5D2E',
  roofPurple: '#4A2D5D',
  
  // Walls
  wallBeige: '#D4B896',
  wallGray: '#9E9E9E',
  wallBrown: '#8B7355',
  wallWhite: '#E8E0D5',
  wallStone: '#6B6B6B',
  
  // Accents
  woodDark: '#4A3728',
  woodLight: '#8B7355',
  doorDark: '#3D2817',
  windowBlue: '#6BA3D6',
  windowYellow: '#FFD54F',
  gold: '#FFD700',
  
  // Transparent
  transparent: '#00000000',
};

interface BuildingDef {
  name: string;
  category: string;
  size: number;
  svg: string;
}

// Generate SVG for each building type
function houseSVG(roof: string, wall: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
    <!-- Shadow -->
    <ellipse cx="32" cy="60" rx="26" ry="6" fill="#00000022"/>
    <!-- Wall -->
    <rect x="12" y="30" width="40" height="28" fill="${wall}"/>
    <rect x="12" y="30" width="40" height="4" fill="#00000022"/>
    <!-- Roof -->
    <polygon points="32,8 6,34 58,34" fill="${roof}"/>
    <polygon points="32,8 6,34 32,34" fill="#00000022"/>
    <!-- Door -->
    <rect x="26" y="42" width="12" height="16" fill="${COLORS.doorDark}"/>
    <circle cx="35" cy="50" r="1.5" fill="${COLORS.gold}"/>
    <!-- Windows -->
    <rect x="16" y="36" width="8" height="8" fill="${COLORS.windowBlue}"/>
    <rect x="40" y="36" width="8" height="8" fill="${COLORS.windowBlue}"/>
    <line x1="20" y1="36" x2="20" y2="44" stroke="${COLORS.woodDark}" stroke-width="1"/>
    <line x1="16" y1="40" x2="24" y2="40" stroke="${COLORS.woodDark}" stroke-width="1"/>
    <line x1="44" y1="36" x2="44" y2="44" stroke="${COLORS.woodDark}" stroke-width="1"/>
    <line x1="40" y1="40" x2="48" y2="40" stroke="${COLORS.woodDark}" stroke-width="1"/>
  </svg>`;
}

function tavernSVG(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
    <ellipse cx="32" cy="60" rx="28" ry="6" fill="#00000022"/>
    <!-- Main building -->
    <rect x="8" y="24" width="48" height="34" fill="${COLORS.wallBrown}"/>
    <rect x="8" y="24" width="48" height="4" fill="#00000022"/>
    <!-- Roof -->
    <polygon points="32,4 2,28 62,28" fill="${COLORS.roofBrown}"/>
    <polygon points="32,4 2,28 32,28" fill="#00000022"/>
    <!-- Sign -->
    <rect x="38" y="14" width="4" height="20" fill="${COLORS.woodDark}"/>
    <rect x="32" y="26" width="16" height="10" fill="${COLORS.woodLight}" rx="2"/>
    <text x="40" y="34" font-size="6" fill="${COLORS.doorDark}" text-anchor="middle">🍺</text>
    <!-- Door (double) -->
    <rect x="22" y="40" width="20" height="18" fill="${COLORS.doorDark}"/>
    <line x1="32" y1="40" x2="32" y2="58" stroke="${COLORS.woodLight}" stroke-width="1"/>
    <circle cx="28" cy="50" r="1" fill="${COLORS.gold}"/>
    <circle cx="36" cy="50" r="1" fill="${COLORS.gold}"/>
    <!-- Windows -->
    <rect x="12" y="32" width="8" height="8" fill="${COLORS.windowYellow}"/>
    <rect x="44" y="32" width="8" height="8" fill="${COLORS.windowYellow}"/>
  </svg>`;
}

function shopSVG(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
    <ellipse cx="32" cy="60" rx="26" ry="6" fill="#00000022"/>
    <!-- Building -->
    <rect x="10" y="20" width="44" height="38" fill="${COLORS.wallWhite}"/>
    <!-- Awning -->
    <polygon points="6,28 58,28 54,20 10,20" fill="#C62828"/>
    <polygon points="6,28 58,28 54,32 10,32" fill="#B71C1C"/>
    <!-- Display window -->
    <rect x="14" y="34" width="16" height="16" fill="${COLORS.windowBlue}"/>
    <rect x="14" y="34" width="16" height="16" stroke="${COLORS.woodDark}" stroke-width="2" fill="none"/>
    <!-- Door -->
    <rect x="36" y="38" width="14" height="20" fill="${COLORS.doorDark}"/>
    <rect x="38" y="40" width="10" height="10" fill="${COLORS.windowBlue}"/>
    <circle cx="40" cy="52" r="1.5" fill="${COLORS.gold}"/>
    <!-- Sign -->
    <rect x="22" y="12" width="20" height="8" fill="${COLORS.woodLight}" rx="1"/>
    <text x="32" y="18" font-size="5" fill="${COLORS.doorDark}" text-anchor="middle">SHOP</text>
  </svg>`;
}

function arenaSVG(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
    <ellipse cx="32" cy="60" rx="28" ry="8" fill="#00000022"/>
    <!-- Base ellipse (arena floor) -->
    <ellipse cx="32" cy="44" rx="26" ry="14" fill="#C9B896"/>
    <!-- Inner ring (fighting area) -->
    <ellipse cx="32" cy="42" rx="18" ry="10" fill="#E8D9B8"/>
    <!-- Walls/stands -->
    <ellipse cx="32" cy="36" rx="26" ry="14" fill="none" stroke="${COLORS.wallStone}" stroke-width="8"/>
    <!-- Entrance arches -->
    <rect x="28" y="48" width="8" height="10" fill="${COLORS.doorDark}"/>
    <ellipse cx="32" cy="48" rx="4" ry="3" fill="${COLORS.doorDark}"/>
    <!-- Pillars -->
    <rect x="6" y="28" width="6" height="20" fill="${COLORS.wallGray}"/>
    <rect x="52" y="28" width="6" height="20" fill="${COLORS.wallGray}"/>
    <!-- Flags -->
    <rect x="7" y="16" width="2" height="14" fill="${COLORS.woodDark}"/>
    <polygon points="9,16 9,24 18,20" fill="#C62828"/>
    <rect x="55" y="16" width="2" height="14" fill="${COLORS.woodDark}"/>
    <polygon points="55,16 55,24 46,20" fill="#1565C0"/>
  </svg>`;
}

function mineSVG(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
    <ellipse cx="32" cy="58" rx="24" ry="6" fill="#00000022"/>
    <!-- Mountain/rock -->
    <polygon points="32,8 4,58 60,58" fill="#5D5D5D"/>
    <polygon points="32,8 4,58 32,58" fill="#4A4A4A"/>
    <!-- Mine entrance -->
    <ellipse cx="32" cy="48" rx="12" ry="10" fill="#1A1A1A"/>
    <!-- Wooden frame -->
    <rect x="20" y="38" width="4" height="20" fill="${COLORS.woodDark}"/>
    <rect x="40" y="38" width="4" height="20" fill="${COLORS.woodDark}"/>
    <rect x="18" y="36" width="28" height="4" fill="${COLORS.woodLight}"/>
    <!-- Rails -->
    <line x1="26" y1="58" x2="32" y2="48" stroke="#5D5D5D" stroke-width="2"/>
    <line x1="38" y1="58" x2="32" y2="48" stroke="#5D5D5D" stroke-width="2"/>
    <!-- Lantern -->
    <rect x="30" y="30" width="4" height="6" fill="${COLORS.windowYellow}"/>
    <rect x="29" y="28" width="6" height="3" fill="${COLORS.woodDark}"/>
  </svg>`;
}

function townHallSVG(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
    <ellipse cx="32" cy="60" rx="28" ry="6" fill="#00000022"/>
    <!-- Main building -->
    <rect x="8" y="26" width="48" height="32" fill="${COLORS.wallWhite}"/>
    <!-- Columns -->
    <rect x="12" y="30" width="4" height="24" fill="${COLORS.wallGray}"/>
    <rect x="24" y="30" width="4" height="24" fill="${COLORS.wallGray}"/>
    <rect x="36" y="30" width="4" height="24" fill="${COLORS.wallGray}"/>
    <rect x="48" y="30" width="4" height="24" fill="${COLORS.wallGray}"/>
    <!-- Pediment (triangle top) -->
    <polygon points="32,8 4,30 60,30" fill="${COLORS.wallGray}"/>
    <polygon points="32,8 4,30 32,30" fill="#8A8A8A"/>
    <!-- Roof line -->
    <rect x="4" y="26" width="56" height="4" fill="${COLORS.wallStone}"/>
    <!-- Door -->
    <rect x="26" y="42" width="12" height="16" fill="${COLORS.doorDark}"/>
    <ellipse cx="32" cy="42" rx="6" ry="4" fill="${COLORS.doorDark}"/>
    <!-- Clock/emblem -->
    <circle cx="32" cy="18" r="6" fill="${COLORS.gold}"/>
    <circle cx="32" cy="18" r="4" fill="${COLORS.wallWhite}"/>
  </svg>`;
}

function librarySVG(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
    <ellipse cx="32" cy="60" rx="26" ry="6" fill="#00000022"/>
    <!-- Building -->
    <rect x="10" y="22" width="44" height="36" fill="${COLORS.wallBeige}"/>
    <!-- Tower -->
    <rect x="24" y="6" width="16" height="20" fill="${COLORS.wallBeige}"/>
    <polygon points="32,0 22,10 42,10" fill="${COLORS.roofBlue}"/>
    <!-- Roof -->
    <polygon points="32,14 6,26 58,26" fill="${COLORS.roofBlue}"/>
    <!-- Large window (arched) -->
    <rect x="22" y="32" width="20" height="16" fill="${COLORS.windowBlue}"/>
    <ellipse cx="32" cy="32" rx="10" ry="6" fill="${COLORS.windowBlue}"/>
    <line x1="32" y1="26" x2="32" y2="48" stroke="${COLORS.woodDark}" stroke-width="2"/>
    <line x1="22" y1="40" x2="42" y2="40" stroke="${COLORS.woodDark}" stroke-width="2"/>
    <!-- Door -->
    <rect x="12" y="46" width="8" height="12" fill="${COLORS.doorDark}"/>
    <!-- Side windows -->
    <rect x="44" y="34" width="6" height="8" fill="${COLORS.windowBlue}"/>
  </svg>`;
}

function farmSVG(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
    <ellipse cx="32" cy="60" rx="28" ry="6" fill="#00000022"/>
    <!-- Barn -->
    <rect x="4" y="28" width="32" height="30" fill="#8B4513"/>
    <!-- Barn roof -->
    <polygon points="20,10 0,32 40,32" fill="#5D4037"/>
    <!-- Barn door -->
    <rect x="12" y="38" width="16" height="20" fill="${COLORS.doorDark}"/>
    <line x1="20" y1="38" x2="20" y2="58" stroke="${COLORS.woodLight}" stroke-width="1"/>
    <!-- Hay loft window -->
    <polygon points="20,18 14,26 26,26" fill="${COLORS.doorDark}"/>
    <!-- Silo -->
    <rect x="44" y="24" width="16" height="34" fill="${COLORS.wallGray}"/>
    <ellipse cx="52" cy="24" rx="8" ry="4" fill="#7A7A7A"/>
    <ellipse cx="52" cy="20" rx="6" ry="3" fill="${COLORS.roofRed}"/>
    <!-- Fence -->
    <rect x="0" y="54" width="64" height="2" fill="${COLORS.woodLight}"/>
  </svg>`;
}

function templeSVG(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
    <ellipse cx="32" cy="60" rx="26" ry="6" fill="#00000022"/>
    <!-- Base platform -->
    <rect x="8" y="50" width="48" height="8" fill="${COLORS.wallGray}"/>
    <!-- Main building -->
    <rect x="14" y="28" width="36" height="24" fill="${COLORS.wallWhite}"/>
    <!-- Spire/tower -->
    <rect x="26" y="8" width="12" height="24" fill="${COLORS.wallWhite}"/>
    <polygon points="32,0 24,12 40,12" fill="${COLORS.gold}"/>
    <!-- Cross/symbol on top -->
    <rect x="30" y="2" width="4" height="8" fill="${COLORS.gold}"/>
    <rect x="28" y="4" width="8" height="4" fill="${COLORS.gold}"/>
    <!-- Arched doorway -->
    <rect x="26" y="38" width="12" height="14" fill="${COLORS.doorDark}"/>
    <ellipse cx="32" cy="38" rx="6" ry="5" fill="${COLORS.doorDark}"/>
    <!-- Side windows (stained glass) -->
    <ellipse cx="18" cy="36" rx="3" ry="5" fill="#C62828"/>
    <ellipse cx="46" cy="36" rx="3" ry="5" fill="#1565C0"/>
    <!-- Main window -->
    <circle cx="32" cy="20" r="4" fill="${COLORS.windowYellow}"/>
  </svg>`;
}

function workshopSVG(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
    <ellipse cx="32" cy="60" rx="26" ry="6" fill="#00000022"/>
    <!-- Building -->
    <rect x="8" y="24" width="40" height="34" fill="${COLORS.wallBrown}"/>
    <!-- Chimney -->
    <rect x="52" y="12" width="8" height="36" fill="#4A4A4A"/>
    <ellipse cx="56" cy="12" rx="4" ry="2" fill="#3A3A3A"/>
    <!-- Smoke -->
    <circle cx="56" cy="6" r="3" fill="#88888844"/>
    <circle cx="58" cy="2" r="2" fill="#88888833"/>
    <!-- Roof -->
    <polygon points="28,10 4,28 52,28" fill="${COLORS.roofBrown}"/>
    <!-- Large door (workshop entrance) -->
    <rect x="16" y="36" width="24" height="22" fill="${COLORS.doorDark}"/>
    <rect x="16" y="36" width="24" height="3" fill="${COLORS.woodLight}"/>
    <!-- Anvil silhouette in door -->
    <polygon points="28,52 24,56 32,56" fill="#3A3A3A"/>
    <!-- Window -->
    <rect x="12" y="28" width="8" height="6" fill="${COLORS.windowYellow}"/>
  </svg>`;
}

function parkSVG(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
    <ellipse cx="32" cy="60" rx="28" ry="8" fill="#00000022"/>
    <!-- Grass base -->
    <ellipse cx="32" cy="52" rx="28" ry="10" fill="#4CAF50"/>
    <ellipse cx="32" cy="50" rx="24" ry="8" fill="#66BB6A"/>
    <!-- Path -->
    <ellipse cx="32" cy="52" rx="8" ry="4" fill="#D7CCC8"/>
    <!-- Fountain -->
    <ellipse cx="32" cy="44" rx="10" ry="5" fill="#64B5F6"/>
    <ellipse cx="32" cy="42" rx="6" ry="3" fill="#42A5F5"/>
    <rect x="30" y="32" width="4" height="12" fill="#9E9E9E"/>
    <!-- Water spray -->
    <ellipse cx="32" cy="30" rx="4" ry="2" fill="#90CAF9"/>
    <!-- Trees -->
    <circle cx="12" cy="36" r="8" fill="#2E7D32"/>
    <rect x="10" y="42" width="4" height="10" fill="#5D4037"/>
    <circle cx="52" cy="36" r="8" fill="#2E7D32"/>
    <rect x="50" y="42" width="4" height="10" fill="#5D4037"/>
    <!-- Flowers -->
    <circle cx="20" cy="50" r="2" fill="#E91E63"/>
    <circle cx="44" cy="50" r="2" fill="#FFC107"/>
    <circle cx="24" cy="54" r="2" fill="#9C27B0"/>
  </svg>`;
}

function casinoSVG(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
    <ellipse cx="32" cy="60" rx="26" ry="6" fill="#00000022"/>
    <!-- Building -->
    <rect x="8" y="20" width="48" height="38" fill="#1A1A2E"/>
    <!-- Neon trim -->
    <rect x="8" y="20" width="48" height="3" fill="${COLORS.gold}"/>
    <rect x="8" y="55" width="48" height="3" fill="${COLORS.gold}"/>
    <!-- Sign area -->
    <rect x="16" y="8" width="32" height="14" fill="#2D2D44"/>
    <rect x="16" y="8" width="32" height="2" fill="#C62828"/>
    <text x="32" y="18" font-size="6" fill="${COLORS.gold}" text-anchor="middle">♠♥♦♣</text>
    <!-- Entrance -->
    <rect x="24" y="40" width="16" height="18" fill="#C62828"/>
    <rect x="26" y="42" width="12" height="14" fill="#1A1A2E"/>
    <!-- Windows (lit) -->
    <rect x="12" y="28" width="8" height="8" fill="${COLORS.windowYellow}"/>
    <rect x="44" y="28" width="8" height="8" fill="#E91E63"/>
    <rect x="12" y="40" width="8" height="8" fill="#9C27B0"/>
    <rect x="44" y="40" width="8" height="8" fill="${COLORS.windowYellow}"/>
  </svg>`;
}

const BUILDINGS: BuildingDef[] = [
  { name: 'cottage', category: 'residential', size: 64, svg: houseSVG(COLORS.roofBrown, COLORS.wallBeige) },
  { name: 'house-red', category: 'residential', size: 64, svg: houseSVG(COLORS.roofRed, COLORS.wallWhite) },
  { name: 'house-blue', category: 'residential', size: 64, svg: houseSVG(COLORS.roofBlue, COLORS.wallBeige) },
  { name: 'house-green', category: 'residential', size: 64, svg: houseSVG(COLORS.roofGreen, COLORS.wallWhite) },
  { name: 'tavern', category: 'commercial', size: 64, svg: tavernSVG() },
  { name: 'shop', category: 'commercial', size: 64, svg: shopSVG() },
  { name: 'arena', category: 'entertainment', size: 64, svg: arenaSVG() },
  { name: 'casino', category: 'entertainment', size: 64, svg: casinoSVG() },
  { name: 'mine', category: 'industrial', size: 64, svg: mineSVG() },
  { name: 'workshop', category: 'industrial', size: 64, svg: workshopSVG() },
  { name: 'town-hall', category: 'civic', size: 64, svg: townHallSVG() },
  { name: 'library', category: 'civic', size: 64, svg: librarySVG() },
  { name: 'temple', category: 'civic', size: 64, svg: templeSVG() },
  { name: 'farm', category: 'nature', size: 64, svg: farmSVG() },
  { name: 'park', category: 'nature', size: 64, svg: parkSVG() },
];

async function generateSprites() {
  // Ensure directories
  const categories = ['residential', 'commercial', 'industrial', 'civic', 'entertainment', 'nature'];
  for (const cat of categories) {
    const dir = path.join(OUTPUT_DIR, cat);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }

  // Clear old extracted sprites (keep generated ones)
  console.log('Generating building sprites...\n');

  for (const building of BUILDINGS) {
    const outputPath = path.join(OUTPUT_DIR, building.category, `${building.name}-${building.size}px.png`);
    
    try {
      await sharp(Buffer.from(building.svg))
        .resize(building.size, building.size)
        .png()
        .toFile(outputPath);
      
      console.log(`✅ ${building.category}/${building.name}-${building.size}px.png`);
    } catch (err: any) {
      console.error(`❌ ${building.name}: ${err.message}`);
    }
  }

  console.log(`\n✨ Generated ${BUILDINGS.length} sprites!`);
  console.log('Visit http://localhost:4000/api/v1/sprites/gallery to preview.');
}

generateSprites().catch(console.error);
