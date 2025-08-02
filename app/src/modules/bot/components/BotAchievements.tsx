import { Card, CardContent, CardHeader, CardTitle } from '@ui/card';
import { Badge } from '@ui/badge';
import { Progress } from '@ui/progress';
import { Trophy, Star, Zap, Target, Award, Lock } from 'lucide-react';

interface Achievement {
  id: string;
  name: string;
  description: string;
  category: 'skill' | 'style' | 'milestone' | 'special';
  icon: string;
  unlockedAt?: string;
  progress?: number;
  maxProgress?: number;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
}

interface BotAchievementsProps {
  achievements: Achievement[];
  totalAchievements: number;
}

export function BotAchievements({ achievements, totalAchievements }: BotAchievementsProps) {
  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'skill':
        return Target;
      case 'style':
        return Zap;
      case 'milestone':
        return Trophy;
      case 'special':
        return Star;
      default:
        return Award;
    }
  };

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case 'common':
        return 'text-gray-500 bg-gray-100 dark:bg-gray-900';
      case 'rare':
        return 'text-blue-500 bg-blue-100 dark:bg-blue-900/20';
      case 'epic':
        return 'text-purple-500 bg-purple-100 dark:bg-purple-900/20';
      case 'legendary':
        return 'text-orange-500 bg-orange-100 dark:bg-orange-900/20';
      default:
        return 'text-muted-foreground bg-muted';
    }
  };

  const unlockedAchievements = achievements.filter(a => a.unlockedAt);
  const progressAchievements = achievements.filter(a => !a.unlockedAt && a.progress);
  const unlockedPercentage = totalAchievements > 0 ? (unlockedAchievements.length / totalAchievements) * 100 : 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Achievements</CardTitle>
          <Badge variant="outline">
            {unlockedAchievements.length} / {totalAchievements}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-muted-foreground">Overall Progress</span>
              <span className="font-medium">{unlockedPercentage.toFixed(0)}%</span>
            </div>
            <Progress value={unlockedPercentage} className="h-2" />
          </div>

          <div className="space-y-3">
            {/* Unlocked Achievements */}
            {unlockedAchievements.map((achievement) => {
              const CategoryIcon = getCategoryIcon(achievement.category);
              return (
                <div 
                  key={achievement.id} 
                  className="flex items-start gap-3 p-3 rounded-lg bg-muted/20 border"
                >
                  <div className={`text-2xl p-2 rounded-lg ${getRarityColor(achievement.rarity)}`}>
                    {achievement.icon}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold">{achievement.name}</h4>
                      <CategoryIcon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {achievement.description}
                    </p>
                    {achievement.unlockedAt && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Unlocked {new Date(achievement.unlockedAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}

            {/* In Progress Achievements */}
            {progressAchievements.map((achievement) => {
              const CategoryIcon = getCategoryIcon(achievement.category);
              const progressPercentage = achievement.progress && achievement.maxProgress
                ? (achievement.progress / achievement.maxProgress) * 100
                : 0;
              
              return (
                <div 
                  key={achievement.id} 
                  className="flex items-start gap-3 p-3 rounded-lg bg-muted/10 border border-dashed opacity-75"
                >
                  <div className="text-2xl p-2 rounded-lg bg-muted/50 relative">
                    <Lock className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-muted-foreground">
                        {achievement.name}
                      </h4>
                      <CategoryIcon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {achievement.description}
                    </p>
                    {achievement.progress && achievement.maxProgress && (
                      <div className="mt-2">
                        <div className="flex justify-between text-xs mb-1">
                          <span>Progress</span>
                          <span>{achievement.progress} / {achievement.maxProgress}</span>
                        </div>
                        <Progress value={progressPercentage} className="h-1" />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {achievements.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Trophy className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p>No achievements earned yet</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}