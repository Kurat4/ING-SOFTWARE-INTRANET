import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { CheckCircle, Clock, XCircle, FileCheck, Calendar, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { AttendanceStats } from './AttendanceStats';

interface AttendanceRecord {
  id: string;
  date: string;
  status: 'present' | 'late' | 'absent' | 'justified';
  notes: string | null;
  student: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  } | null;
}

interface AttendanceRecordsProps {
  courseId: string;
}

export function AttendanceRecords({ courseId }: AttendanceRecordsProps) {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [filteredRecords, setFilteredRecords] = useState<AttendanceRecord[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  useEffect(() => {
    fetchAttendance();
  }, [courseId]);

  useEffect(() => {
    applyDateFilter();
  }, [records, startDate, endDate]);

  const applyDateFilter = () => {
    let filtered = [...records];

    if (startDate) {
      filtered = filtered.filter(record => new Date(record.date) >= new Date(startDate));
    }

    if (endDate) {
      filtered = filtered.filter(record => new Date(record.date) <= new Date(endDate));
    }

    setFilteredRecords(filtered);

    // Recalcular estadísticas con los datos filtrados
    if (filtered.length > 0) {
      const total = filtered.length;
      const present = filtered.filter(r => r.status === 'present').length;
      const late = filtered.filter(r => r.status === 'late').length;
      const absent = filtered.filter(r => r.status === 'absent').length;
      const justified = filtered.filter(r => r.status === 'justified').length;
      const attendance_rate = ((present + late) / total * 100).toFixed(1);

      setStats({
        total,
        present,
        late,
        absent,
        justified,
        attendance_rate,
      });
    } else if (records.length > 0) {
      // Si no hay registros filtrados pero sí hay registros sin filtrar, mostrar estadísticas en 0
      setStats({
        total: 0,
        present: 0,
        late: 0,
        absent: 0,
        justified: 0,
        attendance_rate: '0.0',
      });
    } else {
      setStats(null);
    }
  };

  const clearFilters = () => {
    setStartDate('');
    setEndDate('');
  };

  const fetchAttendance = async () => {
    try {
      setLoading(true);

      // Obtener todos los registros de asistencia para este módulo
      const { data: attendanceData, error: attendanceError } = await supabase
        .from('attendance')
        .select(`
          id,
          date,
          status,
          notes,
          student:profiles!attendance_student_id_fkey(
            id,
            first_name,
            last_name,
            email
          )
        `)
        .eq('modulo_id', courseId)
        .order('date', { ascending: false });

      if (attendanceError) throw attendanceError;

      setRecords(attendanceData || []);
      setFilteredRecords(attendanceData || []);

      // Calcular estadísticas
      if (attendanceData && attendanceData.length > 0) {
        const total = attendanceData.length;
        const present = attendanceData.filter(r => r.status === 'present').length;
        const late = attendanceData.filter(r => r.status === 'late').length;
        const absent = attendanceData.filter(r => r.status === 'absent').length;
        const justified = attendanceData.filter(r => r.status === 'justified').length;
        const attendance_rate = ((present + late) / total * 100).toFixed(1);

        setStats({
          total,
          present,
          late,
          absent,
          justified,
          attendance_rate,
        });
      } else {
        setStats(null);
      }
    } catch (error: any) {
      console.error('Error fetching attendance:', error);
      toast.error(error.message || 'Error al cargar la asistencia');
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
    return <div className="text-center py-8">Cargando registros de asistencia...</div>;
  }

  return (
    <div className="space-y-6">
      {stats && <AttendanceStats stats={stats} />}

      <Card>
        <CardHeader>
          <CardTitle>Historial de Asistencia</CardTitle>
          <CardDescription>
            Registros de asistencia de todos los estudiantes
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Filtro de Fechas */}
          <div className="mb-6 p-4 border rounded-lg bg-muted/30">
            <div className="flex items-center gap-2 mb-3">
              <Calendar className="h-5 w-5 text-primary" />
              <h3 className="text-sm font-semibold">Filtrar por Fecha</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start-date">Fecha Inicio</Label>
                <Input
                  id="start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-background"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end-date">Fecha Fin</Label>
                <Input
                  id="end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-background"
                />
              </div>
              <div className="flex items-end">
                <Button
                  variant="outline"
                  onClick={clearFilters}
                  disabled={!startDate && !endDate}
                  className="w-full"
                >
                  <X className="h-4 w-4 mr-2" />
                  Limpiar Filtros
                </Button>
              </div>
            </div>
            {(startDate || endDate) && (
              <p className="text-xs text-muted-foreground mt-2">
                Mostrando {filteredRecords.length} de {records.length} registros
              </p>
            )}
          </div>

          {records.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No hay registros de asistencia aún
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No se encontraron registros en el rango de fechas seleccionado
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Estudiante</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Notas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRecords.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell className="font-medium">
                      {format(new Date(record.date), 'PPP', { locale: es })}
                    </TableCell>
                    <TableCell>
                      {record.student 
                        ? `${record.student.first_name} ${record.student.last_name}` 
                        : 'Estudiante no disponible'}
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