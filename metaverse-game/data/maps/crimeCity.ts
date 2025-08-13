// Crime City Map Generator
export type TileType = 'floor' | 'wall' | 'road' | 'building' | 'portal' | 'special';

export interface MapTile {
  type: TileType;
  variant?: number;
  walkable: boolean;
  zonePortal?: {
    toZone: string;
    toPosition: { x: number; y: number };
  };
}

// Base tile indices for the crime city tileset
const TILE_INDICES = {
  // Floors
  concrete: 0,
  asphalt: 1,
  tiles: 2,
  carpet: 3,
  grass: 4,
  dirt: 5,
  
  // Walls
  brick: 16,
  concrete_wall: 17,
  metal: 18,
  wood: 19,
  fence: 20,
  
  // Roads
  road_straight: 32,
  road_corner: 33,
  road_intersection: 34,
  sidewalk: 35,
  
  // Buildings
  casino_wall: 48,
  casino_door: 49,
  shop_wall: 50,
  shop_door: 51,
  house_wall: 52,
  house_door: 53,
  
  // Special
  slot_machine: 64,
  poker_table: 65,
  bar: 66,
  dumpster: 67,
  car: 68,
  tree: 69,
  streetlight: 70,
  portal: 71,
};

// Generate a casino zone map
export function generateCasinoMap(width: number = 30, height: number = 30): number[][] {
  const map: number[][] = Array(width).fill(0).map(() => Array(height).fill(TILE_INDICES.carpet));
  
  // Add walls around the perimeter
  for (let x = 0; x < width; x++) {
    map[x][0] = TILE_INDICES.casino_wall;
    map[x][height - 1] = TILE_INDICES.casino_wall;
  }
  for (let y = 0; y < height; y++) {
    map[0][y] = TILE_INDICES.casino_wall;
    map[width - 1][y] = TILE_INDICES.casino_wall;
  }
  
  // Add entrance
  map[Math.floor(width / 2)][height - 1] = TILE_INDICES.casino_door;
  map[Math.floor(width / 2) - 1][height - 1] = TILE_INDICES.casino_door;
  
  // Add gaming areas
  const addGamingArea = (startX: number, startY: number, w: number, h: number) => {
    for (let x = startX; x < startX + w && x < width - 1; x++) {
      for (let y = startY; y < startY + h && y < height - 1; y++) {
        if (x % 3 === 0 && y % 3 === 0) {
          map[x][y] = TILE_INDICES.slot_machine;
        }
      }
    }
  };
  
  // Slot machine areas
  addGamingArea(2, 2, 8, 8);
  addGamingArea(width - 10, 2, 8, 8);
  
  // Poker tables in center
  const centerX = Math.floor(width / 2);
  const centerY = Math.floor(height / 2);
  for (let i = -2; i <= 2; i += 4) {
    for (let j = -2; j <= 2; j += 4) {
      if (centerX + i > 0 && centerX + i < width - 1 && 
          centerY + j > 0 && centerY + j < height - 1) {
        map[centerX + i][centerY + j] = TILE_INDICES.poker_table;
      }
    }
  }
  
  // Bar area
  for (let x = 2; x < 8; x++) {
    map[x][height - 3] = TILE_INDICES.bar;
  }
  
  // Portal to other zones
  map[1][1] = TILE_INDICES.portal; // To dark alley
  map[width - 2][1] = TILE_INDICES.portal; // To downtown
  
  return map;
}

// Generate a dark alley zone map
export function generateDarkAlleyMap(width: number = 40, height: number = 25): number[][] {
  const map: number[][] = Array(width).fill(0).map(() => Array(height).fill(TILE_INDICES.asphalt));
  
  // Create main alley paths
  const alleyWidth = 3;
  
  // Horizontal alleys
  for (let y = 4; y < height; y += 8) {
    for (let x = 0; x < width; x++) {
      for (let dy = 0; dy < alleyWidth; dy++) {
        if (y + dy < height) {
          map[x][y + dy] = TILE_INDICES.dirt;
        }
      }
    }
  }
  
  // Vertical alleys
  for (let x = 5; x < width; x += 10) {
    for (let y = 0; y < height; y++) {
      for (let dx = 0; dx < alleyWidth; dx++) {
        if (x + dx < width) {
          map[x + dx][y] = TILE_INDICES.dirt;
        }
      }
    }
  }
  
  // Add buildings (non-walkable areas)
  const addBuilding = (x: number, y: number, w: number, h: number) => {
    for (let dx = 0; dx < w; dx++) {
      for (let dy = 0; dy < h; dy++) {
        if (x + dx < width && y + dy < height) {
          map[x + dx][y + dy] = TILE_INDICES.brick;
        }
      }
    }
  };
  
  // Random buildings
  addBuilding(0, 0, 4, 3);
  addBuilding(10, 0, 6, 4);
  addBuilding(20, 0, 5, 3);
  addBuilding(0, 8, 4, 5);
  addBuilding(15, 10, 8, 6);
  addBuilding(30, 5, 7, 4);
  
  // Add dumpsters and cars
  map[7][5] = TILE_INDICES.dumpster;
  map[25][12] = TILE_INDICES.dumpster;
  map[18][7] = TILE_INDICES.car;
  
  // Street lights for atmosphere
  for (let x = 5; x < width; x += 10) {
    map[x][2] = TILE_INDICES.streetlight;
    map[x][height - 3] = TILE_INDICES.streetlight;
  }
  
  // Portals
  map[1][height - 2] = TILE_INDICES.portal; // To casino
  map[width - 2][height - 2] = TILE_INDICES.portal; // To suburb
  
  return map;
}

