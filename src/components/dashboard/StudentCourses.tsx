import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { BookOpen, Clock, User, AlertCircle, FileText, ClipboardList, ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface Course {
  id: string;
  name: string;
  code: string;
  schedule?: Array<{
    day: string;
    start_time: string;
    end_time: string;
  }>;
  teacher?: {
    first_name: string;
    last_name: string;
  };
  pending_assignments?: number;
  upcoming_exams?: number;
}

const ITEMS_PER_PAGE = 4;

export function StudentCourses() {
  const { profile } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCourses, setTotalCourses] = useState(0);

  useEffect(() => {
    if (profile?.id) {
      fetchCourses();
    }
  }, [profile, currentPage]);

  const fetchCourses = async () => {
    try {
      setLoading(true);

      // Para profesores, obtener módulos donde es profesor
      if (profile?.role === 'teacher') {
        await fetchTeacherCourses();
        return;
      }

      // Get total count first - usando course_enrollments (cada registro = un módulo)
      const { count: totalCount, error: countError } = await supabase
        .from('course_enrollments')
        .select('*', { count: 'exact', head: true })
        .eq('student_id', profile!.id);

      setTotalCourses(totalCount || 0);

      if (!totalCount || totalCount === 0) {
        setCourses([]);
        setLoading(false);
        return;
      }

      // Get paginated enrolled modules via course_enrollments
      const { data: enrollments, error: enrollError } = await supabase
        .from('course_enrollments')
        .select('modulo_id, enrolled_at')
        .eq('student_id', profile!.id)
        .range((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE - 1)
        .order('enrolled_at', { ascending: false });

      if (enrollError) throw enrollError;

      if (!enrollments || enrollments.length === 0) {
        setCourses([]);
        setLoading(false);
        return;
      }

      // Get modulo IDs
      const moduloIds = enrollments.map(e => e.modulo_id);

      // Fetch module details
      const { data: modulosData, error: modulosError } = await supabase
        .from('modulos')
        .select(`
          id,
          name,
          code,
          schedule,
          teacher_principal_id,
          course:courses (
            id,
            name
          )
        `)
        .in('id', moduloIds);

      if (modulosError) throw modulosError;

      // Fetch teachers separately
      const teacherIds = modulosData?.map(m => m.teacher_principal_id).filter(Boolean) || [];
      const { data: teachers } = await supabase
        .from('profiles')
        .select('id, first_name, last_name')
        .in('id', teacherIds);

      const teachersMap = new Map(teachers?.map(t => [t.id, t]) || []);

      // Single query for submitted assignments
      const { data: submissions } = await supabase
        .from('assignment_submissions')
        .select('assignment_id')
        .eq('student_id', profile!.id);

      const submittedIds = new Set(submissions?.map(s => s.assignment_id) || []);

      // Single query for all pending assignments across all modules
      const { data: allAssignments } = await supabase
        .from('assignments')
        .select('id, modulo_id')
        .in('modulo_id', moduloIds)
        .eq('is_published', true)
        .gt('due_date', new Date().toISOString());

      // Single query for all upcoming exams across all modules
      const { data: allExams } = await supabase
        .from('exams')
        .select('id, modulo_id')
        .in('modulo_id', moduloIds)
        .eq('is_published', true)
        .gt('start_time', new Date().toISOString());

      // Group by modulo_id
      const assignmentsByModulo = new Map<string, number>();
      const examsByModulo = new Map<string, number>();

      allAssignments?.forEach(assignment => {
        if (!submittedIds.has(assignment.id)) {
          const current = assignmentsByModulo.get(assignment.modulo_id) || 0;
          assignmentsByModulo.set(assignment.modulo_id, current + 1);
        }
      });

      allExams?.forEach(exam => {
        const current = examsByModulo.get(exam.modulo_id) || 0;
        examsByModulo.set(exam.modulo_id, current + 1);
      });

      // Map to courses from modulos
      const coursesWithData = modulosData?.map((modulo: any) => {
        // El schedule en modulos es un objeto JSONB: { "lunes": "10:00-12:00" }
        let scheduleArray = [];
        if (modulo.schedule && typeof modulo.schedule === 'object') {
          scheduleArray = Object.entries(modulo.schedule).map(([day, horario]: [string, any]) => {
            let start_time, end_time;
            if (typeof horario === 'string' && horario.includes('-')) {
              [start_time, end_time] = horario.split('-');
            } else if (typeof horario === 'object') {
              start_time = horario.inicio || horario.start_time;
              end_time = horario.fin || horario.end_time;
            }
            return {
              day,
              start_time: start_time || '',
              end_time: end_time || ''
            };
          });
        }
        
        return {
          id: modulo.id,
          name: modulo.name,
          code: modulo.code,
          schedule: scheduleArray,
          teacher: teachersMap.get(modulo.teacher_principal_id),
          pending_assignments: assignmentsByModulo.get(modulo.id) || 0,
          upcoming_exams: examsByModulo.get(modulo.id) || 0,
        };
      }) || [];

      setCourses(coursesWithData as Course[]);
    } catch (error) {
      console.error('Error fetching courses:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTeacherCourses = async () => {
    try {
      if (!profile?.id) return;

      // Obtener módulos donde el profesor es principal o adicional
      const { data: modulosData, error: modulosError, count } = await supabase
        .from('modulos')
        .select('id, name, code, schedule, teacher_principal_id, course:courses(id, name)', { count: 'exact' })
        .or(`teacher_principal_id.eq.${profile.id},aditional_teachers.cs.{${profile.id}}`)
        .order('created_at', { ascending: false })
        .range((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE - 1);

      if (modulosError) throw modulosError;

      setTotalCourses(count || 0);

      if (!modulosData || modulosData.length === 0) {
        setCourses([]);
        setLoading(false);
        return;
      }

      const moduloIds = modulosData.map(m => m.id);

      // Obtener entregas pendientes de revisar (submitted_at no nulo y score nulo)
      const { data: submissions } = await supabase
        .from('assignment_submissions')
        .select('id, assignment:assignments!inner(modulo_id)')
        .in('assignment.modulo_id', moduloIds)
        .not('submitted_at', 'is', null)
        .is('score', null);

      // Agrupar por módulo
      const submissionsByModulo = new Map<string, number>();
      submissions?.forEach((sub: any) => {
        const moduloId = sub.assignment?.modulo_id;
        if (moduloId) {
          const current = submissionsByModulo.get(moduloId) || 0;
          submissionsByModulo.set(moduloId, current + 1);
        }
      });

      // Obtener exámenes próximos
      const { data: allExams } = await supabase
        .from('exams')
        .select('id, modulo_id')
        .in('modulo_id', moduloIds)
        .eq('is_published', true)
        .gt('start_time', new Date().toISOString());

      const examsByModulo = new Map<string, number>();
      allExams?.forEach(exam => {
        const current = examsByModulo.get(exam.modulo_id) || 0;
        examsByModulo.set(exam.modulo_id, current + 1);
      });

      // Mapear a cursos
      const coursesWithData = modulosData.map((modulo: any) => {
        let scheduleArray = [];
        if (modulo.schedule && typeof modulo.schedule === 'object') {
          scheduleArray = Object.entries(modulo.schedule).map(([day, time]) => {
            const timeStr = String(time);
            const [start_time, end_time] = timeStr.includes('-') 
              ? timeStr.split('-').map(t => t.trim())
              : [timeStr, ''];
            return { day, start_time, end_time };
          });
        }

        return {
          id: modulo.id,
          name: modulo.name,
          code: modulo.code,
          schedule: scheduleArray,
          teacher: undefined, // El profesor es el usuario actual
          pending_assignments: submissionsByModulo.get(modulo.id) || 0,
          upcoming_exams: examsByModulo.get(modulo.id) || 0,
        };
      });

      setCourses(coursesWithData as Course[]);
    } catch (error) {
      console.error('Error fetching teacher courses:', error);
    } finally {
      setLoading(false);
    }
  };

  const totalPages = Math.ceil(totalCourses / ITEMS_PER_PAGE);

  // --- AQUÍ ESTÁ LA CORRECCIÓN CLAVE ---
  // Esta función ahora es segura y no crashea si el horario está vacío o mal formado
  const formatSchedule = (course: Course) => {
    // 1. Validaciones básicas de seguridad
    if (!course.schedule || !Array.isArray(course.schedule) || course.schedule.length === 0) {
      return "Horario no definido";
    }

    try {
      const daysMap: { [key: string]: string } = {
        'Lunes': 'Lun', 'Monday': 'Lun',
        'Martes': 'Mar', 'Tuesday': 'Mar',
        'Miércoles': 'Mié', 'Wednesday': 'Mié',
        'Jueves': 'Jue', 'Thursday': 'Jue',
        'Viernes': 'Vie', 'Friday': 'Vie',
        'Sábado': 'Sáb', 'Saturday': 'Sáb',
        'Domingo': 'Dom', 'Sunday': 'Dom'
      };

      const scheduleSummary = course.schedule
        .map((s: any) => {
           // Si el elemento es nulo, lo saltamos
           if (!s) return null;

           // Obtenemos el día de forma segura
           const dayRaw = s.day || '';
           
           // Si es string válido, intentamos mapearlo o cortar las primeras 3 letras
           // Si no es string (ej. undefined), ponemos '?'
           const dayLabel = daysMap[dayRaw] || (typeof dayRaw === 'string' ? dayRaw.substring(0, 3) : '?');
           
           // Obtenemos las horas de forma segura
           const start = s.start_time ? s.start_time.slice(0, 5) : '--:--';
           const end = s.end_time ? s.end_time.slice(0, 5) : '--:--';

           return `${dayLabel} ${start}-${end}`;
        })
        .filter(Boolean) // Eliminamos los nulos que hayan podido salir
        .join(', ');

      return scheduleSummary || "Horario sin detalle";

    } catch (error) {
      console.error("Error al formatear horario:", error);
      return "Error en horario";
    }
  };
  // -------------------------------------

  if (loading) {
    return (
      <Card className="bg-gradient-card dark:bg-gray-800 shadow-card border-0 dark:border dark:border-gray-700">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-foreground dark:text-white flex items-center gap-2">
            <BookOpen className="w-5 h-5" />
            Mis Cursos Activos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (courses.length === 0) {
    return (
      <Card className="bg-gradient-card dark:bg-gray-800 shadow-card border-0 dark:border dark:border-gray-700">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-foreground dark:text-white flex items-center gap-2">
            <BookOpen className="w-5 h-5" />
            {profile?.role === 'teacher' ? 'Mis Módulos Asignados' : 'Mis Cursos Activos'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground dark:text-gray-400">
            <AlertCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>{profile?.role === 'teacher' ? 'No tienes módulos asignados' : 'No estás inscrito en ningún curso'}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-card dark:bg-gray-800 shadow-card border-0 dark:border dark:border-gray-700">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-foreground dark:text-white flex items-center gap-2">
          <BookOpen className="w-5 h-5" />
          {profile?.role === 'teacher' ? 'Mis Módulos Asignados' : 'Mis Cursos Activos'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {courses.map((course) => (
            <div
              key={course.id}
              className="p-4 rounded-lg bg-background/60 dark:bg-gray-700/50 border border-border/50 dark:border-gray-600 hover:shadow-card dark:hover:bg-gray-700 transition-all duration-200"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium text-foreground dark:text-gray-200">{course.name}</h4>
                    <Badge variant="secondary" className="text-xs">
                      {course.code}
                    </Badge>
                  </div>
                  
                  {course.teacher && profile?.role !== 'teacher' && (
                    <div className="flex items-center gap-1 text-sm text-muted-foreground dark:text-gray-400 mb-2">
                      <User className="w-3 h-3" />
                      Prof. {course.teacher.first_name} {course.teacher.last_name}
                    </div>
                  )}

                  <div className="flex items-center gap-1 text-xs text-muted-foreground dark:text-gray-500">
                    <Clock className="w-3 h-3" />
                    {formatSchedule(course)}
                  </div>
                </div>

                <Link to={`/courses/${course.id}`}>
                  <Button size="sm" variant="outline">
                    Ver {profile?.role === 'teacher' ? 'Módulo' : 'Curso'}
                  </Button>
                </Link>
              </div>

              {(course.pending_assignments! > 0 || course.upcoming_exams! > 0) && (
                <div className="flex items-center gap-3 mt-3 pt-3 border-t border-border/30 dark:border-gray-600">
                  {course.pending_assignments! > 0 && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground dark:text-gray-400">
                      <FileText className="w-3 h-3 text-accent dark:text-yellow-400" />
                      <span className="font-medium text-accent dark:text-yellow-400">{course.pending_assignments}</span> 
                      {profile?.role === 'teacher' ? ' entregas por revisar' : ' tareas pendientes'}
                    </div>
                  )}
                  {course.upcoming_exams! > 0 && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground dark:text-gray-400">
                      <ClipboardList className="w-3 h-3 text-accent dark:text-yellow-400" />
                      <span className="font-medium text-accent dark:text-yellow-400">{course.upcoming_exams}</span> exámenes próximos
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
        
        {/* Pagination */}
        {totalCourses > ITEMS_PER_PAGE && (
          <div className="mt-6 pt-4 border-t border-border/30 dark:border-gray-700">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <p className="text-sm text-muted-foreground dark:text-gray-400">
                Mostrando {((currentPage - 1) * ITEMS_PER_PAGE) + 1} - {Math.min(currentPage * ITEMS_PER_PAGE, totalCourses)} de {totalCourses} {profile?.role === 'teacher' ? 'módulos' : 'cursos'}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1 || loading}
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span className="hidden sm:inline ml-1">Anterior</span>
                </Button>
                <span className="text-sm text-muted-foreground px-2">
                  {currentPage} / {totalPages}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages || loading}
                >
                  <span className="hidden sm:inline mr-1">Siguiente</span>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
