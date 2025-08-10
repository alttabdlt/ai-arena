# Initialize Bot Experience Records

Run these commands in the Convex dashboard to initialize experience for all bots:

## 1. First, open the Convex dashboard:
```bash
npm run dashboard
```

## 2. Run initialization for all worlds:
In the Functions tab, run:
```
aiTown.idleGains:initializeAllWorldsExperience
```

## 3. Test idle XP manually:
Run this to trigger one idle XP tick:
```
aiTown.idleLoot:triggerIdleXP
```

## 4. Check if cron is working:
The idle XP should automatically tick every 10 seconds. Check the logs to see:
- "Processing idle XP for X active worlds"
- "Idle XP tick: Granted XP to Y bots"

## Stats should now update:
- XP will increase by 1 every 10 seconds (more in risky zones)
- UI refreshes every 15 seconds to show new values
- Category XP will accumulate based on activities
- Skills start at 10 and increase with allocated skill points