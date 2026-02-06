/**
 * PixelArtService — Converts generated/sourced images into pixel art sprites.
 * 
 * Pipeline:
 * 1. Generate concept art (DALL-E) or source from web
 * 2. Pixelize: downscale + reduce colors + nearest-neighbor
 * 3. Output: crisp pixel art sprite ready for game integration
 */

import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const ASSETS_DIR = path.resolve(__dirname, '../../public/building-sprites');

// Ensure assets directory exists
if (!fs.existsSync(ASSETS_DIR)) {
  fs.mkdirSync(ASSETS_DIR, { recursive: true });
}

interface PixelArtResult {
  originalUrl: string;
  pixelizedPath: string;
  publicUrl: string;
  width: number;
  height: number;
}

/**
 * Convert an image to pixel art style
 * 
 * @param inputUrl - URL of the source image (DALL-E output, web image, etc.)
 * @param targetSize - Target sprite size (default 96px)
 * @param colors - Max colors in palette (default 32 for retro look)
 */
export async function pixelizeImage(
  inputUrl: string,
  targetSize: number = 96,
  colors: number = 32
): Promise<PixelArtResult | null> {
  try {
    const hash = crypto.createHash('md5').update(inputUrl).digest('hex').substring(0, 12);
    const outputFilename = `sprite-${hash}-${targetSize}px.png`;
    const outputPath = path.join(ASSETS_DIR, outputFilename);

    // Check if already processed
    if (fs.existsSync(outputPath)) {
      console.log(`[PixelArt] Cache hit: ${outputFilename}`);
      return {
        originalUrl: inputUrl,
        pixelizedPath: outputPath,
        publicUrl: `/building-sprites/${outputFilename}`,
        width: targetSize,
        height: targetSize,
      };
    }

    console.log(`[PixelArt] Processing: ${inputUrl.substring(0, 80)}...`);

    // Fetch the image
    const response = await fetch(inputUrl);
    if (!response.ok) throw new Error(`Failed to fetch image: ${response.status}`);
    const imageBuffer = Buffer.from(await response.arrayBuffer());

    // Step 1: Resize to small intermediate size (for color reduction)
    // Then resize to target with nearest-neighbor for crisp pixels
    const pixelized = await sharp(imageBuffer)
      // First pass: resize to small intermediate (creates natural pixel grouping)
      .resize(targetSize * 2, targetSize * 2, {
        fit: 'cover',
        position: 'center',
        kernel: 'lanczos3', // Smooth first pass
      })
      // Reduce colors for retro palette look
      .png({ 
        palette: true,
        colors: colors,
        dither: 0.5, // Some dithering for better gradients
      })
      .toBuffer();

    // Step 2: Final resize with nearest-neighbor for crisp pixel edges
    const finalSprite = await sharp(pixelized)
      .resize(targetSize, targetSize, {
        fit: 'cover',
        kernel: 'nearest', // Crisp pixel edges
      })
      .png({
        palette: true,
        colors: colors,
      })
      .toBuffer();

    // Save the result
    fs.writeFileSync(outputPath, finalSprite);
    console.log(`[PixelArt] Created sprite: ${outputFilename}`);

    return {
      originalUrl: inputUrl,
      pixelizedPath: outputPath,
      publicUrl: `/building-sprites/${outputFilename}`,
      width: targetSize,
      height: targetSize,
    };
  } catch (err: any) {
    console.error(`[PixelArt] Pixelization failed: ${err.message}`);
    return null;
  }
}

/**
 * Full pipeline: Generate building art with DALL-E, then pixelize
 */
export async function generatePixelArtBuilding(
  buildingType: string,
  buildingName: string,
  theme: string,
  description: string,
  targetSize: number = 96
): Promise<PixelArtResult | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('[PixelArt] No OpenAI API key');
    return null;
  }

  try {
    // Step 1: Generate with DALL-E (optimized prompt for pixel art conversion)
    const prompt = `Top-down isometric view of a ${buildingType.toLowerCase()} building for a medieval fantasy RPG. ${buildingName ? `Called "${buildingName}".` : ''} Theme: ${theme}. Style: clean shapes, bold colors, simple details, suitable for pixel art conversion. White or transparent background. ${description.substring(0, 150)}`;

    console.log(`[PixelArt] Generating: ${buildingType} - ${buildingName}`);

    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt,
        n: 1,
        size: '1024x1024',
        quality: 'standard',
      }),
    });

    const data = await response.json() as any;
    if (!data.data?.[0]?.url) {
      console.error('[PixelArt] DALL-E response error:', JSON.stringify(data).substring(0, 200));
      return null;
    }

    const dalleUrl = data.data[0].url;
    console.log(`[PixelArt] DALL-E generated, now pixelizing...`);

    // Step 2: Pixelize the generated image
    const result = await pixelizeImage(dalleUrl, targetSize, 32);
    
    if (result) {
      console.log(`[PixelArt] Complete: ${result.publicUrl}`);
    }

    return result;
  } catch (err: any) {
    console.error(`[PixelArt] Pipeline failed: ${err.message}`);
    return null;
  }
}

/**
 * Process an existing image file into pixel art
 */
export async function pixelizeLocalImage(
  inputPath: string,
  targetSize: number = 96,
  colors: number = 32
): Promise<PixelArtResult | null> {
  try {
    if (!fs.existsSync(inputPath)) {
      throw new Error(`File not found: ${inputPath}`);
    }

    const hash = crypto.createHash('md5').update(inputPath).digest('hex').substring(0, 12);
    const outputFilename = `sprite-${hash}-${targetSize}px.png`;
    const outputPath = path.join(ASSETS_DIR, outputFilename);

    if (fs.existsSync(outputPath)) {
      return {
        originalUrl: `file://${inputPath}`,
        pixelizedPath: outputPath,
        publicUrl: `/building-sprites/${outputFilename}`,
        width: targetSize,
        height: targetSize,
      };
    }

    const imageBuffer = fs.readFileSync(inputPath);

    // Same pixelization process
    const pixelized = await sharp(imageBuffer)
      .resize(targetSize * 2, targetSize * 2, {
        fit: 'cover',
        position: 'center',
        kernel: 'lanczos3',
      })
      .png({ palette: true, colors, dither: 0.5 })
      .toBuffer();

    const finalSprite = await sharp(pixelized)
      .resize(targetSize, targetSize, {
        fit: 'cover',
        kernel: 'nearest',
      })
      .png({ palette: true, colors })
      .toBuffer();

    fs.writeFileSync(outputPath, finalSprite);

    return {
      originalUrl: `file://${inputPath}`,
      pixelizedPath: outputPath,
      publicUrl: `/building-sprites/${outputFilename}`,
      width: targetSize,
      height: targetSize,
    };
  } catch (err: any) {
    console.error(`[PixelArt] Local pixelization failed: ${err.message}`);
    return null;
  }
}

export const pixelArtService = {
  pixelizeImage,
  generatePixelArtBuilding,
  pixelizeLocalImage,
};
