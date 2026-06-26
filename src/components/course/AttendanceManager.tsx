import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CalendarIcon, Save, CheckCircle, XCircle, Clock, FileCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface Student {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
}

interface AttendanceRecord {
  student_id: string;
  status: 'present' | 'late' | 'absent' | 'justified';
  notes?: string;
}

interface AttendanceManagerProps {
  courseId: string;
}

export function AttendanceManager({ courseId }: AttendanceManagerProps) {
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [attendance, setAttendance] = useState<Record<string, AttendanceRecord>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [courseIdFromModulo, setCourseIdFromModulo] = useState<string | null>(null);
  
  // Estado para el horario procesado
  const [courseSchedule, setCourseSchedule] = useState<Array<{
    day: string;
    start_time: string;
    end_time: string;
  }> | null>(null);
  
  const [isWithinSchedule, setIsWithinSchedule] = useState(false);

  useEffect(() => {
    fetchStudents();
    fetchCourseSchedule();
  }, [courseId]);

  useEffect(() => {
    if (selectedDate) {
      loadExistingAttendance();
    }
  }, [selectedDate, students]);

  useEffect(() => {
    checkSchedule();
    const interval = setInterval(checkSchedule, 60000); // Revisar cada minuto
    return () => clearInterval(interval);
  }, [courseSchedule]);

  // --- 1. FUNCIÓN CORREGIDA PARA OBTENER HORARIO ---
  const fetchCourseSchedule = async () => {
    try {
      // El schedule ahora está en modulos, no en courses
      const { data, error } = await supabase
        .from('modulos')
        .select('schedule, course_id')
        .eq('id', courseId)
        .maybeSingle();

      if (error) throw error;
      
      // Guardar course_id para usarlo en el registro de asistencia
      if (data?.course_id) {
        setCourseIdFromModulo(data.course_id);
      }
      
      // El schedule en modulos es un objeto JSONB: { "lunes": "10:00-12:00", "miércoles": "14:00-16:00" }
      if (data?.schedule && typeof data.schedule === 'object') {
        const processedSchedule = Object.entries(data.schedule).map(([dia, horario]: [string, any]) => {
          // horario puede ser string "10:00-12:00" u objeto { inicio, fin }
          let start_time, end_time;
          
          if (typeof horario === 'string' && horario.includes('-')) {
            [start_time, end_time] = horario.split('-');
          } else if (typeof horario === 'object') {
            start_time = horario.inicio || horario.start_time;
            end_time = horario.fin || horario.end_time;
          }
          
          return {
            day: dia, // "lunes", "martes", etc.
            start_time: start_time || '09:00:00',
            end_time: end_time || '11:00:00'
          };
        });
        
        setCourseSchedule(processedSchedule);
      } else {
        setCourseSchedule(null);
      }
    } catch (error) {
      console.error('Error fetching course schedule:', error);
    }
  };

  const checkSchedule = () => {
    // Si no hay horario cargado, no hacemos nada
    if (!courseSchedule || courseSchedule.length === 0) {
       return;
    }

    const now = new Date();
    // Obtenemos el día actual como NÚMERO (0 = Domingo, 1 = Lunes ... 4 = Jueves)
    const currentDayNum = now.getDay(); 

    // Mapa para convertir el texto de tu BD a número
    const dayToNumMap: Record<string, number> = {
      'domingo': 0,
      'lunes': 1,
      'martes': 2,
      'miércoles': 3, 'miercoles': 3,
      'jueves': 4,
      'viernes': 5,
      'sábado': 6, 'sabado': 6
    };

    // Buscamos el horario comparando NÚMEROS
    const todaySchedule = courseSchedule.find(s => {
      // Limpiamos el texto que viene de la BD (quitar mayúsculas y espacios)
      const dbDayClean = s.day.toLowerCase().trim(); 
      const dbDayNum = dayToNumMap[dbDayClean];
      
      return dbDayNum === currentDayNum;
    });
    
    // --- DEBUG: Mira la consola (F12) si esto falla ---
    console.log("--- REVISIÓN DE HORARIO ---");
    console.log("Día actual (Sistema):", currentDayNum); // Debería ser 4 si es jueves
    console.log("Horario encontrado en BD:", todaySchedule); 

    if (!todaySchedule) {
      console.log("FALLO: No se encontró coincidencia de día.");
      setIsWithinSchedule(false);
      return;
    }

    // --- LÓGICA DE TIEMPO + 30 MINUTOS ---
    const startStr = todaySchedule.start_time?.slice(0, 5) || "00:00";
    const endStr = todaySchedule.end_time?.slice(0, 5) || "23:59";

    const startDate = new Date();
    const [startH, startM] = startStr.split(':');
    startDate.setHours(Number(startH), Number(startM), 0, 0);

    const endDate = new Date();
    const [endH, endM] = endStr.split(':');
    endDate.setHours(Number(endH), Number(endM), 0, 0);

    // Sumar 30 minutos de tolerancia
    endDate.setMinutes(endDate.getMinutes() + 30);

    const isTimeMatch = now >= startDate && now <= endDate;
    
    console.log("Hora actual:", now.toLocaleTimeString());
    console.log("Cierre con tolerancia:", endDate.toLocaleTimeString());
    console.log("¿Está en tiempo?:", isTimeMatch);

    setIsWithinSchedule(isTimeMatch);
  };

  const fetchStudents = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('course_enrollments')
        .select(`
          student_id,
          profiles!fk_enrollments_profiles(
            id,
            first_name,
            last_name,
            email
          )
        `)
        .eq('modulo_id', courseId);

      if (error) throw error;

      const enrolledStudents = (data || [])
        .filter(e => e.profiles)
        .map(e => e.profiles) as Student[];
      
      setStudents(enrolledStudents);
    } catch (error) {
      console.error('Error fetching students:', error);
      toast.error('Error al cargar estudiantes');
    } finally {
      setLoading(false);
    }
  };

  const loadExistingAttendance = async () => {
    if (!students.length) return;

    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      // Usar modulo_id que es el identificador correcto
      const { data, error } = await supabase
        .from('attendance')
        .select('student_id, status, notes')
        .eq('modulo_id', courseId)
        .eq('date', dateStr);

      if (error) throw error;

      const existingAttendance: Record<string, AttendanceRecord> = {};
      data?.forEach(record => {
        existingAttendance[record.student_id] = {
          student_id: record.student_id,
          status: record.status as any,
          notes: record.notes || undefined,
        };
      });

      setAttendance(existingAttendance);
    } catch (error) {
      console.error('Error loading attendance:', error);
    }
  };

  const handleStatusChange = (studentId: string, status: AttendanceRecord['status']) => {
    setAttendance(prev => ({
      ...prev,
      [studentId]: {
        student_id: studentId,
        status,
        notes: prev[studentId]?.notes,
      },
    }));
  };

  const handleSaveAttendance = async () => {
    if (!isWithinSchedule) {
      // BACKDOOR TEMPORAL: Comenta estas 2 líneas si necesitas probar fuera de hora urgentemente
      toast.error('La asistencia solo puede registrarse durante el horario de clase');
      return;
    }

    try {
      setSaving(true);

      // Obtener el profile_id del usuario actual (profesor)
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuario no autenticado');

      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!profile) throw new Error('Perfil no encontrado');

      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const attendanceRecords = Object.values(attendance);

      if (attendanceRecords.length === 0) {
        toast.error('Debe registrar al menos una asistencia');
        return;
      }

      // Preparar registros para upsert con modulo_id
      // NOTA: Se incluye course_id para satisfacer el constraint attendance_source_check
      const recordsToSave = attendanceRecords.map(record => ({
        course_id: courseIdFromModulo, // Requerido por constraint attendance_source_check
        modulo_id: courseId,
        student_id: record.student_id,
        date: dateStr,
        status: record.status,
        notes: record.notes || null,
        recorded_by: profile.id, // ID del profesor que registra
      }));

      // Usar upsert para actualizar o insertar registros
      // El constraint único es modulo_id,student_id,date
      const { error } = await supabase
        .from('attendance')
        .upsert(recordsToSave, {
          onConflict: 'modulo_id,student_id,date',
        });

      if (error) throw error;

      toast.success('Asistencia registrada correctamente');
      // Recargar para mostrar los cambios actualizados
      await loadExistingAttendance();
    } catch (error) {
      console.error('Error saving attendance:', error);
      toast.error('Error al guardar la asistencia');
    } finally {
      setSaving(false);
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
    return <div className="text-center py-8">Cargando estudiantes...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Registro de Asistencia</CardTitle>
            <CardDescription>
              Registre la asistencia de los estudiantes para la fecha seleccionada
            </CardDescription>
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="gap-2">
                <CalendarIcon className="h-4 w-4" />
                {format(selectedDate, 'PPP', { locale: es })}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => date && setSelectedDate(date)}
                locale={es}
              />
            </PopoverContent>
          </Popover>
        </div>
      </CardHeader>
      <CardContent>
        {/* AVISO AMARILLO: Solo se muestra si NO estamos en horario y SI tenemos horario cargado */}
        {!isWithinSchedule && courseSchedule && courseSchedule.length > 0 && (
          <div className="mb-4 p-4 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <div className="flex items-center gap-2 text-yellow-800 dark:text-yellow-200">
              <Clock className="h-5 w-5" />
              <div>
                <p className="font-medium">Fuera del horario de clase</p>
                <p className="text-sm text-yellow-700 dark:text-yellow-300">
                  El registro de asistencia está disponible durante el horario del curso:
                </p>
                <ul className="mt-2 text-sm text-yellow-700 dark:text-yellow-300 space-y-1">
                  {courseSchedule.map((schedule, idx) => {
                    const dayNames: Record<string, string> = {
                      'Monday': 'Lunes',
                      'Tuesday': 'Martes',
                      'Wednesday': 'Miércoles',
                      'Thursday': 'Jueves',
                      'Friday': 'Viernes',
                      'Saturday': 'Sábado',
                      'Sunday': 'Domingo'
                    };
                    return (
                      <li key={idx}>
                        • {dayNames[schedule.day] || schedule.day}: {schedule.start_time?.slice(0,5)} - {schedule.end_time?.slice(0,5)}
                        {/* AGREGAR ESTA LÍNEA PARA QUE SE VEA EL TEXTO: */}
                        <span className="ml-2 font-bold text-yellow-800 dark:text-yellow-200">
                          (+30 min de tolerancia)
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          </div>
        )}
        
        {/* TABLA DE ESTUDIANTES */}
        {students.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No hay estudiantes inscritos en este curso
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Estudiante</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.map((student) => (
                  <TableRow key={student.id}>
                    <TableCell className="font-medium">
                      {student.first_name} {student.last_name}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {student.email}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={attendance[student.id]?.status || ""}
                        onValueChange={(value) => handleStatusChange(student.id, value as any)}
                        // Deshabilitamos el select si está fuera de horario
                        disabled={!isWithinSchedule}
                      >
                        <SelectTrigger className="w-[180px]">
                          <SelectValue placeholder="Seleccionar..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="present">
                            <div className="flex items-center gap-2">
                              <CheckCircle className="h-4 w-4 text-green-600" />
                              Presente
                            </div>
                          </SelectItem>
                          <SelectItem value="late">
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4 text-yellow-600" />
                              Tarde
                            </div>
                          </SelectItem>
                          <SelectItem value="absent">
                            <div className="flex items-center gap-2">
                              <XCircle className="h-4 w-4 text-red-600" />
                              Ausente
                            </div>
                          </SelectItem>
                          <SelectItem value="justified">
                            <div className="flex items-center gap-2">
                              <FileCheck className="h-4 w-4 text-blue-600" />
                              Justificado
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="flex justify-end mt-4">
              <Button 
                onClick={handleSaveAttendance} 
                // El botón solo se activa si estamos en horario
                disabled={saving || !isWithinSchedule} 
                className={`gap-2 ${!isWithinSchedule ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <Save className="h-4 w-4" />
                {saving ? 'Guardando...' : 'Guardar Asistencia'}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
