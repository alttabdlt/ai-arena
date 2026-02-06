/**
 * Sprite Library Service — A browsable database of pre-made pixel art sprites.
 * 
 * Agents use this as a skill: browse available sprites, pick one that fits their building.
 * 
 * Directory structure:
 *   /public/sprite-library/
 *     /residential/    — houses, cottages, mansions
 *     /commercial/     — shops, taverns, inns, markets
 *     /industrial/     — mines, workshops, forges, factories
 *     /civic/          — town halls, libraries, temples, banks
 *     /entertainment/  — arenas, theaters, casinos
 *     /nature/         — farms, gardens, parks
 *     catalog.json     — metadata for all sprites
 * 
 * Each sprite file follows naming: {name}-{size}px.png
 * Example: cozy-cottage-64px.png, grand-arena-96px.png
 */

import fs from 'fs';
import path from 'path';

// ============================================================================
// TYPES
// ============================================================================

export interface SpriteEntry {
  id: string;           // Unique ID (filename without extension)
  name: string;         // Human-readable name
  category: SpriteCategory;
  tags: string[];       // Searchable tags
  size: number;         // Pixel size (64, 96, etc.)
  filename: string;     // Full filename
  path: string;         // Relative path from sprite-library/
  url: string;          // Public URL
  description?: string; // Optional description for agents
  style?: string;       // Art style (e.g., "medieval", "fantasy", "modern")
  author?: string;      // Credit
  license?: string;     // License info
}

export type SpriteCategory = 
  | 'residential' 
  | 'commercial' 
  | 'industrial' 
  | 'civic' 
  | 'entertainment' 
  | 'nature'
  | 'misc';

export interface BrowseOptions {
  category?: SpriteCategory;
  tags?: string[];
  style?: string;
  minSize?: number;
  maxSize?: number;
  searchText?: string;
}

