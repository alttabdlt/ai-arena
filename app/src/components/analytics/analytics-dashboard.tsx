import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import * as React from 'react';
import * as Recharts from 'recharts';
import { 
  TrendingUp, 
  Target, 
  Zap, 
  Trophy, 
  Users, 
  DollarSign,
  Calendar,
  Activity
} from 'lucide-react';

const performanceData = [
  { date: '2024-01', wins: 65, losses: 35, profit: 12500 },
  { date: '2024-02', wins: 72, losses: 28, profit: 18700 },
  { date: '2024-03', wins: 68, losses: 32, profit: 15200 },
  { date: '2024-04', wins: 75, losses: 25, profit: 22100 },
  { date: '2024-05', wins: 78, losses: 22, profit: 28900 },
  { date: '2024-06', wins: 82, losses: 18, profit: 35400 }
];

const botTypeData = [
  { name: 'Aggressive', value: 35, color: '#ff6b6b' },
  { name: 'Conservative', value: 25, color: '#4ecdc4' },
  { name: 'Balanced', value: 40, color: '#45b7d1' }
];

const dailyActivity = [
  { hour: '00', games: 12 },
  { hour: '04', games: 8 },
  { hour: '08', games: 24 },
  { hour: '12', games: 45 },
  { hour: '16', games: 38 },
  { hour: '20', games: 52 },
  { hour: '24', games: 28 }
];

export function AnalyticsDashboard() {
  const totalGames = 1247;
  const winRate = 78.2;
  const totalProfit = 142800;
  const activeBots = 12;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">Analytics Dashboard</h1>
        <p className="text-muted-foreground">Track your poker bot performance and insights</p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Games</CardTitle>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalGames.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              <TrendingUp className="inline h-3 w-3 mr-1" />
              +12% from last month
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Win Rate</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{winRate}%</div>
            <Progress value={winRate} className="mt-2" />
            <p className="text-xs text-muted-foreground mt-1">
              +5.2% improvement
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Profit</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalProfit.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              <TrendingUp className="inline h-3 w-3 mr-1" />
              +28% this quarter
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Bots</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeBots}</div>
            <div className="flex space-x-1 mt-2">
              <Badge variant="outline" className="text-xs">8 Running</Badge>
              <Badge variant="secondary" className="text-xs">4 Training</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Performance Trend */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Activity className="h-5 w-5" />
              <span>Performance Trend</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Recharts.ResponsiveContainer width="100%" height={300}>
              <Recharts.AreaChart data={performanceData}>
                <Recharts.CartesianGrid strokeDasharray="3 3" />
                <Recharts.XAxis dataKey="date" />
                <Recharts.YAxis />
                <Recharts.Tooltip 
                  formatter={(value, name) => [
                    name === 'profit' ? `$${value}` : `${value}%`,
                    name === 'profit' ? 'Profit' : 'Win Rate'
                  ]}
                />
                <Recharts.Area 
                  type="monotone" 
                  dataKey="wins" 
                  stackId="1" 
                  stroke="hsl(var(--primary))" 
                  fill="hsl(var(--primary) / 0.6)" 
                />
              </Recharts.AreaChart>
            </Recharts.ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Bot Strategy Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Users className="h-5 w-5" />
              <span>Bot Strategy Distribution</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Recharts.ResponsiveContainer width="100%" height={300}>
              <Recharts.PieChart>
                <Recharts.Pie
                  data={botTypeData}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}%`}
                >
                  {botTypeData.map((entry, index) => (
                    <Recharts.Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Recharts.Pie>
                <Recharts.Tooltip />
              </Recharts.PieChart>
            </Recharts.ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Profit Trend */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <DollarSign className="h-5 w-5" />
              <span>Monthly Profit</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Recharts.ResponsiveContainer width="100%" height={300}>
              <Recharts.LineChart data={performanceData}>
                <Recharts.CartesianGrid strokeDasharray="3 3" />
                <Recharts.XAxis dataKey="date" />
                <Recharts.YAxis />
                <Recharts.Tooltip formatter={(value) => [`$${value}`, 'Profit']} />
                <Recharts.Line 
                  type="monotone" 
                  dataKey="profit" 
                  stroke="hsl(var(--success))" 
                  strokeWidth={3}
                  dot={{ fill: 'hsl(var(--success))', strokeWidth: 2, r: 4 }}
                />
              </Recharts.LineChart>
            </Recharts.ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Daily Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Calendar className="h-5 w-5" />
              <span>Daily Activity Pattern</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Recharts.ResponsiveContainer width="100%" height={300}>
              <Recharts.BarChart data={dailyActivity}>
                <Recharts.CartesianGrid strokeDasharray="3 3" />
                <Recharts.XAxis dataKey="hour" />
                <Recharts.YAxis />
                <Recharts.Tooltip formatter={(value) => [`${value}`, 'Games Played']} />
                <Recharts.Bar 
                  dataKey="games" 
                  fill="hsl(var(--chart-1))" 
                  radius={[4, 4, 0, 0]}
                />
              </Recharts.BarChart>
            </Recharts.ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}