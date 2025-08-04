# Tileset Issue - Why Objects Aren't Showing

## The Problem

The game can only use ONE tileset PNG file at a time. Currently we're using:
- **crime-tiles.png** - Contains only 4 tiles (floor patterns)
- **crime-city-sprites.png** - Contains all the objects but is not being used

When I placed objects with indices like 64, 128, 512, etc., they don't exist in crime-tiles.png, so nothing appears.

## The Solution

We have several options:

### Option 1: Switch to crime-city-sprites.png
Use crime-city-sprites.png for BOTH floors and objects. We need to find suitable floor tiles within this sprite sheet.

### Option 2: Create a Combined Tileset
Merge both PNGs into one image that contains:
- Floor tiles from crime-tiles.png
- Objects from crime-city-sprites.png

### Option 3: Use Only crime-tiles.png
Since it only has 4 tiles, we'd have a very limited world with just floor patterns and no objects.

## Testing Maps Available

1. **testCrimeCitySprites.js** - Shows all tiles from crime-city-sprites.png
2. **crimeTilesReference.js** - Shows all tiles from crime-tiles.png (only 4)

To test, change the import in convex/init.ts to:
```javascript
import * as map from '../data/testCrimeCitySprites';
```

This will show you what's actually available in the crime-city-sprites.png tileset.