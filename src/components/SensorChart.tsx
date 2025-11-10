import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface SensorChartProps {
  title: string;
  data: Array<{ time: number; x: number; y: number; z: number; w?: number }>;
  unit: string;
  color1?: string;
  color2?: string;
  color3?: string;
  showW?: boolean;
}

export const SensorChart = ({ 
  title, 
  data, 
  unit,
  color1 = "hsl(var(--chart-1))",
  color2 = "hsl(var(--chart-2))",
  color3 = "hsl(var(--chart-3))",
  showW = false
}: SensorChartProps) => {
  return (
    <div className="bg-card rounded-lg border border-border p-4 h-full flex flex-col">
      <h3 className="text-sm font-semibold text-foreground mb-3">{title}</h3>
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis 
              dataKey="time" 
              stroke="hsl(var(--muted-foreground))"
              tick={{ fontSize: 10 }}
            />
            <YAxis 
              stroke="hsl(var(--muted-foreground))"
              tick={{ fontSize: 10 }}
              label={{ value: unit, angle: -90, position: 'insideLeft', style: { fontSize: 10 } }}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '0.5rem',
                fontSize: '12px'
              }}
            />
            <Legend wrapperStyle={{ fontSize: '11px' }} />
            <Line 
              type="monotone" 
              dataKey="x" 
              stroke={color1}
              strokeWidth={2}
              dot={false}
              name="X"
            />
            <Line 
              type="monotone" 
              dataKey="y" 
              stroke={color2}
              strokeWidth={2}
              dot={false}
              name="Y"
            />
            <Line 
              type="monotone" 
              dataKey="z" 
              stroke={color3}
              strokeWidth={2}
              dot={false}
              name="Z"
            />
            {showW && (
              <Line 
                type="monotone" 
                dataKey="w" 
                stroke="hsl(var(--chart-7))"
                strokeWidth={2}
                dot={false}
                name="W"
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
