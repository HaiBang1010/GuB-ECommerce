'use client';

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { formatPriceCents } from '@/lib/money';

// Light-theme only (no dark mode). One accent for the money/user trends, plus a
// categorical ramp reused for the status + category bars.
const ACCENT = '#2563eb';
export const CATEGORICAL = [
  '#2563eb',
  '#16a34a',
  '#f59e0b',
  '#dc2626',
  '#7c3aed',
  '#0891b2',
  '#db2777',
  '#65a30d',
];

const AXIS = '#64748b';
const GRID = '#e2e8f0';

// "2026-06-15" → "06/15" for a compact x-axis tick.
function shortDay(date: string): string {
  const [, m, d] = date.split('-');
  return m && d ? `${m}/${d}` : date;
}

// Compact money for y-axis ticks: $1.2k / $980.
function compactMoney(cents: number): string {
  const dollars = cents / 100;
  if (Math.abs(dollars) >= 1000) return `$${(dollars / 1000).toFixed(1)}k`;
  return `$${Math.round(dollars)}`;
}

export function RevenueChart({
  data,
}: {
  data: { date: string; revenueCents: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
        <defs>
          <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={ACCENT} stopOpacity={0.3} />
            <stop offset="100%" stopColor={ACCENT} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={shortDay}
          tick={{ fontSize: 12, fill: AXIS }}
          minTickGap={24}
          stroke={GRID}
        />
        <YAxis
          tickFormatter={compactMoney}
          tick={{ fontSize: 12, fill: AXIS }}
          width={56}
          stroke={GRID}
        />
        <Tooltip formatter={(value) => formatPriceCents(Number(value))} />
        <Area
          type="monotone"
          dataKey="revenueCents"
          stroke={ACCENT}
          fill="url(#revFill)"
          strokeWidth={2}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function NewUsersChart({
  data,
}: {
  data: { date: string; count: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={shortDay}
          tick={{ fontSize: 12, fill: AXIS }}
          minTickGap={24}
          stroke={GRID}
        />
        <YAxis
          allowDecimals={false}
          tick={{ fontSize: 12, fill: AXIS }}
          width={32}
          stroke={GRID}
        />
        <Tooltip />
        <Line
          type="monotone"
          dataKey="count"
          stroke="#16a34a"
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

// A horizontal bar chart for a small set of named categories. `money` formats the
// value axis/tooltip as currency; otherwise it's a plain count.
export function NamedBarChart({
  data,
  money = false,
}: {
  data: { name: string; value: number }[];
  money?: boolean;
}) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(200, data.length * 40)}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 16, bottom: 4, left: 8 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} horizontal={false} />
        <XAxis
          type="number"
          tickFormatter={money ? compactMoney : undefined}
          tick={{ fontSize: 12, fill: AXIS }}
          stroke={GRID}
        />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fontSize: 12, fill: AXIS }}
          width={110}
          stroke={GRID}
        />
        <Tooltip
          formatter={(value) =>
            money ? formatPriceCents(Number(value)) : String(value)
          }
        />
        <Bar dataKey="value" radius={[0, 4, 4, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill={CATEGORICAL[i % CATEGORICAL.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
