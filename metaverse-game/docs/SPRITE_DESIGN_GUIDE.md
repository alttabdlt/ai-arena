# Crime City Sprite Design Guide

## Overview
This document outlines the sprite requirements for the AI Arena Crime Metaverse game. All sprites follow a 32x32 pixel grid system.

## Tileset Structure

### Zone-Specific Tiles

#### Casino Zone (Glamorous & Risky)
- **Floor Tiles**: 
  - Red carpet patterns (4 variants)
  - Black/gold checkered floors
  - Marble tiles with gold trim
- **Wall Tiles**:
  - Art deco walls with gold accents
  - Neon sign borders
  - VIP rope barriers
- **Objects**:
  - Slot machines (3 types)
  - Poker tables
  - Roulette wheels
  - Card dealer stands
  - Stacks of chips
  - Gold coins scattered
  - Champagne fountains
  - Security cameras

#### Dark Alley Zone (Gritty & Dangerous)
- **Floor Tiles**:
  - Cracked concrete (4 variants)
  - Wet pavement with puddles
  - Trash-littered ground
  - Blood stains
- **Wall Tiles**:
  - Graffiti-covered brick walls
  - Rusty metal fences
  - Broken windows
  - Fire escapes
- **Objects**:
  - Dumpsters
  - Trash bags
  - Broken bottles
  - Street lamps (working/broken)
  - Manhole covers
  - Cardboard boxes
  - Barrels with fire
  - Abandoned shopping carts

#### Suburb Zone (Safe & Wealthy)
- **Floor Tiles**:
  - Clean sidewalks
  - Manicured grass
  - Stone pathways
  - Driveways
- **Wall Tiles**:
  - White picket fences
  - Brick house walls
  - Hedge walls
  - Security gates
- **Objects**:
  - Mailboxes
  - Garden furniture
  - Fountains
  - Luxury cars
  - Security systems
  - Lawn decorations
  - Swimming pools
  - Dog houses

#### Downtown Zone (Neutral Hub)
- **Floor Tiles**:
  - City sidewalks
  - Crosswalks
  - Plaza tiles
- **Objects**:
  - Street vendors
  - Bus stops
  - Phone booths
  - ATMs
  - News stands

#### Underground Zone (Fight Club)
- **Floor Tiles**:
  - Concrete with blood stains
  - Metal grating
  - Chain-link floor sections
- **Objects**:
  - Fighting ring/cage
  - Betting booths
  - Medical stations
  - Weapons racks

### UI Elements
- Zone portal animations (swirling effects)
- Currency icons (Blood tokens, Diamonds, Street Cred)
- Interaction prompts
- Crime activity indicators

## Character Sprite Requirements

### Base Character Template
- 32x32 pixels per frame
- 4 directions (down, left, right, up)
- 3 frames per direction for walk animation
- Total: 12 frames per character

### Personality-Specific Designs

#### Criminal Characters
- **Visual Traits**:
  - Dark clothing (leather jackets, hoodies)
  - Visible weapons (baseball bats, knives)
  - Scars or tattoos
  - Aggressive stance
- **Color Palette**: Black, dark red, grey
- **Accessories**: Chains, bandanas, brass knuckles

#### Gambler Characters
- **Visual Traits**:
  - Flashy suits or casual wear
  - Playing cards visible
  - Dice accessories
  - Confident posture
- **Color Palette**: Purple, gold, green (money colors)
- **Accessories**: Sunglasses, gold chains, lucky charms

#### Worker Characters
- **Visual Traits**:
  - Plain clothing (work uniforms, casual wear)
  - Tool belt or briefcase
  - Tired but determined expression
  - Practical stance
- **Color Palette**: Blue, brown, beige
- **Accessories**: Hard hats, tools, lunch boxes

### Animation States
- Idle (standing still)
- Walking (3-frame cycle)
- Robbery action (quick grab motion)
- Combat (punch/defend)
- Knocked out (lying down)
- Celebrating (arms up)
- Trading (exchange motion)

## Technical Specifications

### File Format
- PNG format with transparency
- 8-bit color depth for retro aesthetic
- Organized in grid layout (no padding between tiles)

### Sprite Atlas Layout
```
Crime-Tiles.png (1440x1024)
- Rows 0-5: Casino tiles
- Rows 6-11: Dark Alley tiles
- Rows 12-17: Suburb tiles
- Rows 18-20: Downtown tiles
- Rows 21-23: Underground tiles
- Rows 24-31: Objects and decorations

Crime-Characters.png (384x512)
- Each character: 96x128 pixels (3x4 grid)
- 4 characters per row
- Criminals: Row 0-1
- Gamblers: Row 2-3
- Workers: Row 4-5
```

### Color Palette Guidelines
- Maximum 32 colors per sprite sheet
- Consistent lighting (top-left light source)
- Dark, gritty atmosphere with neon accents
- High contrast for readability

## Implementation Notes

1. Each tile must seamlessly connect with adjacent tiles
2. Include variations to avoid repetitive patterns
3. Objects should have clear collision boundaries
4. Characters need distinct silhouettes for easy identification
5. Maintain consistent pixel art style across all assets

## Zone Transitions
- Portal effects: 32x64 pixels (tall for dramatic effect)
- Animated with 4-6 frames
- Unique color scheme per zone
- Particle effects for ambiance