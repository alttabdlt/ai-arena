# Sprite Assets

This directory should contain Stardew Valley-style character sprite sheets.

## Expected Format

Each sprite sheet should be a PNG file with:
- **Frame Size**: 32x64 pixels per frame
- **Layout**: 4 directions (down, left, right, up) x 4 frames each
- **Total Size**: 128x256 pixels
- **Naming**: `{personality}_{variant}.png` (e.g., `criminal_1.png`)

## Directory Structure

```
sprites/
├── criminal_1.png    # Dark clothing, tough appearance
├── criminal_2.png    # Black/red outfit variant
├── criminal_3.png    # Leather jacket style
├── gambler_1.png     # Fancy suit with hat
├── gambler_2.png     # Colorful casino style
├── gambler_3.png     # Dealer outfit
├── worker_1.png      # Construction worker
├── worker_2.png      # Farmer with overalls
└── worker_3.png      # Miner with helmet
```

## Sprite Sheet Layout

```
[Frame 1] [Frame 2] [Frame 3] [Frame 4]  <- Down facing (row 0)
[Frame 1] [Frame 2] [Frame 3] [Frame 4]  <- Left facing (row 1)
[Frame 1] [Frame 2] [Frame 3] [Frame 4]  <- Right facing (row 2)
[Frame 1] [Frame 2] [Frame 3] [Frame 4]  <- Up facing (row 3)
```

## Integration

The `StardewSpriteSelector` service will automatically select appropriate sprites based on bot personality and use them throughout the application.

## Temporary Assets

Currently using `/assets/player.png` from the metaverse game as a placeholder. Replace with actual Stardew Valley-style sprites for production.