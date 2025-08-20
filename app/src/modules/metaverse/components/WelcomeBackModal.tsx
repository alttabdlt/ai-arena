import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Clock, Activity, Zap } from 'lucide-react';
import { Button } from '@ui/button';

interface OfflineProgress {
  pendingXP: number;
  timeAwaySeconds: number;
  activities: Array<{
    id: string;
    activity: string;
    emoji: string;
    xpGained: number;
    timestamp: string;
  }>;
  currentLevel: number;
  currentXP: number;
}

interface WelcomeBackModalProps {
  offlineProgress: OfflineProgress;
  formatTimeAway: (seconds: number) => string;
  onClaim: () => void;
  claiming: boolean;
}

const WelcomeBackModal: React.FC<WelcomeBackModalProps> = ({
  offlineProgress,
  formatTimeAway,
  onClaim,
  claiming
}) => {
  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ type: "spring", damping: 20 }}
          className="w-full max-w-md"
        >
          <div className="pixel-card bg-background/95 backdrop-blur p-6 space-y-6">
            {/* Header */}
            <div className="text-center space-y-2">
              <div className="inline-flex p-3 rounded-full bg-primary/10 mb-2">
                <Trophy className="h-8 w-8 text-yellow-500" />
              </div>
              <h2 className="text-2xl font-bold pixel-title">Welcome Back!</h2>
              <p className="text-muted-foreground">
                Your bot continued earning while you were away
              </p>
            </div>

            {/* Time Away */}
            <div className="flex items-center justify-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Time away:</span>
              <span className="font-medium">{formatTimeAway(offlineProgress.timeAwaySeconds)}</span>
            </div>

            {/* XP Earned */}
            <div className="text-center p-4 rounded-lg bg-gradient-to-br from-yellow-500/10 to-orange-500/10 border border-yellow-500/20">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Zap className="h-5 w-5 text-yellow-500" />
                <span className="text-sm text-muted-foreground">Idle XP Earned</span>
              </div>
              <div className="text-3xl font-bold text-yellow-500">
                +{offlineProgress.pendingXP.toLocaleString()} XP
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                Level {offlineProgress.currentLevel}
              </div>
            </div>

            {/* Recent Activities */}
            {offlineProgress.activities.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Activity className="h-4 w-4" />
                  <span>Recent Activities</span>
                </div>
                <div className="max-h-32 overflow-y-auto space-y-1 pr-2">
                  {offlineProgress.activities.slice(0, 5).map((activity) => (
                    <div
                      key={activity.id}
                      className="flex items-center gap-2 text-sm p-2 rounded bg-muted/50"
                    >
                      <span className="text-lg">{activity.emoji}</span>
                      <span className="flex-1 text-muted-foreground">{activity.activity}</span>
                      {activity.xpGained > 0 && (
                        <span className="text-xs text-yellow-500">+{activity.xpGained} XP</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              <Button 
                onClick={onClaim}
                disabled={claiming}
                className="flex-1 pixel-btn"
              >
                {claiming ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent mr-2" />
                    Claiming...
                  </>
                ) : (
                  <>
                    <Trophy className="h-4 w-4 mr-2" />
                    Claim Rewards
                  </>
                )}
              </Button>
            </div>

            {/* Estimated IDLE earnings */}
            <div className="text-center text-xs text-muted-foreground">
              Estimated $IDLE earned: ~{Math.floor(offlineProgress.pendingXP / 10)} $IDLE
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default WelcomeBackModal;