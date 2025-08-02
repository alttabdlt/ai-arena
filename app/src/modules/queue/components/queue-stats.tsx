import { Card, CardContent, CardHeader, CardTitle } from '@ui/card';
import { Badge } from '@ui/badge';
import { Progress } from '@ui/progress';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { 
  TrendingUp, 
  TrendingDown, 
  Activity,
  Users,
  Clock,
  BarChart3
} from 'lucide-react';

interface QueueType {
  type: string;
  count: number;
  estimatedWaitTime: number;
  color?: string;
}

interface HistoricalData {
  time: string;
  queueSize: number;
  averageWait: number;
}

interface QueueStatsProps {
  queueTypes: QueueType[];
  historicalData?: HistoricalData[];
  recentMatches?: number;
  matchesPerHour?: number;
  peakQueueSize?: number;
  currentTrend?: 'increasing' | 'decreasing' | 'stable';
}

const COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444'];

export function QueueStats({
  queueTypes,
  historicalData = [],
  recentMatches = 0,
  matchesPerHour = 0,
  peakQueueSize = 0,
  currentTrend = 'stable'
}: QueueStatsProps) {
  const totalBots = queueTypes.reduce((acc, type) => acc + type.count, 0);
  
  const formatWaitTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    return `${Math.floor(seconds / 3600)}h`;
  };

  const getTrendIcon = () => {
    switch (currentTrend) {
      case 'increasing':
        return <TrendingUp className="h-4 w-4 text-red-500" />;
      case 'decreasing':
        return <TrendingDown className="h-4 w-4 text-green-500" />;
      default:
        return <Activity className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getTrendText = () => {
    switch (currentTrend) {
      case 'increasing':
        return 'Queue Growing';
      case 'decreasing':
        return 'Queue Shrinking';
      default:
        return 'Queue Stable';
    }
  };

  // Prepare pie chart data
  const pieData = queueTypes.map((type, index) => ({
    name: type.type,
    value: type.count,
    color: type.color || COLORS[index % COLORS.length]
  }));

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total in Queue</p>
                <p className="text-2xl font-bold">{totalBots}</p>
                <div className="flex items-center gap-1 mt-1">
                  {getTrendIcon()}
                  <span className="text-xs text-muted-foreground">{getTrendText()}</span>
                </div>
              </div>
              <Users className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Matches/Hour</p>
                <p className="text-2xl font-bold">{matchesPerHour}</p>
                <p className="text-xs text-muted-foreground mt-1">Processing rate</p>
              </div>
              <BarChart3 className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Recent Matches</p>
                <p className="text-2xl font-bold">{recentMatches}</p>
                <p className="text-xs text-muted-foreground mt-1">Last 24 hours</p>
              </div>
              <Activity className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Peak Queue</p>
                <p className="text-2xl font-bold">{peakQueueSize}</p>
                <p className="text-xs text-muted-foreground mt-1">Today's max</p>
              </div>
              <TrendingUp className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Queue Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Queue Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {queueTypes.length > 0 ? (
              <div className="space-y-4">
                {queueTypes.map((type, index) => (
                  <div key={type.type} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: type.color || COLORS[index % COLORS.length] }}
                        />
                        <span className="font-medium">{type.type}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{type.count} bots</Badge>
                        <span className="text-sm text-muted-foreground">
                          ~{formatWaitTime(type.estimatedWaitTime)}
                        </span>
                      </div>
                    </div>
                    <Progress 
                      value={(type.count / totalBots) * 100} 
                      className="h-2"
                      style={{ 
                        '--progress-background': type.color || COLORS[index % COLORS.length] 
                      } as any}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Clock className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                <p>No queue data available</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Queue Type Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: number) => `${value} bots`}
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center">
                <p className="text-muted-foreground">No data available</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Historical Trends */}
      {historicalData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Queue Size Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={historicalData}>
                <defs>
                  <linearGradient id="colorQueue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorWait" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="time" 
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                />
                <YAxis 
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '6px'
                  }}
                  formatter={(value: number, name: string) => {
                    if (name === 'averageWait') {
                      return [`${formatWaitTime(value)}`, 'Avg Wait'];
                    }
                    return [value, 'Queue Size'];
                  }}
                />
                <Area 
                  type="monotone" 
                  dataKey="queueSize" 
                  stroke="#8b5cf6" 
                  fillOpacity={1} 
                  fill="url(#colorQueue)" 
                />
                <Area 
                  type="monotone" 
                  dataKey="averageWait" 
                  stroke="#3b82f6" 
                  fillOpacity={1} 
                  fill="url(#colorWait)" 
                  yAxisId="right"
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}