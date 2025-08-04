# Sprite Implementation Guide

## How to Add New Sprites to the Game

### Step 1: Create Your Sprite Atlas

1. **For Map Tiles**:
   - Create a PNG file with all your tiles arranged in a grid
   - Standard tile size: 32x32 pixels
   - No padding between tiles
   - Save as `crime-tiles.png` in `/public/assets/`

2. **For Characters**:
   - Create a PNG file with character animations
   - Each character needs 12 frames (4 directions × 3 frames)
   - Arrange in a 3×4 grid per character
   - Save as `crime-characters.png` in `/public/assets/`

### Step 2: Generate Tile Index Data

For map tiles, you need to create a data file that maps tile indices to their positions in the sprite atlas:

```javascript
// Example: data/crime-tiles.js
export const tilesetpath = "/assets/crime-tiles.png"
export const tiledim = 32  // Tile dimension in pixels
export const tilesetpxw = 1440  // Total width of tileset
export const tilesetpxh = 1024  // Total height of tileset

// Calculate how tiles are indexed:
// Index = x + (y * tilesPerRow)
// Where tilesPerRow = tilesetpxw / tiledim = 45

// Example tile indices:
// Casino floor (red carpet) at position (0,0) = index 0
// Slot machine at position (5,2) = 5 + (2 * 45) = 95
```

### Step 3: Create Character Spritesheet Data

For each character, create a spritesheet data file:

```typescript
// data/spritesheets/[character-name].ts
import { SpritesheetData } from './types';

export const data: SpritesheetData = {
  frames: {
    // Define each frame's position in the atlas
    down: { frame: { x: 0, y: 0, w: 32, h: 32 }, ... },
    down2: { frame: { x: 32, y: 0, w: 32, h: 32 }, ... },
    // ... continue for all 12 frames
  },
  animations: {
    down: ['down', 'down2', 'down3'],
    left: ['left', 'left2', 'left3'],
    right: ['right', 'right2', 'right3'],
    up: ['up', 'up2', 'up3'],
  },
};
```

### Step 4: Create Map Data

Create a map file that uses your tile indices:

```javascript
// data/maps/crimeCity.js
export const bgTiles = [
  // First background layer
  [
    [0, 0, 0, 1, 1, 1, ...],  // Row 1
    [0, 45, 45, 1, 2, 2, ...], // Row 2
    // ... continue for all rows
  ],
  // Additional layers for depth
];

export const objectTiles = [
  // Object layer (slot machines, etc.)
  [
    [-1, -1, 95, -1, -1, ...],  // -1 means no object
    // ... continue
  ]
];
```

### Step 5: Working with Tile Indices

To calculate tile indices from the sprite atlas:

1. **Tiles per row** = atlas width ÷ tile size
   - Example: 1440 ÷ 32 = 45 tiles per row

2. **Tile index** = column + (row × tiles per row)
   - Tile at column 5, row 2: 5 + (2 × 45) = 95

3. **Reverse calculation** (index to position):
   - Column = index % tiles per row
   - Row = Math.floor(index ÷ tiles per row)

### Example: Adding a Casino Zone

1. Create casino tiles in your sprite atlas:
   - Rows 0-5: Casino floor variations, walls, decorations
   - Place slot machines at specific grid positions

2. Calculate indices:
   - Red carpet (0,0): index 0
   - Gold floor (1,0): index 1
   - Slot machine (5,2): index 95
   - Poker table (10,3): index 145

3. Build the map array:
```javascript
[
  [0, 0, 1, 1, 0, 0],  // Mix of red and gold carpet
  [0, 95, 1, 1, 95, 0], // Slot machines on carpet
  [0, 0, 145, 145, 0, 0], // Poker tables
]
```

### Tips

- Use a grid-based image editor for precise tile placement
- Keep a reference sheet of tile indices
- Test incrementally - add a few tiles at a time
- Use the level editor (npm run le) to visually verify tiles
- Consider using tools like Tiled to generate map data

### Common Tile Index Ranges

Based on a 45 tiles per row layout:
- Row 0 (0-44): Basic floor tiles
- Row 1 (45-89): Wall tiles
- Row 2 (90-134): Objects layer 1
- Row 3 (135-179): Objects layer 2
- Row 4 (180-224): Decorations
- Row 5 (225-269): Special effects

Remember: The game extracts sprites by calculating pixel coordinates from these indices, so accurate indexing is crucial!