"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { ChartContainer, ChartTooltip, ChartTooltipContent } from "./ui/chart";

interface ChartProps {
  data: Record<string, string | number>[];
  dataKey: string;
  xKey?: string;
  height?: number;
  color?: string;
  formatValue?: (value: number) => string;
}

const defaultFormatter = (value: number): string =>
  new Intl.NumberFormat("id-ID", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);

export function Chart({
  data,
  dataKey,
  xKey = "month",
  height = 280,
  color = "hsl(var(--primary))",
  formatValue = defaultFormatter,
}: ChartProps) {
  const config = {
    [dataKey]: { label: dataKey, color },
  };

  return (
    <ChartContainer config={config} className="w-full min-w-0" style={{ height }}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey={xKey} tickLine={false} axisLine={false} tickMargin={8} fontSize={12} />
        <YAxis
          tickLine={false}
          axisLine={false}
          fontSize={12}
          tickFormatter={(value: number) => formatValue(value)}
        />
        <ChartTooltip
          cursor={{ fill: "hsl(var(--muted))", opacity: 0.3 }}
          content={
            <ChartTooltipContent
              formatter={(value) => (
                <span className="tabular-nums">{formatValue(Number(value))}</span>
              )}
            />
          }
        />
        <Bar dataKey={dataKey} fill={`var(--color-${dataKey})`} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ChartContainer>
  );
}
