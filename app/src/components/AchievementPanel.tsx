import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Trophy, Star, Award, Crown, Lock } from 'lucide-react';
import { Achievement, PlayerAchievement } from '@/poker/achievements/achievement-system';

interface AchievementPanelProps {
  allAchievements: Achievement[];
  playerAchievements: Map<string, (Achievement & PlayerAchievement)[]>;
  achievementProgress: Map<string, Map<string, { progress: number; target: number }>>;
  players: Map<string, { name: string; avatar: string }>;
}

const getRarityColor = (rarity: string) => {
  switch (rarity) {
    case 'common':
      return 'bg-gray-500';
    case 'rare':
      return 'bg-blue-500';
    case 'epic':
      return 'bg-purple-500';
    case 'legendary':
      return 'bg-yellow-500';
    default:
      return 'bg-gray-500';
  }
};

const getRarityIcon = (rarity: string) => {
  switch (rarity) {
    case 'common':
      return <Star className="h-4 w-4" />;
    case 'rare':
      return <Award className="h-4 w-4" />;
    case 'epic':
      return <Trophy className="h-4 w-4" />;
    case 'legendary':
      return <Crown className="h-4 w-4" />;
    default:
      return <Star className="h-4 w-4" />;
  }
};

const getCategoryColor = (category: string) => {
  switch (category) {
    case 'skill':
      return 'text-blue-500';
    case 'style':
      return 'text-purple-500';
    case 'milestone':
      return 'text-green-500';
    case 'special':
      return 'text-yellow-500';
    default:
      return 'text-gray-500';
  }
};

export function AchievementPanel({ 
  allAchievements, 
  playerAchievements, 
  achievementProgress,
  players 
}: AchievementPanelProps) {
  const playerIds = Array.from(players.keys());
  
  const getPlayerUnlockedCount = (playerId: string) => {
    return playerAchievements.get(playerId)?.length || 0;
  };
  
  const getPlayerTotalPoints = (playerId: string) => {
    const achievements = playerAchievements.get(playerId) || [];
    return achievements.reduce((sum, a) => sum + a.points, 0);
  };
  
  const isAchievementUnlocked = (playerId: string, achievementId: string) => {
    const achievements = playerAchievements.get(playerId) || [];
    return achievements.some(a => a.id === achievementId);
  };
  
  const getAchievementProgress = (playerId: string, achievementId: string) => {
    return achievementProgress.get(playerId)?.get(achievementId);
  };
  
  const groupedAchievements = allAchievements.reduce((acc, achievement) => {
    if (!acc[achievement.category]) acc[achievement.category] = [];
    acc[achievement.category].push(achievement);
    return acc;
  }, {} as Record<string, Achievement[]>);
  
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Achievements</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue={playerIds[0]} className="w-full">
          <TabsList className="grid w-full" style={{ gridTemplateColumns: `repeat(${playerIds.length}, 1fr)` }}>
            {playerIds.map(playerId => {
              const player = players.get(playerId)!;
              const unlockedCount = getPlayerUnlockedCount(playerId);
              const totalPoints = getPlayerTotalPoints(playerId);
              
              return (
                <TabsTrigger key={playerId} value={playerId} className="flex items-center gap-2">
                  <img src={player.avatar} alt={player.name} className="w-6 h-6 rounded-full" />
                  <span>{player.name}</span>
                  <Badge variant="secondary" className="text-xs">
                    {unlockedCount}/{allAchievements.length}
                  </Badge>
                </TabsTrigger>
              );
            })}
          </TabsList>
          
          {playerIds.map(playerId => {
            const totalPoints = getPlayerTotalPoints(playerId);
            const unlockedCount = getPlayerUnlockedCount(playerId);
            const completionPercent = (unlockedCount / allAchievements.length) * 100;
            
            return (
              <TabsContent key={playerId} value={playerId} className="space-y-6">
                {/* Summary */}
                <div className="flex items-center justify-between p-4 bg-secondary/20 rounded-lg">
                  <div>
                    <div className="text-sm text-muted-foreground">Total Progress</div>
                    <div className="flex items-center gap-4 mt-1">
                      <Progress value={completionPercent} className="w-32" />
                      <span className="font-medium">{unlockedCount}/{allAchievements.length}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-muted-foreground">Total Points</div>
                    <div className="text-2xl font-bold">{totalPoints.toLocaleString()}</div>
                  </div>
                </div>
                
                {/* Achievement Categories */}
                {Object.entries(groupedAchievements).map(([category, achievements]) => (
                  <div key={category} className="space-y-3">
                    <h3 className={`text-lg font-semibold capitalize ${getCategoryColor(category)}`}>
                      {category} ({achievements.filter(a => isAchievementUnlocked(playerId, a.id)).length}/{achievements.length})
                    </h3>
                    
                    <div className="grid gap-3">
                      {achievements.map(achievement => {
                        const isUnlocked = isAchievementUnlocked(playerId, achievement.id);
                        const progress = getAchievementProgress(playerId, achievement.id);
                        
                        return (
                          <div
                            key={achievement.id}
                            className={`
                              p-4 rounded-lg border transition-all
                              ${isUnlocked 
                                ? 'bg-secondary/30 border-secondary' 
                                : 'bg-background/50 border-border opacity-75'
                              }
                            `}
                          >
                            <div className="flex items-start gap-3">
                              <div className={`text-2xl ${isUnlocked ? '' : 'grayscale opacity-50'}`}>
                                {achievement.icon}
                              </div>
                              
                              <div className="flex-1">
                                <div className="flex items-center justify-between mb-1">
                                  <h4 className="font-semibold flex items-center gap-2">
                                    {achievement.name}
                                    {!isUnlocked && <Lock className="h-3 w-3 text-muted-foreground" />}
                                  </h4>
                                  <div className="flex items-center gap-2">
                                    <Badge className={getRarityColor(achievement.rarity)}>
                                      {getRarityIcon(achievement.rarity)}
                                      <span className="ml-1">{achievement.rarity}</span>
                                    </Badge>
                                    <span className="text-sm font-medium">+{achievement.points}</span>
                                  </div>
                                </div>
                                
                                <p className="text-sm text-muted-foreground mb-2">
                                  {achievement.description}
                                </p>
                                
                                {progress && !isUnlocked && (
                                  <div className="mt-2">
                                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                                      <span>Progress</span>
                                      <span>{progress.progress}/{progress.target}</span>
                                    </div>
                                    <Progress 
                                      value={(progress.progress / progress.target) * 100} 
                                      className="h-2"
                                    />
                                  </div>
                                )}
                                
                                {isUnlocked && (
                                  <div className="text-xs text-muted-foreground mt-1">
                                    ✓ Unlocked
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </TabsContent>
            );
          })}
        </Tabs>
      </CardContent>
    </Card>
  );
}