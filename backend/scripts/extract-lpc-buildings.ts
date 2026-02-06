/**
 * Extract complete building sprites from LPC build_atlas.png
 * Coordinates identified from visual inspection
 * 
 * Run: npx tsx scripts/extract-lpc-buildings.ts
 */

import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const ATLAS = '/tmp/build_atlas.png';
const OUTPUT_DIR = path.join(__dirname, '../public/sprite-library');

interface BuildingExtract {
  name: string;
  category: string;
  x: number;
  y: number;
  w: number;
  h: number;
  outputSize?: number;
}

// Coordinates identified from build_atlas.png (1024x1024)
const BUILDINGS: BuildingExtract[] = [
  // Stone tower/gatehouse (top left area)
  { name: 'stone-tower', category: 'civic', x: 0, y: 0, w: 128, h: 160 },
  
  // Gray house with red brick (left side)
  { name: 'brick-house', category: 'residential', x: 0, y: 288, w: 160, h: 192 },
  
  // Half-timbered house (Tudor style)
  { name: 'tudor-house', category: 'residential', x: 160, y: 288, w: 128, h: 192 },
  
  // Japanese torii gate & shrine elements (top right)
  { name: 'torii-gate', category: 'civic', x: 736, y: 0, w: 128, h: 128 },
  { name: 'shrine', category: 'civic', x: 864, y: 0, w: 128, h: 128 },
  
  // Stone castle/church sections (bottom)
  { name: 'castle-tower', category: 'civic', x: 384, y: 704, w: 160, h: 256 },
  { name: 'castle-wall', category: 'civic', x: 544, y: 768, w: 192, h: 192 },
  
  // Large manor/mansion (bottom left)
  { name: 'manor', category: 'residential', x: 0, y: 704, w: 224, h: 256 },
  
  // Tent (market/commercial)
  { name: 'market-tent', category: 'commercial', x: 288, y: 448, w: 128, h: 128 },
  
  // Iron gates
  { name: 'iron-gate', category: 'civic', x: 416, y: 416, w: 96, h: 160 },
  
  // Inn signs
  { name: 'inn-sign', category: 'commercial', x: 608, y: 352, w: 64, h: 64 },
  
  // Wooden structures
  { name: 'hay-wagon', category: 'nature', x: 256, y: 448, w: 64, h: 64 },
  { name: 'wooden-post', category: 'nature', x: 288, y: 384, w: 64, h: 64 },
  
  // Fences
  { name: 'wood-fence', category: 'nature', x: 768, y: 288, w: 128, h: 64 },
  
  // Rooftops (useful for composing)
  { name: 'gray-roof', category: 'residential', x: 0, y: 160, w: 128, h: 96 },
  { name: 'blue-roof', category: 'residential', x: 0, y: 512, w: 128, h: 96 },
];

async function extractBuildings() {
  // Ensure directories
  const categories = ['residential', 'commercial', 'industrial', 'civic', 'entertainment', 'nature'];
  for (const cat of categories) {
    const dir = path.join(OUTPUT_DIR, cat);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }

  if (!fs.existsSync(ATLAS)) {
    console.error(`❌ Atlas not found: ${ATLAS}`);
    console.log('Run: curl -L -o /tmp/build_atlas.png "https://opengameart.org/sites/default/files/build_atlas.png"');
    return;
  }

  console.log('Extracting buildings from LPC build_atlas.png...\n');

  const metadata = await sharp(ATLAS).metadata();
  console.log(`Atlas size: ${metadata.width}x${metadata.height}\n`);

  for (const building of BUILDINGS) {
    try {
      // Validate bounds
      if (building.x + building.w > (metadata.width || 0) || 
          building.y + building.h > (metadata.height || 0)) {
        console.log(`⚠️  Skipping ${building.name} - out of bounds`);
        continue;
      }

      const outputSize = building.outputSize || 64;
      const outputPath = path.join(OUTPUT_DIR, building.category, `lpc-${building.name}-${outputSize}px.png`);

      await sharp(ATLAS)
        .extract({ left: building.x, top: building.y, width: building.w, height: building.h })
        .resize(outputSize, outputSize, {
          kernel: sharp.kernel.nearest,
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .png()
        .toFile(outputPath);

      console.log(`✅ ${building.category}/lpc-${building.name}-${outputSize}px.png`);
    } catch (err: any) {
      console.error(`❌ ${building.name}: ${err.message}`);
    }
  }

  console.log('\n✨ Done!');
}

extractBuildings().catch(console.error);
