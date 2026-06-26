import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface AttendanceBarChartProps {
  data: Array<{
    course: string;
    attendanceRate: number;
  }>;
}

export function AttendanceBarChart({ data }: AttendanceBarChartProps) {
  const getColor = (rate: number) => {
    if (rate >= 90) return 'hsl(var(--chart-1))'; // Verde
    if (rate >= 75) return 'hsl(var(--chart-3))'; // Amarillo
    return 'hsl(var(--chart-5))'; // Rojo
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Asistencia por Curso</CardTitle>
        <CardDescription>Porcentaje de asistencia en cada materia</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis 
              dataKey="course" 
              className="text-xs"
              angle={-45}
              textAnchor="end"
              height={80}
            />
            <YAxis 
              domain={[0, 100]}
              className="text-xs"
              label={{ value: '% Asistencia', angle: -90, position: 'insideLeft' }}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'hsl(var(--background))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px'
              }}
              formatter={(value: number) => [`${value.toFixed(1)}%`, 'Asistencia']}
            />
            <Bar dataKey="attendanceRate" radius={[8, 8, 0, 0]}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={getColor(entry.attendanceRate)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
