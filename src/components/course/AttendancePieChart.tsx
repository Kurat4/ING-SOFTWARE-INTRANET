import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { CheckCircle, Clock, XCircle, FileCheck } from 'lucide-react';

interface AttendancePieChartProps {
  stats: {
    total: number;
    present: number;
    late: number;
    absent: number;
    justified: number;
    attendance_rate: number | string;
  };
  courseId?: string;
}

const COLORS = {
  present: '#10b981', // Verde vibrante (mantener)
  late: '#FFD900',   // Amarillo Peri Institute
  absent: '#C9438C',  // Magenta Peri Institute
  justified: '#2B3F5C', // Azul marino Peri Institute
};

const STATUS_CONFIG = {
  present: { label: 'Presente', icon: CheckCircle, color: 'text-green-600' },
  late: { label: 'Tarde', icon: Clock, color: 'text-yellow-600' },
  absent: { label: 'Ausente', icon: XCircle, color: 'text-red-600' },
  justified: { label: 'Justificado', icon: FileCheck, color: 'text-blue-600' },
};

export function AttendancePieChart({ stats }: AttendancePieChartProps) {
  if (!stats || stats.total === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Distribución de Asistencia</CardTitle>
          <CardDescription>No hay datos de asistencia disponibles</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const data = [
    { name: 'Presente', value: stats.present, percentage: ((stats.present / stats.total) * 100).toFixed(1) },
    { name: 'Tarde', value: stats.late, percentage: ((stats.late / stats.total) * 100).toFixed(1) },
    { name: 'Ausente', value: stats.absent, percentage: ((stats.absent / stats.total) * 100).toFixed(1) },
    { name: 'Justificado', value: stats.justified, percentage: ((stats.justified / stats.total) * 100).toFixed(1) },
  ].filter(item => item.value > 0);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background border rounded-lg shadow-lg p-3">
          <p className="font-medium">{payload[0].name}</p>
          <p className="text-sm text-muted-foreground">
            {payload[0].value} registros ({payload[0].payload.percentage}%)
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Distribución de Asistencia</CardTitle>
        <CardDescription>
          Total de registros: {stats.total} | Tasa de asistencia: {typeof stats.attendance_rate === 'number' ? stats.attendance_rate.toFixed(1) : stats.attendance_rate}%
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ percentage }) => `${percentage}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {data.map((entry, index) => {
                    const key = entry.name.toLowerCase() as keyof typeof COLORS;
                    return <Cell key={`cell-${index}`} fill={COLORS[key]} />;
                  })}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-4">
            <h3 className="font-semibold">Resumen</h3>
            {Object.entries(STATUS_CONFIG).map(([key, config]) => {
              const statKey = key as keyof typeof stats;
              const value = stats[statKey];
              if (typeof value !== 'number' || value === 0) return null;

              const Icon = config.icon;
              const percentage = ((value / stats.total) * 100).toFixed(1);

              return (
                <div key={key} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-2">
                    <Icon className={`h-5 w-5 ${config.color}`} />
                    <span className="font-medium">{config.label}</span>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">{value}</div>
                    <div className="text-sm text-muted-foreground">{percentage}%</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
