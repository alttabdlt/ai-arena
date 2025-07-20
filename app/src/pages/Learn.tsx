import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { 
  Trophy,
  Target,
  Sparkles,
  AlertTriangle,
  Brain,
  Gamepad2,
  Award,
  Info,
  Zap,
  Shield,
  Crown,
  TrendingUp
} from 'lucide-react';

export default function Learn() {
  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-8">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-gradient-to-br from-primary to-accent rounded-full flex items-center justify-center">
              <Brain className="h-8 w-8 text-primary-foreground" />
            </div>
          </div>
          <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            AI Arena Tournament Guide
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Master the tournament scoring system, understand achievements, and learn how AI models are evaluated in their raw form.
          </p>
        </div>

        <Tabs defaultValue="scoring" className="space-y-8">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="scoring">Scoring System</TabsTrigger>
            <TabsTrigger value="achievements">Achievements</TabsTrigger>
            <TabsTrigger value="style">Style Points</TabsTrigger>
            <TabsTrigger value="penalties">AI Penalties</TabsTrigger>
            <TabsTrigger value="strategy">Strategy Guide</TabsTrigger>
          </TabsList>

          {/* Scoring System Tab */}
          <TabsContent value="scoring" className="space-y-8">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="h-5 w-5" />
                  Tournament Scoring System
                </CardTitle>
                <CardDescription>
                  Winners are determined by total points, not just chip count. The final winner isn't simply who wins the last all-in!
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card className="border-primary/20">
                    <CardHeader>
                      <CardTitle className="text-lg">Base Points (40%)</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">
                        Current chip count forms the foundation of your score. More chips = more base points.
                      </p>
                      <div className="mt-2 text-2xl font-bold text-primary">
                        Chips × 0.4
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card className="border-accent/20">
                    <CardHeader>
                      <CardTitle className="text-lg">Style Points (50%)</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">
                        Reward for unconventional plays, successful bluffs, and entertaining gameplay.
                      </p>
                      <div className="mt-2 text-2xl font-bold text-accent">
                        Style × 0.5
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card className="border-destructive/20">
                    <CardHeader>
                      <CardTitle className="text-lg">Penalty Points (10%)</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">
                        Deductions for hand misreads and illogical decisions by AI models.
                      </p>
                      <div className="mt-2 text-2xl font-bold text-destructive">
                        -Penalty × 0.1
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="space-y-4">
                  <h4 className="font-semibold">Tournament Modes</h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                      <div>
                        <div className="font-medium">Classic Mode</div>
                        <div className="text-sm text-muted-foreground">70% chips, 30% style points</div>
                      </div>
                      <Badge>Traditional</Badge>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                      <div>
                        <div className="font-medium">Balanced Mode</div>
                        <div className="text-sm text-muted-foreground">50% chips, 50% style points</div>
                      </div>
                      <Badge variant="secondary">Recommended</Badge>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                      <div>
                        <div className="font-medium">Style Master Mode</div>
                        <div className="text-sm text-muted-foreground">30% chips, 70% style points</div>
                      </div>
                      <Badge variant="outline">Entertainment</Badge>
                    </div>
                  </div>
                </div>

                <div className="bg-primary/10 p-4 rounded-lg">
                  <p className="text-sm">
                    <strong>Important:</strong> The leaderboard updates every 5 hands to show current standings. 
                    A player with fewer chips can still win the tournament through style points!
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Achievements Tab */}
          <TabsContent value="achievements" className="space-y-8">
            <Card>
              <CardHeader>
                <CardTitle>All Achievements (15 Total)</CardTitle>
                <CardDescription>
                  Unlock achievements by completing specific challenges during tournaments
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {/* Skill Achievements */}
                  <div>
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                      <Target className="h-4 w-4" />
                      Skill Achievements
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <AchievementCard
                        icon="🩸"
                        name="First Blood"
                        description="Win your first hand"
                        points={50}
                        rarity="common"
                      />
                      <AchievementCard
                        icon="🔥"
                        name="Hot Streak"
                        description="Win 5 hands in a row"
                        points={200}
                        rarity="rare"
                      />
                      <AchievementCard
                        icon="🔮"
                        name="Mind Reader"
                        description="Make 10 perfect hand reads"
                        points={500}
                        rarity="epic"
                        progress={{ current: 0, target: 10 }}
                      />
                    </div>
                  </div>

                  {/* Style Achievements */}
                  <div>
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                      <Sparkles className="h-4 w-4" />
                      Style Achievements
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <AchievementCard
                        icon="🗑️"
                        name="Trash Master"
                        description="Win 5 hands with trash-tier starting cards (27o, 38o, etc.)"
                        points={400}
                        rarity="epic"
                        progress={{ current: 0, target: 5 }}
                      />
                      <AchievementCard
                        icon="🎭"
                        name="Bluff Artist"
                        description="Successfully bluff 10 times (win without showdown after aggression)"
                        points={300}
                        rarity="rare"
                        progress={{ current: 0, target: 10 }}
                      />
                      <AchievementCard
                        icon="🗿"
                        name="Giant Slayer"
                        description="Win 3 David vs Goliath situations (beat 3x larger stack)"
                        points={450}
                        rarity="epic"
                        progress={{ current: 0, target: 3 }}
                      />
                      <AchievementCard
                        icon="👑"
                        name="Comeback King"
                        description="Win 5 hands when down to less than 10% stack"
                        points={1000}
                        rarity="legendary"
                        progress={{ current: 0, target: 5 }}
                      />
                    </div>
                  </div>

                  {/* Milestone Achievements */}
                  <div>
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                      <TrendingUp className="h-4 w-4" />
                      Milestone Achievements
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <AchievementCard
                        icon="💯"
                        name="Centurion"
                        description="Play 100 hands"
                        points={100}
                        rarity="common"
                        progress={{ current: 0, target: 100 }}
                      />
                      <AchievementCard
                        icon="💰"
                        name="Millionaire"
                        description="Win a pot worth over 1,000,000 chips"
                        points={1500}
                        rarity="legendary"
                      />
                      <AchievementCard
                        icon="🤖"
                        name="Terminator"
                        description="Eliminate 5 opponents"
                        points={350}
                        rarity="rare"
                        progress={{ current: 0, target: 5 }}
                      />
                      <AchievementCard
                        icon="🏆"
                        name="Point Master"
                        description="Accumulate 10,000 total points"
                        points={750}
                        rarity="epic"
                        progress={{ current: 0, target: 10000 }}
                      />
                    </div>
                  </div>

                  {/* Special Achievements */}
                  <div>
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                      <Award className="h-4 w-4" />
                      Special Achievements
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <AchievementCard
                        icon="😱"
                        name="Living Dangerously"
                        description="Survive 10 all-ins"
                        points={400}
                        rarity="rare"
                        progress={{ current: 0, target: 10 }}
                      />
                      <AchievementCard
                        icon="👸"
                        name="Royal Treatment"
                        description="Win with a royal flush"
                        points={2000}
                        rarity="legendary"
                      />
                      <AchievementCard
                        icon="✨"
                        name="Flawless Victory"
                        description="Win a tournament without any misreads or penalties"
                        points={2500}
                        rarity="legendary"
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Style Points Tab */}
          <TabsContent value="style" className="space-y-8">
            <Card>
              <CardHeader>
                <CardTitle>Style Points & Bonuses</CardTitle>
                <CardDescription>
                  Earn bonus points for entertaining and unconventional gameplay
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <StyleBonusCard
                    title="Trash Hand Wins"
                    points={500}
                    description="Win with bottom-tier starting hands"
                    examples={['27o', '38o', '48o', '23o', '24o', '34o', '25o', '35o', '26o']}
                  />
                  <StyleBonusCard
                    title="Successful Bluffs"
                    points="200-500"
                    description="Win without showdown after aggressive action"
                    examples={['Raise with nothing and everyone folds', 'Re-raise bluff on river', 'All-in bluff with weak hand']}
                  />
                  <StyleBonusCard
                    title="David vs Goliath"
                    points={300}
                    description="Beat an opponent with 3x+ your chip stack"
                    examples={['5k chips beats 15k+ stack', '2k chips eliminates chip leader', 'Short stack doubles through big stack']}
                  />
                  <StyleBonusCard
                    title="Comeback King"
                    points={400}
                    description="Win when starting with <10% of total chips"
                    examples={['Win with 800 chips when pot is 10k+', 'Triple up from micro stack', 'Survive multiple all-ins']}
                  />
                </div>

                <div className="space-y-4">
                  <h4 className="font-semibold">How Bluffs Are Calculated</h4>
                  <div className="bg-muted/30 p-4 rounded-lg space-y-2">
                    <p className="text-sm">A TRUE bluff is recorded when:</p>
                    <ol className="list-decimal list-inside text-sm space-y-1 ml-4">
                      <li>The player wins WITHOUT showdown (everyone else folds)</li>
                      <li>The player was the aggressor (made last aggressive action: raise/bet/all-in)</li>
                      <li>The player had a WEAK hand (high card, low pair, or missed draw)</li>
                    </ol>
                    <div className="mt-3 p-3 bg-primary/10 rounded">
                      <p className="text-sm font-medium">Example: Bot has 7♣ 2♠ → raises → others fold = True Bluff!</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Only weak hands count as bluffs. Strong hands like AK winning without showdown are value bets, not bluffs.
                      </p>
                    </div>
                    <div className="mt-3 p-3 bg-muted rounded">
                      <p className="text-sm font-medium">What counts as a weak hand for bluffing:</p>
                      <ul className="list-disc list-inside text-xs mt-1 ml-2 space-y-0.5">
                        <li>High card (no pair)</li>
                        <li>Small pocket pairs (8 or lower)</li>
                        <li>Bottom pair or weak pair on board</li>
                        <li>Missed draws (busted flush/straight)</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-semibold">Style Multipliers</h4>
                  <div className="space-y-2">
                    <MultiplierRow label="Unconventional Wins" multiplier="5% per win" max="15%" />
                    <MultiplierRow label="Bluff Wins" multiplier="3% per bluff" max="15%" />
                    <MultiplierRow label="Comeback Wins" multiplier="10% per comeback" max="20%" />
                    <MultiplierRow label="Active Player" multiplier="10% bonus" max="10%" condition="60%+ hand participation" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* AI Penalties Tab */}
          <TabsContent value="penalties" className="space-y-8">
            <Card>
              <CardHeader>
                <CardTitle>AI Evaluation & Penalties</CardTitle>
                <CardDescription>
                  How AI models are penalized for misreading hands and making illogical decisions
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <h4 className="font-semibold">Hand Misread Severity Levels</h4>
                  <div className="space-y-3">
                    <PenaltyCard
                      severity="CRITICAL"
                      penalty={200}
                      description="Catastrophic hand evaluation errors"
                      examples={[
                        'Folding the nuts (best possible hand)',
                        'Thinking they have "potential flush" on river',
                        'Missing a straight or flush on river',
                        'Folding a winning hand at showdown'
                      ]}
                    />
                    <PenaltyCard
                      severity="MAJOR"
                      penalty={100}
                      description="Significant hand strength errors (2+ ranks off)"
                      examples={[
                        'Thinking two pair is just one pair',
                        'Missing a full house',
                        'Overvaluing weak hands significantly',
                        'Confusing hand rankings'
                      ]}
                    />
                    <PenaltyCard
                      severity="MINOR"
                      penalty={50}
                      description="Small evaluation errors or timing issues"
                      examples={[
                        'Slightly misranking kicker strength',
                        'Minor pot odds calculation errors',
                        'Slow decision making',
                        'Overvaluing suited cards pre-flop'
                      ]}
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-semibold">Common AI Mistakes</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                      <div className="font-medium text-sm mb-1">The "Potential Flush" Error</div>
                      <p className="text-xs text-muted-foreground">
                        AI thinks it can still make a flush when all 5 community cards are already revealed
                      </p>
                    </div>
                    <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                      <div className="font-medium text-sm mb-1">Folding Straights</div>
                      <p className="text-xs text-muted-foreground">
                        AI doesn't recognize it has a straight and folds to small bets
                      </p>
                    </div>
                    <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                      <div className="font-medium text-sm mb-1">Illogical Folds</div>
                      <p className="text-xs text-muted-foreground">
                        Folding when checking is available (0 chips to call)
                      </p>
                    </div>
                    <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                      <div className="font-medium text-sm mb-1">Hand Ranking Confusion</div>
                      <p className="text-xs text-muted-foreground">
                        Not understanding that flush beats straight, etc.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-primary/10 p-4 rounded-lg">
                  <p className="text-sm">
                    <strong>Entertainment Value:</strong> These mistakes make AI vs AI battles unpredictable and entertaining! 
                    The penalty system ensures accuracy is rewarded while still allowing for amusing errors.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Strategy Guide Tab */}
          <TabsContent value="strategy" className="space-y-8">
            <Card>
              <CardHeader>
                <CardTitle>Strategic Gameplay Guide</CardTitle>
                <CardDescription>
                  Understanding optimal strategies for different tournament modes
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <h4 className="font-semibold">Mode-Specific Strategies</h4>
                  
                  <div className="space-y-3">
                    <StrategyCard
                      mode="Classic Mode (70% chips, 30% style)"
                      strategy="Focus on chip accumulation with occasional style plays"
                      tips={[
                        'Prioritize survival and steady chip growth',
                        'Take calculated risks for big pots',
                        'Style points are bonus, not primary focus',
                        'Avoid excessive bluffing'
                      ]}
                    />
                    <StrategyCard
                      mode="Balanced Mode (50% chips, 50% style)"
                      strategy="Equal focus on chips and entertainment value"
                      tips={[
                        'Mix conservative and aggressive play',
                        'Look for bluffing opportunities',
                        'Play more marginal hands for style points',
                        'Balance risk and reward carefully'
                      ]}
                    />
                    <StrategyCard
                      mode="Style Master Mode (30% chips, 70% style)"
                      strategy="Maximum entertainment and unconventional play"
                      tips={[
                        'Play trash hands aggressively',
                        'Bluff frequently for style points',
                        'Take high-risk, high-reward lines',
                        'Chip preservation less important than style'
                      ]}
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-semibold">Understanding Percentages</h4>
                  <div className="bg-muted/30 p-4 rounded-lg space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <div className="font-medium text-sm mb-2">Stack Percentages</div>
                        <p className="text-xs text-muted-foreground">
                          "Calling costs 20% of your stack" helps AI understand relative bet sizes
                        </p>
                      </div>
                      <div>
                        <div className="font-medium text-sm mb-2">Pot Odds</div>
                        <p className="text-xs text-muted-foreground">
                          "You need 33% equity to call" provides mathematical context for decisions
                        </p>
                      </div>
                      <div>
                        <div className="font-medium text-sm mb-2">Stack-to-Pot Ratio (SPR)</div>
                        <p className="text-xs text-muted-foreground">
                          "SPR is 2.5" indicates commitment level and future betting
                        </p>
                      </div>
                      <div>
                        <div className="font-medium text-sm mb-2">Table Share</div>
                        <p className="text-xs text-muted-foreground">
                          "You have 15% of chips in play" shows relative table position
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-semibold">Key Concepts</h4>
                  <div className="space-y-2">
                    <div className="flex items-start gap-2">
                      <Info className="h-4 w-4 text-primary mt-0.5" />
                      <div>
                        <div className="font-medium text-sm">Final Winner ≠ Last All-In Winner</div>
                        <p className="text-xs text-muted-foreground">
                          Tournament winner is determined by total points accumulated throughout all hands
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <Info className="h-4 w-4 text-primary mt-0.5" />
                      <div>
                        <div className="font-medium text-sm">Neutral AI Prompts</div>
                        <p className="text-xs text-muted-foreground">
                          AI models receive raw JSON data without coaching to reveal true capabilities
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <Info className="h-4 w-4 text-primary mt-0.5" />
                      <div>
                        <div className="font-medium text-sm">Entertainment Value</div>
                        <p className="text-xs text-muted-foreground">
                          AI mistakes and unconventional plays create unpredictable, exciting matches
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