export interface BrowseResult {
  sprites: SpriteEntry[];
  total: number;
  categories: Record<SpriteCategory, number>;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const LIBRARY_DIR = path.join(__dirname, '../../public/sprite-library');
const CATALOG_FILE = path.join(LIBRARY_DIR, 'catalog.json');
const PUBLIC_URL_BASE = '/sprite-library';

// Building type to category mapping
const TYPE_TO_CATEGORY: Record<string, SpriteCategory> = {
  // Residential
  house: 'residential', home: 'residential', cottage: 'residential', mansion: 'residential',
  cabin: 'residential', villa: 'residential', apartment: 'residential', residence: 'residential',
  
  // Commercial
  shop: 'commercial', store: 'commercial', tavern: 'commercial', inn: 'commercial',
  market: 'commercial', bakery: 'commercial', butcher: 'commercial', blacksmith: 'commercial',
  merchant: 'commercial', trader: 'commercial', pub: 'commercial', bar: 'commercial',
  restaurant: 'commercial', cafe: 'commercial', hotel: 'commercial',
  
  // Industrial
  mine: 'industrial', quarry: 'industrial', workshop: 'industrial', forge: 'industrial',
  factory: 'industrial', mill: 'industrial', foundry: 'industrial', warehouse: 'industrial',
  lumber: 'industrial', sawmill: 'industrial', smelter: 'industrial',
  
  // Civic
  'town hall': 'civic', townhall: 'civic', hall: 'civic', library: 'civic',
  temple: 'civic', church: 'civic', shrine: 'civic', bank: 'civic',
  treasury: 'civic', courthouse: 'civic', council: 'civic', guild: 'civic',
  school: 'civic', academy: 'civic', university: 'civic', hospital: 'civic',
  
  // Entertainment
  arena: 'entertainment', colosseum: 'entertainment', stadium: 'entertainment',
  theater: 'entertainment', theatre: 'entertainment', casino: 'entertainment',
  circus: 'entertainment', amphitheater: 'entertainment',
  
  // Nature
  farm: 'nature', garden: 'nature', park: 'nature', orchard: 'nature',
  vineyard: 'nature', ranch: 'nature', stable: 'nature', nursery: 'nature',
  greenhouse: 'nature', field: 'nature',
};

// ============================================================================
// CATALOG MANAGEMENT
// ============================================================================

let catalog: SpriteEntry[] = [];
let catalogLoaded = false;

/**
 * Load or create the sprite catalog
 */
export function loadCatalog(): SpriteEntry[] {
  if (catalogLoaded) return catalog;
  
  // Ensure directory exists
  if (!fs.existsSync(LIBRARY_DIR)) {
    fs.mkdirSync(LIBRARY_DIR, { recursive: true });
  }
  
  // Try to load existing catalog
  if (fs.existsSync(CATALOG_FILE)) {
    try {
      const data = fs.readFileSync(CATALOG_FILE, 'utf-8');
      catalog = JSON.parse(data);
      catalogLoaded = true;
      console.log(`[SpriteLibrary] Loaded ${catalog.length} sprites from catalog`);
      return catalog;
    } catch (err) {
      console.error('[SpriteLibrary] Failed to load catalog, rebuilding...');
    }
  }
  
  // Build catalog from directory
  catalog = scanLibrary();
  saveCatalog();
  catalogLoaded = true;
  return catalog;
}

/**
 * Scan the sprite library directory and build catalog
 */
export function scanLibrary(): SpriteEntry[] {
  const entries: SpriteEntry[] = [];
  const categories: SpriteCategory[] = ['residential', 'commercial', 'industrial', 'civic', 'entertainment', 'nature'];
  
  for (const category of categories) {
    const categoryDir = path.join(LIBRARY_DIR, category);
    if (!fs.existsSync(categoryDir)) {
      fs.mkdirSync(categoryDir, { recursive: true });
      continue;
    }
    
    const files = fs.readdirSync(categoryDir).filter(f => f.endsWith('.png') || f.endsWith('.gif'));
    
    for (const filename of files) {
      const entry = parseFilename(filename, category);
      if (entry) entries.push(entry);
    }
  }
  
  // Also scan root for misc sprites
  const rootFiles = fs.readdirSync(LIBRARY_DIR).filter(f => 
    (f.endsWith('.png') || f.endsWith('.gif')) && !categories.includes(f.replace(/\.[^.]+$/, '') as any)
  );
  
  for (const filename of rootFiles) {
    const entry = parseFilename(filename, 'misc');
    if (entry) entries.push(entry);
  }
  
  console.log(`[SpriteLibrary] Scanned ${entries.length} sprites from directory`);
  return entries;
}

/**
 * Parse filename into sprite entry
 */
function parseFilename(filename: string, category: SpriteCategory): SpriteEntry | null {
  // Expected format: name-64px.png or name.png
  const match = filename.match(/^(.+?)(?:-(\d+)px)?\.(?:png|gif)$/i);
  if (!match) return null;
  
  const [, rawName, sizeStr] = match;
  const name = rawName.replace(/-/g, ' ').replace(/_/g, ' ');
  const size = sizeStr ? parseInt(sizeStr) : 64; // Default 64px
  
  // Generate tags from name
  const tags = name.toLowerCase().split(' ').filter(t => t.length > 2);
  
  return {
    id: rawName.toLowerCase(),
    name: name.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
    category,
    tags,
    size,
    filename,
    path: category === 'misc' ? filename : `${category}/${filename}`,
    url: category === 'misc' 
      ? `${PUBLIC_URL_BASE}/${filename}`
      : `${PUBLIC_URL_BASE}/${category}/${filename}`,
  };
}

/**
 * Save catalog to disk
 */
export function saveCatalog(): void {
  fs.writeFileSync(CATALOG_FILE, JSON.stringify(catalog, null, 2));
  console.log(`[SpriteLibrary] Saved catalog with ${catalog.length} sprites`);
}

/**
 * Add a sprite to the catalog (and optionally save file)
 */
export function addSprite(
  entry: Omit<SpriteEntry, 'url' | 'path'>,
  fileBuffer?: Buffer
): SpriteEntry {
  loadCatalog();
  
  const fullEntry: SpriteEntry = {
    ...entry,
    path: entry.category === 'misc' ? entry.filename : `${entry.category}/${entry.filename}`,
    url: entry.category === 'misc'
      ? `${PUBLIC_URL_BASE}/${entry.filename}`
      : `${PUBLIC_URL_BASE}/${entry.category}/${entry.filename}`,
  };
  
  // Save file if provided
  if (fileBuffer) {
    const dir = path.join(LIBRARY_DIR, entry.category);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, entry.filename), fileBuffer);
  }
  
  // Add to catalog (replace if exists)
  const existingIndex = catalog.findIndex(s => s.id === entry.id);
  if (existingIndex >= 0) {
    catalog[existingIndex] = fullEntry;
  } else {
    catalog.push(fullEntry);
  }
  
  saveCatalog();
  return fullEntry;
}

/**
 * Remove a sprite from catalog
 */
export function removeSprite(id: string): boolean {
  loadCatalog();
  const index = catalog.findIndex(s => s.id === id);
  if (index < 0) return false;
  
  const entry = catalog[index];
  const filePath = path.join(LIBRARY_DIR, entry.path);
  
  // Remove file if exists
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
  
  catalog.splice(index, 1);
  saveCatalog();
  return true;
}

// ============================================================================
// BROWSE API (Agent Skill)
// ============================================================================

/**
 * Browse the sprite library
 */
