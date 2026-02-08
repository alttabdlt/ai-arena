import { useMemo, useState } from 'react';
import { AreaChart, Area, ResponsiveContainer, Tooltip, YAxis, XAxis, ReferenceLine } from 'recharts';
import type { PricePoint } from '../../hooks/useDegenState';

type Period = '1h' | '6h' | '24h' | '7d';

interface PriceChartProps {
  data: PricePoint[];
  onPeriodChange?: (period: string) => void;
}

export function PriceChart({ data, onPeriodChange }: PriceChartProps) {
  const [period, setPeriod] = useState<Period>('1h');

  const handlePeriod = (p: Period) => {
    setPeriod(p);
    onPeriodChange?.(p);
  };

  const chartData = useMemo(() => {
    return data.map((d) => ({
      price: d.price,
      volume: d.volume || 0,
      time: new Date(d.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }));
  }, [data]);

  if (chartData.length < 2) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-1">
          {(['1h', '6h', '24h', '7d'] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => handlePeriod(p)}
              className={`text-[10px] font-mono px-2 py-0.5 rounded transition-colors ${
                period === p
                  ? 'bg-slate-700/60 text-slate-200'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {p.toUpperCase()}
            </button>
          ))}
        </div>
        <div className="h-40 flex items-center justify-center text-xs text-slate-500 bg-slate-900/30 rounded-lg border border-slate-800/30">
          <div className="text-center space-y-1">
            <div className="text-slate-400">Collecting price data...</div>
            <div className="text-[10px] text-slate-600">Chart will appear once enough data points are available</div>
          </div>
        </div>
      </div>
    );
  }

  const first = chartData[0].price;
  const last = chartData[chartData.length - 1].price;
  const isUp = last >= first;
  const color = isUp ? '#34d399' : '#f87171';
  const pctChange = first > 0 ? (((last - first) / first) * 100).toFixed(2) : '0.00';
  const absChange = (last - first).toFixed(4);
  const prices = chartData.map((d) => d.price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);

  return (
    <div className="space-y-2">
      {/* Header: period tabs + price info */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          {(['1h', '6h', '24h', '7d'] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => handlePeriod(p)}
              className={`text-[10px] font-mono px-2 py-0.5 rounded transition-colors ${
                period === p
                  ? 'bg-slate-700/60 text-slate-200'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {p.toUpperCase()}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-semibold text-slate-200">${last.toFixed(4)}</span>
          <span className="font-mono text-xs" style={{ color }}>
            {isUp ? '+' : ''}{pctChange}% ({isUp ? '+' : ''}{absChange})
          </span>
        </div>
      </div>

      {/* Chart */}
      <div className="h-40 bg-slate-900/30 rounded-lg border border-slate-800/30 p-1">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
            <defs>
              <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="time"
              tick={{ fontSize: 9, fill: '#64748b' }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              domain={['auto', 'auto']}
              tick={{ fontSize: 9, fill: '#64748b' }}
              tickLine={false}
              axisLine={false}
              width={45}
              tickFormatter={(v: number) => v.toFixed(3)}
            />
            <ReferenceLine y={first} stroke="#475569" strokeDasharray="3 3" strokeWidth={0.5} />
            <Tooltip
              contentStyle={{
                background: '#0f172a',
                border: '1px solid #475569',
                borderRadius: '8px',
                fontSize: '11px',
                padding: '6px 10px',
              }}
              labelStyle={{ color: '#94a3b8', fontSize: '10px' }}
              formatter={(v: number) => [v.toFixed(4), '$ARENA']}
              cursor={{ stroke: '#475569', strokeDasharray: '3 3' }}
            />
            <Area
              type="linear"
              dataKey="price"
              stroke={color}
              strokeWidth={1.5}
              fill="url(#priceGrad)"
              dot={false}
              animationDuration={500}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Min/Max labels */}
      <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono px-1">
        <span>Low: {minPrice.toFixed(4)}</span>
        <span>{chartData.length} data points</span>
        <span>High: {maxPrice.toFixed(4)}</span>
      </div>
    </div>
  );
}
