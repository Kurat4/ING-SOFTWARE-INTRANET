import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CheckCircle, Clock, XCircle, FileCheck, Calendar } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useAuth } from '@/hooks/useAuth';
import { AttendanceStats } from '../course/AttendanceStats';
import { AttendancePieChart } from '../course/AttendancePieChart';

interface AttendanceRecord {
  id: string;
  date: string;
  status: 'present' | 'late' | 'absent' | 'justified';
  notes: string | null;
  course: {
    id: string;
    name: string;
    code: string;
  };
}

export function StudentAttendance() {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { profile } = useAuth();

  useEffect(() => {
    fetchAttendance();
  }, []);

  const fetchAttendance = async () => {
    try {
      setLoading(true);

      if (!profile?.id) {
        throw new Error('No se pudo obtener el perfil del usuario');
      }

      console.log('Fetching attendance for student ID:', profile.id);

      // Obtener todos los registros de asistencia del estudiante actual
      const { data: attendanceData, error: attendanceError } = await supabase
        .from('attendance')
        .select(`
          id,
          date,
          status,
          notes,
          student_id,
          modulo_id,
          modulo:modulos(
            id,
            name,
            code
          )
        `)
        .eq('student_id', profile.id)
        .order('date', { ascending: false });

      console.log('Attendance query result:', { 
        studentId: profile.id,
        recordsFound: attendanceData?.length || 0,
        data: attendanceData, 
        error: attendanceError 
      });

      if (attendanceError) {
        console.error('Supabase error:', attendanceError);
        throw attendanceError;
      }

      // Transformar los datos para que coincidan con la interfaz esperada
      const transformedRecords = (attendanceData || []).map(record => ({
        id: record.id,
        date: record.date,
        status: record.status,
        notes: record.notes,
        course: {
          id: record.modulo?.id || '',
          name: record.modulo?.name || 'Curso no disponible',
          code: record.modulo?.code || '',
        }
      }));

      setRecords(transformedRecords);

      // Calcular estadísticas
      if (transformedRecords.length > 0) {
        const total = transformedRecords.length;
        const present = transformedRecords.filter(r => r.status === 'present').length;
        const late = transformedRecords.filter(r => r.status === 'late').length;
        const absent = transformedRecords.filter(r => r.status === 'absent').length;
        const justified = transformedRecords.filter(r => r.status === 'justified').length;
        const attendance_rate = ((present + late) / total * 100).toFixed(1);

        setStats({
          total,
          present,
          late,
          absent,
          justified,
          attendance_rate: parseFloat(attendance_rate),
        });
      } else {
        setStats(null);
      }
    } catch (error: any) {
      console.error('Error fetching attendance:', error);
      toast.error(error.message || 'Error al cargar tu asistencia');
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
      {stats && (
        <>
          <AttendanceStats stats={stats} />
          <AttendancePieChart stats={stats} />
        </>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Mi Historial de Asistencia
          </CardTitle>
          <CardDescription>
            Registros de tu asistencia en todos los cursos
          </CardDescription>
        </CardHeader>
        <CardContent>
          {records.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No tienes registros de asistencia aún
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Curso</TableHead>
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
                    <TableCell>
                      <div>
                        <div className="font-medium">{record.course.name}</div>
                        <div className="text-xs text-muted-foreground">{record.course.code}</div>
                      </div>
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