export function browseSprites(options: BrowseOptions = {}): BrowseResult {
  loadCatalog();
  
  let results = [...catalog];
  
  // Filter by category
  if (options.category) {
    results = results.filter(s => s.category === options.category);
  }
  
  // Filter by tags
  if (options.tags && options.tags.length > 0) {
    const searchTags = options.tags.map(t => t.toLowerCase());
    results = results.filter(s => 
      searchTags.some(tag => s.tags.includes(tag) || s.name.toLowerCase().includes(tag))
    );
  }
  
  // Filter by style
  if (options.style) {
    results = results.filter(s => s.style === options.style);
  }
  
  // Filter by size
  if (options.minSize) {
    results = results.filter(s => s.size >= options.minSize!);
  }
  if (options.maxSize) {
    results = results.filter(s => s.size <= options.maxSize!);
  }
  
  // Text search
  if (options.searchText) {
    const search = options.searchText.toLowerCase();
    results = results.filter(s => 
      s.name.toLowerCase().includes(search) ||
      s.tags.some(t => t.includes(search)) ||
      s.description?.toLowerCase().includes(search)
    );
  }
  
  // Count by category
  const categories: Record<SpriteCategory, number> = {
    residential: 0, commercial: 0, industrial: 0, 
    civic: 0, entertainment: 0, nature: 0, misc: 0
  };
  for (const s of catalog) {
    categories[s.category]++;
  }
  
  return {
    sprites: results,
    total: results.length,
    categories,
  };
}

/**
 * Find the best sprite for a building type
 */
export function findSpriteForBuilding(
  buildingType: string,
  buildingName?: string,
  preferredStyle?: string
): SpriteEntry | null {
  loadCatalog();
  
  const typeLower = buildingType.toLowerCase();
  const nameLower = buildingName?.toLowerCase() || '';
  
  // Determine category from building type
  let category: SpriteCategory = 'misc';
  for (const [keyword, cat] of Object.entries(TYPE_TO_CATEGORY)) {
    if (typeLower.includes(keyword) || nameLower.includes(keyword)) {
      category = cat;
      break;
    }
  }
  
  // Search in that category first
  let candidates = catalog.filter(s => s.category === category);
  
  // If no matches, search all
  if (candidates.length === 0) {
    candidates = catalog;
  }
  
  // Score candidates by relevance
  const scored = candidates.map(s => {
    let score = 0;
    
    // Tag matches
    for (const tag of s.tags) {
      if (typeLower.includes(tag)) score += 10;
      if (nameLower.includes(tag)) score += 5;
    }
    
    // Name matches
    if (s.name.toLowerCase().includes(typeLower)) score += 15;
    if (typeLower.includes(s.name.toLowerCase())) score += 10;
    
    // Style preference
    if (preferredStyle && s.style === preferredStyle) score += 5;
    
    // Size preference (64-96 is ideal)
    if (s.size >= 64 && s.size <= 96) score += 3;
    
    return { sprite: s, score };
  });
  
  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);
  
  // Return best match, or random if no clear winner
  if (scored.length === 0) return null;
  if (scored[0].score > 0) return scored[0].sprite;
  
  // Random fallback from category
  const categorySprites = catalog.filter(s => s.category === category);
  if (categorySprites.length > 0) {
    return categorySprites[Math.floor(Math.random() * categorySprites.length)];
  }
  
  return scored[0].sprite;
}

/**
 * Get a random sprite from a category
 */
export function getRandomSprite(category?: SpriteCategory): SpriteEntry | null {
  loadCatalog();
  
  const candidates = category 
    ? catalog.filter(s => s.category === category)
    : catalog;
    
  if (candidates.length === 0) return null;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

/**
 * Get sprite by ID
 */
export function getSpriteById(id: string): SpriteEntry | null {
  loadCatalog();
  return catalog.find(s => s.id === id) || null;
}

/**
 * Get catalog stats
 */
export function getCatalogStats(): {
  total: number;
  byCategory: Record<SpriteCategory, number>;
  byStyle: Record<string, number>;
} {
  loadCatalog();
  
  const byCategory: Record<SpriteCategory, number> = {
    residential: 0, commercial: 0, industrial: 0,
    civic: 0, entertainment: 0, nature: 0, misc: 0
  };
  const byStyle: Record<string, number> = {};
  
  for (const s of catalog) {
    byCategory[s.category]++;
    if (s.style) {
      byStyle[s.style] = (byStyle[s.style] || 0) + 1;
    }
  }
  
  return {
    total: catalog.length,
    byCategory,
    byStyle,
  };
}

// ============================================================================
// REFRESH / REBUILD
// ============================================================================

/**
 * Force refresh catalog from disk
 */
export function refreshCatalog(): SpriteEntry[] {
  catalogLoaded = false;
  catalog = [];
  return loadCatalog();
}
