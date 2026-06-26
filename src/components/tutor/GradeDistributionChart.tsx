import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

interface GradeDistributionChartProps {
  data: {
    ad: number;
    a: number;
    b: number;
    c: number;
  };
}

const COLORS = {
  AD: 'hsl(var(--chart-1))', // Verde
  A: 'hsl(var(--chart-2))',  // Azul
  B: 'hsl(var(--chart-3))',  // Amarillo
  C: 'hsl(var(--chart-5))'   // Rojo
};

export function GradeDistributionChart({ data }: GradeDistributionChartProps) {
  const total = data.ad + data.a + data.b + data.c;
  
  const chartData = [
    { name: 'AD (Excelente)', value: data.ad, percentage: total > 0 ? (data.ad / total * 100).toFixed(1) : 0 },
    { name: 'A (Muy Bueno)', value: data.a, percentage: total > 0 ? (data.a / total * 100).toFixed(1) : 0 },
    { name: 'B (Bueno)', value: data.b, percentage: total > 0 ? (data.b / total * 100).toFixed(1) : 0 },
    { name: 'C (Aceptable)', value: data.c, percentage: total > 0 ? (data.c / total * 100).toFixed(1) : 0 }
  ].filter(item => item.value > 0);

  const CHART_COLORS = [COLORS.AD, COLORS.A, COLORS.B, COLORS.C];

  if (total === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Distribución de Calificaciones</CardTitle>
          <CardDescription>No hay calificaciones registradas aún</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[300px]">
          <p className="text-muted-foreground">Sin datos disponibles</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Distribución de Calificaciones</CardTitle>
        <CardDescription>Total de {total} calificaciones registradas</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ percentage }) => `${percentage}%`}
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={CHART_COLORS[index]} />
              ))}
            </Pie>
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'hsl(var(--background))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px'
              }}
              formatter={(value: number, name: string, props: any) => [
                `${value} (${props.payload.percentage}%)`,
                name
              ]}
            />
            <Legend 
              verticalAlign="bottom" 
              height={36}
              formatter={(value, entry: any) => `${value}: ${entry.payload.value}`}
            />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