// Generate a suburb zone map
export function generateSuburbMap(width: number = 45, height: number = 32): number[][] {
  const map: number[][] = Array(width).fill(0).map(() => Array(height).fill(TILE_INDICES.grass));
  
  // Create roads in a grid pattern
  const roadInterval = 10;
  
  // Horizontal roads
  for (let y = 4; y < height; y += roadInterval) {
    for (let x = 0; x < width; x++) {
      map[x][y] = TILE_INDICES.road_straight;
      if (y + 1 < height) map[x][y + 1] = TILE_INDICES.road_straight;
    }
  }
  
  // Vertical roads
  for (let x = 5; x < width; x += roadInterval) {
    for (let y = 0; y < height; y++) {
      map[x][y] = TILE_INDICES.road_straight;
      if (x + 1 < width) map[x + 1][y] = TILE_INDICES.road_straight;
    }
  }
  
  // Fix intersections
  for (let x = 5; x < width; x += roadInterval) {
    for (let y = 4; y < height; y += roadInterval) {
      if (x < width && y < height) {
        map[x][y] = TILE_INDICES.road_intersection;
        if (x + 1 < width) map[x + 1][y] = TILE_INDICES.road_intersection;
        if (y + 1 < height) map[x][y + 1] = TILE_INDICES.road_intersection;
        if (x + 1 < width && y + 1 < height) map[x + 1][y + 1] = TILE_INDICES.road_intersection;
      }
    }
  }
  
  // Add houses in plots
  const addHouse = (x: number, y: number) => {
    // House footprint 4x4
    for (let dx = 0; dx < 4; dx++) {
      for (let dy = 0; dy < 4; dy++) {
        if (x + dx < width && y + dy < height) {
          map[x + dx][y + dy] = TILE_INDICES.house_wall;
        }
      }
    }
    // Add door
    if (x + 2 < width && y + 3 < height) {
      map[x + 2][y + 3] = TILE_INDICES.house_door;
    }
  };
  
  // Place houses between roads
  for (let x = 0; x < width - 10; x += roadInterval) {
    for (let y = 0; y < height - 10; y += roadInterval) {
      if (x + 7 < width && y + 7 < height) {
        addHouse(x + 1, y + 1);
        addHouse(x + 6, y + 6);
      }
    }
  }
  
  // Add trees for decoration
  for (let i = 0; i < 20; i++) {
    const x = Math.floor(Math.random() * width);
    const y = Math.floor(Math.random() * height);
    if (map[x][y] === TILE_INDICES.grass) {
      map[x][y] = TILE_INDICES.tree;
    }
  }
  
  // Portals
  map[0][Math.floor(height / 2)] = TILE_INDICES.portal; // To dark alley
  map[width - 1][Math.floor(height / 2)] = TILE_INDICES.portal; // To downtown
  
  return map;
}

// Convert tile indices to tileset coordinates (assuming 32x32 tiles in a 512x512 tileset)
export function tileIndexToCoords(index: number): { x: number; y: number } {
  const tilesPerRow = 16; // 512 / 32
  return {
    x: (index % tilesPerRow) * 32,
    y: Math.floor(index / tilesPerRow) * 32
  };
}

// Generate a default map for the game
const defaultMap = generateSuburbMap(32, 32);

// Map configuration exports for init.ts
export const mapwidth = 32;
export const mapheight = 32;
export const tilesetpath = '/assets/crime-tiles.png';
export const tilesetpxw = 512;
export const tilesetpxh = 512;
export const tiledim = 32;
export const bgtiles = [defaultMap];
export const objmap = [defaultMap.map(row => row.map(() => -1))]; // Empty object layer
export const animatedsprites: any[] = []; // No animated sprites for now