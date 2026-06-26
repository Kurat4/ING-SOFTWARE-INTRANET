import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CheckCircle, Clock, XCircle, FileCheck, Calendar } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { AttendancePieChart } from './AttendancePieChart';

interface AttendanceRecord {
  id: string;
  date: string;
  status: 'present' | 'late' | 'absent' | 'justified';
  notes: string | null;
}

interface StudentCourseAttendanceProps {
  courseId: string;
}

export function StudentCourseAttendance({ courseId }: StudentCourseAttendanceProps) {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAttendance();
  }, [courseId]);

  const fetchAttendance = async () => {
    try {
      setLoading(true);
      
      // Obtener el profile_id del usuario actual
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuario no autenticado');

      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!profile) throw new Error('Perfil no encontrado');

      // Obtener registros de asistencia del módulo específico
      const { data: attendanceData, error } = await supabase
        .from('attendance')
        .select('id, date, status, notes')
        .eq('modulo_id', courseId)
        .eq('student_id', profile.id)
        .order('date', { ascending: false });

      if (error) throw error;

      const typedRecords: AttendanceRecord[] = (attendanceData || []).map(r => ({
        id: r.id,
        date: r.date,
        status: r.status as AttendanceRecord['status'],
        notes: r.notes,
      }));

      setRecords(typedRecords);

      // Calcular estadísticas
      const total = attendanceData?.length || 0;
      const present = attendanceData?.filter(r => r.status === 'present').length || 0;
      const late = attendanceData?.filter(r => r.status === 'late').length || 0;
      const absent = attendanceData?.filter(r => r.status === 'absent').length || 0;
      const justified = attendanceData?.filter(r => r.status === 'justified').length || 0;
      const attendance_rate = total > 0 ? ((present + late) / total) * 100 : 0;

      setStats({
        total,
        present,
        late,
        absent,
        justified,
        attendance_rate,
      });
    } catch (error) {
      console.error('Error fetching attendance:', error);
      toast.error('Error al cargar tu asistencia');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: AttendanceRecord['status']) => {
    const statusConfig = {
      present: { label: 'Presente', variant: 'default' as const, icon: CheckCircle, color: 'text-green-600' },
      late: { label: 'Tarde', variant: 'secondary' as const, icon: Clock, color: 'text-yellow-600' },
      absent: { label: 'Ausente', variant: 'destructive' as const, icon: XCircle, color: 'text-red-600' },
      justified: { label: 'Justificado', variant: 'outline' as const, icon: FileCheck, color: 'text-blue-600' },
    };

    const config = statusConfig[status];
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="gap-1">
        <Icon className={`h-3 w-3 ${config.color}`} />
        {config.label}
      </Badge>
    );
  };

  if (loading) {
    return <div className="text-center py-8">Cargando tu asistencia...</div>;
  }

  return (
    <div className="space-y-6">
      {stats && <AttendancePieChart stats={stats} courseId={courseId} />}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Mi Historial de Asistencia en este Curso
          </CardTitle>
          <CardDescription>
            Registros de tu asistencia en este curso
          </CardDescription>
        </CardHeader>
        <CardContent>
          {records.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No tienes registros de asistencia en este curso aún
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Notas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell className="font-medium">
                      {format(new Date(record.date), 'PPP', { locale: es })}
                    </TableCell>
                    <TableCell>{getStatusBadge(record.status)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {record.notes || '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
