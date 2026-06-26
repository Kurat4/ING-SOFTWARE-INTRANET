import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, Clock, XCircle, FileCheck } from 'lucide-react';

interface AttendanceStatsProps {
  stats: {
    total: number;
    present: number;
    late: number;
    absent: number;
    justified: number;
    attendance_rate: string;
  };
}

export function AttendanceStats({ stats }: AttendanceStatsProps) {
  const statsConfig = [
    {
      label: 'Presente',
      value: stats.present,
      icon: CheckCircle,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
    },
    {
      label: 'Tarde',
      value: stats.late,
      icon: Clock,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-100',
    },
    {
      label: 'Ausente',
      value: stats.absent,
      icon: XCircle,
      color: 'text-red-600',
      bgColor: 'bg-red-100',
    },
    {
      label: 'Justificado',
      value: stats.justified,
      icon: FileCheck,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Porcentaje de Asistencia</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.attendance_rate}%</div>
          <Progress value={parseFloat(stats.attendance_rate)} className="mt-2" />
          <p className="text-xs text-muted-foreground mt-2">
            {stats.total} registros totales
          </p>
        </CardContent>
      </Card>

      {statsConfig.map((stat) => {
        const Icon = stat.icon;
        const percentage = stats.total > 0 ? ((stat.value / stats.total) * 100).toFixed(1) : '0';
        
        return (
          <Card key={stat.label}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Icon className={`h-4 w-4 ${stat.color}`} />
                {stat.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {percentage}% del total
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}