// Helper Components
function AchievementCard({ 
  icon, 
  name, 
  description, 
  points, 
  rarity,
  progress 
}: {
  icon: string;
  name: string;
  description: string;
  points: number;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  progress?: { current: number; target: number };
}) {
  const rarityColors = {
    common: 'border-slate-400',
    rare: 'border-blue-400',
    epic: 'border-purple-400',
    legendary: 'border-yellow-400'
  };

  return (
    <div className={`p-3 rounded-lg border ${rarityColors[rarity]} bg-card`}>
      <div className="flex items-start gap-3">
        <div className="text-2xl">{icon}</div>
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <h5 className="font-medium">{name}</h5>
            <Badge variant="outline" className="text-xs">
              {points} pts
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mb-2">{description}</p>
          {progress && (
            <div className="space-y-1">
              <Progress value={(progress.current / progress.target) * 100} className="h-2" />
              <p className="text-xs text-muted-foreground text-right">
                {progress.current} / {progress.target}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StyleBonusCard({
  title,
  points,
  description,
  examples
}: {
  title: string;
  points: number | string;
  description: string;
  examples: string[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center justify-between">
          {title}
          <Badge variant="secondary">{points} pts</Badge>
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Examples:</p>
          <ul className="list-disc list-inside text-xs space-y-0.5 ml-2">
            {examples.map((example, i) => (
              <li key={i}>{example}</li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

function PenaltyCard({
  severity,
  penalty,
  description,
  examples
}: {
  severity: string;
  penalty: number;
  description: string;
  examples: string[];
}) {
  const severityColors = {
    CRITICAL: 'border-red-500 bg-red-500/10',
    MAJOR: 'border-orange-500 bg-orange-500/10',
    MINOR: 'border-yellow-500 bg-yellow-500/10'
  };

  return (
    <div className={`p-4 rounded-lg border ${severityColors[severity as keyof typeof severityColors]}`}>
      <div className="flex items-center justify-between mb-2">
        <h5 className="font-medium flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          {severity}
        </h5>
        <Badge variant="destructive">-{penalty} pts</Badge>
      </div>
      <p className="text-sm text-muted-foreground mb-2">{description}</p>
      <ul className="list-disc list-inside text-xs space-y-0.5 ml-2">
        {examples.map((example, i) => (
          <li key={i}>{example}</li>
        ))}
      </ul>
    </div>
  );
}

function MultiplierRow({
  label,
  multiplier,
  max,
  condition
}: {
  label: string;
  multiplier: string;
  max: string;
  condition?: string;
}) {
  return (
    <div className="flex items-center justify-between p-2 rounded bg-muted/30">
      <div>
        <div className="text-sm font-medium">{label}</div>
        {condition && <div className="text-xs text-muted-foreground">{condition}</div>}
      </div>
      <div className="text-right">
        <div className="text-sm">{multiplier}</div>
        <div className="text-xs text-muted-foreground">Max: {max}</div>
      </div>
    </div>
  );
}

function StrategyCard({
  mode,
  strategy,
  tips
}: {
  mode: string;
  strategy: string;
  tips: string[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{mode}</CardTitle>
        <CardDescription>{strategy}</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="list-disc list-inside text-sm space-y-1 ml-2">
          {tips.map((tip, i) => (
            <li key={i}>{tip}</li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}