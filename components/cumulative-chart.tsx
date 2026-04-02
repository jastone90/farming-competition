"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceArea,
  Label,
} from "recharts";

interface CumulativeChartProps {
  data: {
    date: string;
    [userName: string]: string | number | null;
  }[];
  users: { name: string; color: string }[];
  decStartIndex: number;
}

export function CumulativeChart({
  data,
  users,
  decStartIndex,
}: CumulativeChartProps) {
  const decStartDate = decStartIndex >= 0 ? data[decStartIndex]?.date : undefined;
  const lastDate = data[data.length - 1]?.date;

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--border)"
            opacity={0.5}
          />
          {/* December rest zone */}
          {decStartDate && lastDate && (
            <ReferenceArea
              x1={decStartDate}
              x2={lastDate}
              fill="var(--muted-foreground)"
              fillOpacity={0.1}
              stroke="var(--muted-foreground)"
              strokeOpacity={0.2}
              strokeDasharray="4 2"
            >
              <Label
                value="Rest Month"
                position="insideTop"
                style={{
                  fontSize: 11,
                  fill: "var(--muted-foreground)",
                  fontWeight: 600,
                  fontStyle: "italic",
                }}
                offset={10}
              />
            </ReferenceArea>
          )}
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11 }}
            stroke="var(--muted-foreground)"
            tickFormatter={(val: string, index: number) => {
              if (index === 0) return val.split(" ")[0];
              const prev = data[index - 1]?.date as string;
              if (prev && val.split(" ")[0] !== prev.split(" ")[0]) {
                return val.split(" ")[0];
              }
              return "";
            }}
            interval={0}
          />
          <YAxis
            tick={{ fontSize: 11 }}
            stroke="var(--muted-foreground)"
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: "8px",
              fontSize: "12px",
            }}
            labelFormatter={(val) => String(val)}
          />
          <Legend />
          {users.map((user) => (
            <Line
              key={user.name}
              type="monotone"
              dataKey={user.name}
              stroke={user.color}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
              connectNulls={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
