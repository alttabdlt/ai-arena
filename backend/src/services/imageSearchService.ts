/**
 * Image Search Service — Agents find their own building sprites/art online.
 * Uses DuckDuckGo image search (no API key needed) with fallback to OpenAI DALL-E generation.
 */

import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const ASSETS_DIR = path.resolve(__dirname, '../../public/building-assets');

// Ensure assets directory exists
if (!fs.existsSync(ASSETS_DIR)) {
  fs.mkdirSync(ASSETS_DIR, { recursive: true });
}

interface ImageResult {
  url: string;        // Original URL
  localPath: string;  // Local saved path
  publicUrl: string;  // URL to serve from our backend
  source: 'search' | 'generated';
}

/**
 * Search for images using multiple strategies
 */
async function searchImages(query: string, count: number = 5): Promise<string[]> {
  // Strategy 1: OpenGameArt / itch.io known pixel art sources
  // Strategy 2: Google Custom Search (if key available)
  // Strategy 3: Pixabay API (free, no key needed for small use)
  
  // Strategy 1: Pixabay (needs valid API key in PIXABAY_API_KEY env var)
  const pixabayKey = process.env.PIXABAY_API_KEY;
  if (pixabayKey) {
    try {
      const pixabayUrl = `https://pixabay.com/api/?key=${pixabayKey}&q=${encodeURIComponent(query)}&image_type=illustration&per_page=${count}&safesearch=true`;
      const json = await fetchText(pixabayUrl);
      const data = JSON.parse(json);
      if (data.hits?.length > 0) {
        return data.hits.map((h: any) => h.webformatURL || h.previewURL).filter(Boolean);
      }
    } catch (err: any) {
      console.log('[ImageSearch] Pixabay failed:', err.message);
    }
  }

  // Strategy 2: Try DuckDuckGo
  try {
    const tokenUrl = `https://duckduckgo.com/?q=${encodeURIComponent(query)}&iax=images&ia=images`;
    const html = await fetchText(tokenUrl);
    const vqdMatch = html.match(/vqd=['"]([^'"]+)['"]/);
    if (vqdMatch) {
      const vqd = vqdMatch[1];
      const searchUrl = `https://duckduckgo.com/i.js?l=us-en&o=json&q=${encodeURIComponent(query)}&vqd=${vqd}&f=size:Medium`;
      const json = await fetchText(searchUrl);
      const data = JSON.parse(json);
      const urls = (data.results || []).slice(0, count).map((r: any) => r.image || r.thumbnail).filter(Boolean);
      if (urls.length > 0) return urls;
    }
  } catch (err: any) {
    console.log('[ImageSearch] DuckDuckGo failed:', err.message);
  }

  return [];
}

/**
 * Generate a pixel art building image using DALL-E
 */
async function generateBuildingImage(buildingType: string, theme: string, description: string): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  try {
    const prompt = `Pixel art top-down RPG building sprite on transparent background: ${buildingType} in a ${theme}. ${description.substring(0, 200)}. 32-bit pixel art style, similar to Stardew Valley or RPG Maker. Clean, detailed, game-ready asset.`;

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
    if (data.data?.[0]?.url) {
      return data.data[0].url;
    }
    console.error('[ImageSearch] DALL-E response:', JSON.stringify(data).substring(0, 200));
    return null;
  } catch (err: any) {
    console.error('[ImageSearch] DALL-E generation failed:', err.message);
    return null;
  }
}

/**
 * Download an image and save locally
 */
async function downloadImage(imageUrl: string, filename: string): Promise<string> {
  const ext = imageUrl.match(/\.(png|jpg|jpeg|gif|webp)/i)?.[1] || 'png';
  const safeName = `${filename}.${ext}`;
  const localPath = path.join(ASSETS_DIR, safeName);
  
  return new Promise((resolve, reject) => {
    const proto = imageUrl.startsWith('https') ? https : http;
    proto.get(imageUrl, { timeout: 15000 }, (res) => {
      // Follow redirects
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        downloadImage(res.headers.location, filename).then(resolve).catch(reject);
        return;
      }
      
      const chunks: Buffer[] = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        if (buffer.length < 1000) {
          reject(new Error('Image too small, likely an error page'));
          return;
        }
        fs.writeFileSync(localPath, buffer);
        resolve(safeName);
      });
      res.on('error', reject);
    }).on('error', reject);
  });
}

/**
 * Main entry: Agent sources a building image.
 * 1. Search online for pixel art matching the building
 * 2. Fall back to DALL-E generation if search fails
 * 3. Download and save locally
 */
export async function sourceBuildingImage(
  buildingType: string,
  buildingName: string,
  theme: string,
  description: string,
): Promise<ImageResult | null> {
  const hash = crypto.createHash('md5').update(`${buildingType}-${buildingName}`).digest('hex').substring(0, 8);
  const filename = `building-${hash}`;

  // Check if we already have this image
  const existing = fs.readdirSync(ASSETS_DIR).find(f => f.startsWith(filename));
  if (existing) {
    return {
      url: '',
      localPath: path.join(ASSETS_DIR, existing),
      publicUrl: `/building-assets/${existing}`,
      source: 'search',
    };
  }

  // Strategy 1: Search for pixel art sprite
  const searchQuery = `pixel art ${buildingType} RPG sprite top-down ${theme}`;
  console.log(`[ImageSearch] Searching: "${searchQuery}"`);
  const results = await searchImages(searchQuery);

  if (results.length > 0) {
    // Try downloading the first few results
    for (const url of results.slice(0, 3)) {
      try {
        const savedName = await downloadImage(url, filename);
        console.log(`[ImageSearch] Downloaded: ${savedName}`);
        return {
          url,
          localPath: path.join(ASSETS_DIR, savedName),
          publicUrl: `/building-assets/${savedName}`,
          source: 'search',
        };
      } catch (err: any) {
        console.log(`[ImageSearch] Download failed for ${url}: ${err.message}`);
      }
    }
  }

  // Strategy 2: Generate with DALL-E
  console.log(`[ImageSearch] Search failed, generating with DALL-E...`);
  const generatedUrl = await generateBuildingImage(buildingType, theme, description);
  if (generatedUrl) {
    try {
      const savedName = await downloadImage(generatedUrl, filename);
      console.log(`[ImageSearch] Generated & saved: ${savedName}`);
      return {
        url: generatedUrl,
        localPath: path.join(ASSETS_DIR, savedName),
        publicUrl: `/building-assets/${savedName}`,
        source: 'generated',
      };
    } catch (err: any) {
      console.error(`[ImageSearch] Failed to save generated image: ${err.message}`);
    }
  }

  console.log(`[ImageSearch] All strategies failed for ${buildingType}`);
  return null;
}

/** Simple HTTP GET that returns text */
function fetchText(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith('https') ? https : http;
    proto.get(url, { 
      timeout: 10000,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AITownBot/1.0)' }
    }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        fetchText(res.headers.location).then(resolve).catch(reject);
        return;
      }
      const chunks: string[] = [];
      res.setEncoding('utf-8');
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve(chunks.join('')));
      res.on('error', reject);
    }).on('error', reject);
  });
}

export const imageSearchService = {
  sourceBuildingImage,
  searchImages,
  generateBuildingImage,
};
