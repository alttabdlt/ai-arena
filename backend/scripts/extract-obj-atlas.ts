/**
 * Extract objects from obj_misk_atlas.png
 * 
 * Run: npx tsx scripts/extract-obj-atlas.ts
 */

import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const ATLAS = '/tmp/obj_misk_atlas.png';
const OUTPUT_DIR = path.join(__dirname, '../public/sprite-library');

interface ObjectExtract {
  name: string;
  category: string;
  x: number;
  y: number;
  w: number;
  h: number;
  outputSize?: number;
}

// From visual inspection of obj_misk_atlas.png (1024x1024)
const OBJECTS: ObjectExtract[] = [
  // Fountain (top left)
  { name: 'fountain', category: 'entertainment', x: 0, y: 64, w: 160, h: 160 },
  
  // Cherry blossom trees
  { name: 'cherry-tree-1', category: 'nature', x: 160, y: 64, w: 96, h: 128 },
  { name: 'cherry-tree-2', category: 'nature', x: 256, y: 64, w: 96, h: 128 },
  
  // Market stall with awning
  { name: 'market-stall', category: 'commercial', x: 64, y: 416, w: 128, h: 96 },
  
  // Wooden crates/shelves (shop-like)
  { name: 'shop-shelf', category: 'commercial', x: 160, y: 320, w: 128, h: 96 },
  
  // Vending machines (modern touch)
  { name: 'vending-machine', category: 'commercial', x: 544, y: 384, w: 64, h: 96 },
  
  // Boats
  { name: 'boat-large', category: 'nature', x: 192, y: 576, w: 192, h: 96 },
  { name: 'boat-small', category: 'nature', x: 192, y: 672, w: 96, h: 64 },
  
  // Gravestones  
  { name: 'gravestone', category: 'civic', x: 608, y: 640, w: 64, h: 64 },
  
  // Woodpile
  { name: 'woodpile', category: 'industrial', x: 0, y: 256, w: 64, h: 64 },
  
  // Log stumps
  { name: 'log-stump', category: 'nature', x: 64, y: 320, w: 32, h: 32 },
  
  // Vegetable crates
  { name: 'veggie-crates', category: 'nature', x: 192, y: 512, w: 160, h: 64 },
  
  // Building roofs (right side)
  { name: 'pavilion-roof', category: 'entertainment', x: 768, y: 192, w: 192, h: 128 },
  { name: 'bridge-structure', category: 'civic', x: 768, y: 448, w: 192, h: 128 },
];

async function extractObjects() {
  const categories = ['residential', 'commercial', 'industrial', 'civic', 'entertainment', 'nature'];
  for (const cat of categories) {
    const dir = path.join(OUTPUT_DIR, cat);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }

  if (!fs.existsSync(ATLAS)) {
    console.error(`❌ Atlas not found: ${ATLAS}`);
    return;
  }

  console.log('Extracting objects from obj_misk_atlas.png...\n');

  for (const obj of OBJECTS) {
    try {
      const outputSize = obj.outputSize || 64;
      const outputPath = path.join(OUTPUT_DIR, obj.category, `lpc-${obj.name}-${outputSize}px.png`);

      await sharp(ATLAS)
        .extract({ left: obj.x, top: obj.y, width: obj.w, height: obj.h })
        .resize(outputSize, outputSize, {
          kernel: sharp.kernel.nearest,
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .png()
        .toFile(outputPath);

      console.log(`✅ ${obj.category}/lpc-${obj.name}-${outputSize}px.png`);
    } catch (err: any) {
      console.error(`❌ ${obj.name}: ${err.message}`);
    }
  }

  console.log('\n✨ Done!');
}

extractObjects().catch(console.error);
