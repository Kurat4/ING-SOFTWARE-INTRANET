import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Download, FileSpreadsheet, Search, ChevronsUpDown, Check, X } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import * as XLSX from 'xlsx';
import { formatDate, formatDateTime } from '@/lib/dateUtils.ts';

interface Modulo {
  id: string;
  name: string;
  code: string;
  course_id: string;
  start_date: string;
  end_date: string;
  course?: {
    name: string;
    code: string;
  };
}

interface AttendanceRecord {
  student_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  status: string;
  notes: string | null;
  recorded_at: string | null;
}

interface AttendanceReport {
  modulo: Modulo;
  date: string;
  statistics: {
    total_students: number;
    present: number;
    absent: number;
    late: number;
    excused: number;
    not_recorded: number;
  };
  all_students: AttendanceRecord[];
  absent_students: AttendanceRecord[];
}

const AdminAttendanceReport = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [modulos, setModulos] = useState<Modulo[]>([]);
  const [selectedModulo, setSelectedModulo] = useState<string>('');
  const [searchModulo, setSearchModulo] = useState<string>('');
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [report, setReport] = useState<AttendanceReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingModulos, setLoadingModulos] = useState(true);
  const [loadingDates, setLoadingDates] = useState(false);

  useEffect(() => {
    fetchModulos();
  }, []);

  const fetchModulos = async () => {
    try {
      const { data, error } = await supabase
        .from('modulos')
        .select(`
          id, 
          name, 
          code,
          course_id,
          start_date,
          end_date,
          course:courses(name, code)
        `)
        .eq('is_active', true)
        .order('start_date', { ascending: false });

      if (error) throw error;
      setModulos(data || []);
    } catch (error) {
      console.error('Error cargando módulos:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los módulos',
        variant: 'destructive',
      });
    } finally {
      setLoadingModulos(false);
    }
  };

  const fetchClassDates = async (moduloId: string) => {
    setLoadingDates(true);
    setAvailableDates([]);
    setSelectedDate('');
    setReport(null);
    
    try {
      // Obtener información del módulo para generar fechas basadas en el horario
      const { data: moduloData, error: moduloError } = await supabase
        .from('modulos')
        .select('start_date, end_date, schedule')
        .eq('id', moduloId)
        .maybeSingle();

      if (moduloError) throw moduloError;

      if (!moduloData) {
        toast({
          title: 'Error',
          description: 'No se encontró información del módulo',
          variant: 'destructive',
        });
        return;
      }

      // Generar todas las fechas de clases basadas en el horario
      const classDates: string[] = [];
      
      if (moduloData.schedule && typeof moduloData.schedule === 'object') {
        const startDate = new Date(moduloData.start_date + 'T00:00:00');
        const endDate = new Date(moduloData.end_date + 'T00:00:00');
        
        // Mapa de días en español a número
        const dayToNumMap: Record<string, number> = {
          'domingo': 0,
          'lunes': 1,
          'martes': 2,
          'miércoles': 3, 'miercoles': 3,
          'jueves': 4,
          'viernes': 5,
          'sábado': 6, 'sabado': 6
        };
        
        // Obtener días de clase del schedule
        const scheduleDays = Object.keys(moduloData.schedule).map(day => 
          dayToNumMap[day.toLowerCase()] ?? -1
        ).filter(d => d !== -1);
        
        // Generar todas las fechas desde start_date hasta end_date que coincidan con los días del horario
        const current = new Date(startDate);
        while (current <= endDate) {
          if (scheduleDays.includes(current.getDay())) {
            classDates.push(format(current, 'yyyy-MM-dd'));
          }
          current.setDate(current.getDate() + 1);
        }
      } else {
        // Si no hay horario, usar solo fechas con asistencia registrada (fallback)
        const { data: attendanceData, error: attendanceError } = await supabase
          .from('attendance')
          .select('date')
          .eq('modulo_id', moduloId)
          .order('date', { ascending: false });

        if (attendanceError) throw attendanceError;
        
        const uniqueDates = [...new Set(attendanceData?.map(item => item.date) || [])];
        classDates.push(...uniqueDates);
      }

      // Ordenar fechas de más reciente a más antigua
      classDates.sort((a, b) => b.localeCompare(a));
      
      setAvailableDates(classDates);

      if (classDates.length === 0) {
        toast({
          title: 'Sin clases disponibles',
          description: 'Este módulo no tiene clases programadas',
          variant: 'default',
        });
      }
    } catch (error) {
      console.error('Error cargando fechas:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron cargar las fechas de clase',
        variant: 'destructive',
      });
    } finally {
      setLoadingDates(false);
    }
  };

  const handleModuloChange = (moduloId: string) => {
    setSelectedModulo(moduloId);
    if (moduloId) {
      fetchClassDates(moduloId);
    } else {
      setAvailableDates([]);
      setSelectedDate('');
      setReport(null);
    }
  };

  const generateReport = async () => {
    if (!selectedModulo || !selectedDate) {
      toast({
        title: 'Campos requeridos',
        description: 'Por favor selecciona un módulo y una fecha de clase',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      // Obtener información del módulo
      const { data: moduloData, error: moduloError } = await supabase
        .from('modulos')
        .select(`
          id,
          name,
          code,
          course_id,
          start_date,
          end_date,
          course:courses(name, code)
        `)
        .eq('id', selectedModulo)
        .single();

      if (moduloError) throw moduloError;

      // Obtener todos los estudiantes matriculados en este módulo
      const { data: enrolledStudents, error: enrollmentError } = await supabase
        .from('course_enrollments')
        .select(`
          student_id,
          student:profiles!course_enrollments_student_id_fkey1(
            id,
            first_name,
            last_name,
            email,
            phone
          )
        `)
        .eq('modulo_id', selectedModulo);

      if (enrollmentError) throw enrollmentError;

      // Obtener registros de asistencia para esta fecha
      const { data: attendanceData, error: attendanceError } = await supabase
        .from('attendance')
        .select('*')
        .eq('modulo_id', selectedModulo)
        .eq('date', selectedDate);

      if (attendanceError) throw attendanceError;

      // Construir reporte
      const allStudents: AttendanceRecord[] = enrolledStudents?.map((enrollment: any) => {
        const attendance = attendanceData?.find(a => a.student_id === enrollment.student_id);
        return {
          student_id: enrollment.student?.id || '',
          first_name: enrollment.student?.first_name || '',
          last_name: enrollment.student?.last_name || '',
          email: enrollment.student?.email || '',
          phone: enrollment.student?.phone || null,
          status: attendance?.status || 'not_recorded',
          notes: attendance?.notes || null,
          recorded_at: attendance?.created_at || null,
        };
      }) || [];

      const statistics = {
        total_students: allStudents.length,
        present: allStudents.filter(s => s.status === 'present').length,
        absent: allStudents.filter(s => s.status === 'absent').length,
        late: allStudents.filter(s => s.status === 'late').length,
        excused: allStudents.filter(s => s.status === 'excused').length,
        not_recorded: allStudents.filter(s => s.status === 'not_recorded').length,
      };

      const absentStudents = allStudents.filter(s => s.status === 'absent');

      setReport({
        modulo: moduloData,
        date: selectedDate,
        statistics,
        all_students: allStudents,
        absent_students: absentStudents,
      });

      toast({
        title: 'Reporte generado',
        description: 'El reporte de asistencia se generó correctamente',
      });
    } catch (error: any) {
      console.error('Error generando reporte:', error);
      toast({
        title: 'Error',
        description: error.message || 'No se pudo generar el reporte',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const exportToExcel = () => {
    if (!report) return;

    // Preparar datos para Excel
    const excelData = report.all_students.map(student => ({
      'Nombre': student.first_name,
      'Apellido': student.last_name,
      'Email': student.email,
      'Teléfono': student.phone || 'No registrado',
      'Estado': getStatusLabel(student.status),
      'Notas': student.notes || '',
      'Registrado': student.recorded_at ? formatDateTime(student.recorded_at) : 'No registrado'
    }));

    // Crear hoja de estadísticas
    const statsData = [
      ['REPORTE DE ASISTENCIA'],
      [''],
      ['Módulo:', report.modulo.name],
      ['Código:', report.modulo.code],
      ['Edición:', report.modulo.course?.name || '-'],
      ['Fecha:', formatDate(report.date)],
      [''],
      ['ESTADÍSTICAS'],
      ['Total de estudiantes:', report.statistics.total_students],
      ['Presentes:', report.statistics.present],
      ['Ausentes:', report.statistics.absent],
      ['Tardíos:', report.statistics.late],
      ['Excusados:', report.statistics.excused],
      ['Sin registrar:', report.statistics.not_recorded],
      [''],
      ['DETALLE DE ASISTENCIA']
    ];

    // Crear libro de Excel
    const wb = XLSX.utils.book_new();
    
    // Hoja de resumen
    const wsStats = XLSX.utils.aoa_to_sheet(statsData);
    XLSX.utils.book_append_sheet(wb, wsStats, 'Resumen');

    // Hoja de todos los estudiantes
    const wsAll = XLSX.utils.json_to_sheet(excelData);
    XLSX.utils.book_append_sheet(wb, wsAll, 'Todos los Estudiantes');

    // Hoja de estudiantes ausentes
    const absentData = report.absent_students.map(student => ({
      'Nombre': student.first_name,
      'Apellido': student.last_name,
      'Email': student.email,
      'Teléfono': student.phone || 'No registrado',
      'Estado': getStatusLabel(student.status),
      'Notas': student.notes || ''
    }));
    const wsAbsent = XLSX.utils.json_to_sheet(absentData);
    XLSX.utils.book_append_sheet(wb, wsAbsent, 'Estudiantes Ausentes');

    // Generar nombre de archivo
    const fileName = `Asistencia_${report.modulo.code}_${report.date}.xlsx`;

    // Descargar archivo
    XLSX.writeFile(wb, fileName);

    toast({
      title: 'Exportación exitosa',
      description: 'El reporte se ha descargado en formato Excel',
    });
  };

  const getStatusLabel = (status: string): string => {
    const labels: { [key: string]: string } = {
      present: 'Presente',
      absent: 'Ausente',
      late: 'Tardío',
      excused: 'Excusado',
      not_recorded: 'Sin registrar'
    };
    return labels[status] || status;
  };

  const getStatusBadgeVariant = (status: string): "default" | "destructive" | "secondary" | "outline" => {
    switch (status) {
      case 'present':
        return 'default';
      case 'absent':
        return 'destructive';
      case 'late':
        return 'secondary';
      case 'excused':
        return 'outline';
      default:
        return 'outline';
    }
  };

  if (profile?.role !== 'admin') {
    return (
      <DashboardLayout>
        <div className="container mx-auto px-4 py-8">
          <Card>
            <CardHeader>
              <CardTitle>Acceso Denegado</CardTitle>
              <CardDescription>
                No tienes permisos para acceder a esta funcionalidad
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Reporte de Asistencia</h1>
          <p className="mt-2 text-gray-600">
            Genera reportes de asistencia por curso y clase específica, con exportación a Excel
          </p>
        </div>

        {/* Filtros */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Seleccionar Parámetros</CardTitle>
            <CardDescription>
              Selecciona un módulo y una fecha de clase para generar el reporte
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Selector de Módulo con Búsqueda */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Módulo</label>
                <div className="relative">
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar módulo por código o nombre..."
                      value={searchModulo}
                      onChange={(e) => setSearchModulo(e.target.value)}
                      disabled={loadingModulos}
                      className="pl-9 pr-9"
                    />
                    {searchModulo && (
                      <button
                        onClick={() => {
                          setSearchModulo('');
                          setSelectedModulo('');
                          setAvailableDates([]);
                          setSelectedDate('');
                          setReport(null);
                        }}
                        className="absolute right-3 top-3 h-4 w-4 text-muted-foreground hover:text-foreground"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  {searchModulo && (
                    <div className="absolute z-50 w-full mt-1 max-h-60 overflow-auto rounded-md border bg-popover text-popover-foreground shadow-md">
                      {modulos
                        .filter(modulo => {
                          const searchTerm = searchModulo.toLowerCase();
                          return (
                            modulo.name.toLowerCase().includes(searchTerm) ||
                            modulo.code.toLowerCase().includes(searchTerm) ||
                            modulo.course?.name.toLowerCase().includes(searchTerm)
                          );
                        })
                        .slice(0, 20)
                        .map((modulo) => (
                          <div
                            key={modulo.id}
                            className={`relative flex cursor-pointer select-none items-center rounded-sm px-2 py-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground ${
                              selectedModulo === modulo.id ? 'bg-accent' : ''
                            }`}
                            onClick={() => {
                              setSelectedModulo(modulo.id);
                              setSearchModulo(`${modulo.code} - ${modulo.name}`);
                              handleModuloChange(modulo.id);
                            }}
                          >
                            <Check
                              className={`mr-2 h-4 w-4 ${
                                selectedModulo === modulo.id ? 'opacity-100' : 'opacity-0'
                              }`}
                            />
                            <div className="flex-1">
                              <div className="font-medium">{modulo.code} - {modulo.name}</div>
                              {modulo.course?.name && (
                                <div className="text-xs text-muted-foreground">
                                  Edición: {modulo.course.name}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      {modulos.filter(modulo => {
                        const searchTerm = searchModulo.toLowerCase();
                        return (
                          modulo.name.toLowerCase().includes(searchTerm) ||
                          modulo.code.toLowerCase().includes(searchTerm) ||
                          modulo.course?.name.toLowerCase().includes(searchTerm)
                        );
                      }).length === 0 && (
                        <div className="py-6 text-center text-sm text-muted-foreground">
                          No se encontraron módulos
                        </div>
                      )}
                    </div>
                  )}
                </div>
                {selectedModulo && !searchModulo && (
                  <p className="text-xs text-muted-foreground">
                    Módulo seleccionado. Escribe para cambiar.
                  </p>
                )}
              </div>

              {/* Selector de Fecha de Clase */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Fecha de Clase</label>
                <Select 
                  value={selectedDate} 
                  onValueChange={setSelectedDate}
                  disabled={!selectedModulo || loadingDates || availableDates.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={
                      loadingDates 
                        ? "Cargando fechas..." 
                        : availableDates.length === 0 && selectedModulo
                        ? "Sin clases programadas"
                        : "Seleccionar fecha de clase..."
                    } />
                  </SelectTrigger>
                  <SelectContent>
                    {availableDates.map((date) => (
                      <SelectItem key={date} value={date}>
                        {formatDate(date)} - {format(new Date(date + 'T00:00:00'), 'EEEE', { locale: es })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedModulo && availableDates.length === 0 && !loadingDates && (
                  <p className="text-xs text-gray-500">
                    No se encontraron clases programadas para este módulo
                  </p>
                )}
              </div>

              {/* Botón Generar */}
              <div className="space-y-2">
                <label className="text-sm font-medium invisible">Acción</label>
                <Button 
                  onClick={generateReport} 
                  disabled={loading || !selectedModulo || !selectedDate}
                  className="w-full"
                >
                  <Search className="mr-2 h-4 w-4" />
                  {loading ? 'Generando...' : 'Generar Reporte'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Reporte */}
        {report && (
          <>
            {/* Estadísticas */}
            <Card className="mb-6">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>{report.modulo.name}</CardTitle>
                  <CardDescription>
                    {report.modulo.code} - {formatDate(report.date)} ({format(new Date(report.date + 'T00:00:00'), 'EEEE', { locale: es })})
                  </CardDescription>
                </div>
                <Button onClick={exportToExcel} variant="outline">
                  <FileSpreadsheet className="mr-2 h-4 w-4" />
                  Exportar a Excel
                </Button>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <div className="text-2xl font-bold text-gray-900">
                      {report.statistics.total_students}
                    </div>
                    <div className="text-sm text-gray-600">Total</div>
                  </div>
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">
                      {report.statistics.present}
                    </div>
                    <div className="text-sm text-green-600">Presentes</div>
                  </div>
                  <div className="text-center p-4 bg-red-50 rounded-lg">
                    <div className="text-2xl font-bold text-red-600">
                      {report.statistics.absent}
                    </div>
                    <div className="text-sm text-red-600">Ausentes</div>
                  </div>
                  <div className="text-center p-4 bg-yellow-50 rounded-lg">
                    <div className="text-2xl font-bold text-yellow-600">
                      {report.statistics.late}
                    </div>
                    <div className="text-sm text-yellow-600">Tardíos</div>
                  </div>
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">
                      {report.statistics.excused}
                    </div>
                    <div className="text-sm text-blue-600">Excusados</div>
                  </div>
                  <div className="text-center p-4 bg-gray-100 rounded-lg">
                    <div className="text-2xl font-bold text-gray-600">
                      {report.statistics.not_recorded}
                    </div>
                    <div className="text-sm text-gray-600">Sin registrar</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Tabla de estudiantes ausentes */}
            {report.absent_students.length > 0 && (
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle className="text-red-600">
                    Estudiantes Ausentes ({report.absent_students.length})
                  </CardTitle>
                  <CardDescription>
                    Lista de estudiantes que no asistieron a clase
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nombre</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Teléfono</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Notas</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {report.absent_students.map((student) => (
                        <TableRow key={student.student_id}>
                          <TableCell className="font-medium">
                            {student.first_name} {student.last_name}
                          </TableCell>
                          <TableCell>{student.email}</TableCell>
                          <TableCell>{student.phone || 'No registrado'}</TableCell>
                          <TableCell>
                            <Badge variant={getStatusBadgeVariant(student.status)}>
                              {getStatusLabel(student.status)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-gray-600">
                            {student.notes || '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {/* Tabla completa de asistencia */}
            <Card>
              <CardHeader>
                <CardTitle>Registro Completo de Asistencia</CardTitle>
                <CardDescription>
                  Todos los estudiantes matriculados en el curso
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Teléfono</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Notas</TableHead>
                      <TableHead>Fecha de Registro</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.all_students.map((student) => (
                      <TableRow key={student.student_id}>
                        <TableCell className="font-medium">
                          {student.first_name} {student.last_name}
                        </TableCell>
                        <TableCell>{student.email}</TableCell>
                        <TableCell>{student.phone || 'No registrado'}</TableCell>
                        <TableCell>
                          <Badge variant={getStatusBadgeVariant(student.status)}>
                            {getStatusLabel(student.status)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-gray-600">
                          {student.notes || '-'}
                        </TableCell>
                        <TableCell className="text-sm text-gray-600">
                          {student.recorded_at 
                            ? formatDateTime(student.recorded_at)
                            : 'No registrado'
                          }
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </>
        )}

        {!report && !loading && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Download className="h-12 w-12 text-gray-400 mb-4" />
              <p className="text-gray-600 text-center">
                Selecciona un curso y una fecha de clase para generar el reporte de asistencia
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default AdminAttendanceReport;
