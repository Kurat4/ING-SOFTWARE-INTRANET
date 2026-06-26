import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { formatDateInUserTimezone } from '@/lib/timezoneUtils';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BookOpen, Users, Clock, Plus, ArrowRight, GraduationCap, Calendar, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Course {
  id: string;
  name: string;
  description: string;
  code: string;
  academic_year: string;
  semester: string;
  is_active: boolean;
  created_at: string;
  teacher: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  };
  classroom?: {
    id: string;
    name: string;
    grade: string;
    education_level: string;
  };
  enrollments?: { count: number }[];
  enrolled_at?: string; // For students
  enrollment_status?: string; // For students
  course_id?: string; // ID de la edición (para agrupar)
  course_name?: string; // Nombre de la edición
  program_name?: string; // Nombre del programa
}

interface EdicionGroup {
  course_id: string;
  course_name: string;
  program_name: string;
  academic_year: string;
  semester: string;
  modulos: Course[];
  total_students: number;
}

const Courses = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [courses, setCourses] = useState<Course[]>([]);
  const [ediciones, setEdiciones] = useState<EdicionGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [courseToDelete, setCourseToDelete] = useState<string | null>(null);
  
  // Mostrar vista agrupada para todos los roles (estudiantes, profesores y admins)
  const showGroupedView = true;

  useEffect(() => {
    fetchCourses();
  }, [profile]);

  const fetchCourses = async () => {
    if (!profile) return;

    try {
      setLoading(true);
      
      // Use Edge Function to get courses based on user role
      const { data, error } = await supabase.functions.invoke('get-student-courses', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (error) {
        console.error('Error calling get-student-courses function:', error);
        toast({
          title: "Error",
          description: "No se pudieron cargar los cursos",
          variant: "destructive",
        });
        return;
      }

      if (!data?.success) {
        console.error('Error in function response:', data?.error);
        toast({
          title: "Error",
          description: data?.error || "Error al obtener los cursos",
          variant: "destructive",
        });
        return;
      }

      console.log(`✅ Cursos cargados para ${data.user_role}:`, data.count);
      const coursesData = data.data || [];
      setCourses(coursesData);
      
      // Agrupar por edición para profesores y admins
      if (showGroupedView && coursesData.length > 0) {
        const grouped = coursesData.reduce((acc: Record<string, EdicionGroup>, modulo: Course) => {
          const courseId = modulo.course_id || 'sin-edicion';
          
          if (!acc[courseId]) {
            acc[courseId] = {
              course_id: courseId,
              course_name: modulo.course_name || 'Sin edición',
              program_name: modulo.program_name || '',
              academic_year: modulo.academic_year,
              semester: modulo.semester,
              modulos: [],
              total_students: 0
            };
          }
          
          acc[courseId].modulos.push(modulo);
          
          return acc;
        }, {});
        
        // Calcular estudiantes únicos por edición usando RPC con SECURITY DEFINER (bypasea RLS)
        const edicionesArray = Object.values(grouped);
        
        // Ordenar módulos dentro de cada edición por código o fecha de inicio
        edicionesArray.forEach(edicion => {
          edicion.modulos.sort((a, b) => {
            // Intentar ordenar por num_modulo si está disponible en el código
            const numA = parseInt((a.code || '').replace(/\D/g, ''), 10);
            const numB = parseInt((b.code || '').replace(/\D/g, ''), 10);
            if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
            // Fallback: ordenar por fecha de inicio
            return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
          });
        });

        // Ordenar ediciones por nombre de programa + nombre de edición
        edicionesArray.sort((a, b) =>
          `${a.program_name} ${a.course_name}`.localeCompare(`${b.program_name} ${b.course_name}`)
        );

        const courseIds = edicionesArray.map(e => e.course_id).filter(id => id !== 'sin-edicion');
        
        if (courseIds.length > 0) {
          // Intentar obtener conteos reales vía RPC (requiere función SQL desplegada)
          const { data: countData, error: rpcError } = await supabase.rpc('get_students_count_by_course', {
            course_ids: courseIds
          });
          
          if (!rpcError && countData) {
            // RPC disponible: usar conteos únicos reales
            const countMap: Record<string, number> = {};
            (countData || []).forEach((row: { course_id: string; student_count: number }) => {
              countMap[row.course_id] = Number(row.student_count) || 0;
            });
            edicionesArray.forEach(edicion => {
              edicion.total_students = countMap[edicion.course_id] || 0;
            });
          } else {
            // Fallback: sumar conteos por módulo que vienen del Edge Function (service role key)
            edicionesArray.forEach(edicion => {
              edicion.total_students = edicion.modulos.reduce(
                (sum, m) => sum + (m.enrollments?.[0]?.count || 0), 0
              );
            });
          }
        }
        
        setEdiciones(edicionesArray);
      }

    } catch (error) {
      console.error('Error:', error);
      toast({
        title: "Error",
        description: "Error interno al cargar los cursos",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCourse = async (courseId: string) => {
    try {
      const { error } = await supabase
        .from('courses')
        .delete()
        .eq('id', courseId);

      if (error) throw error;

      toast({
        title: "Curso eliminado",
        description: "El curso ha sido eliminado exitosamente",
      });

      fetchCourses();
    } catch (error) {
      console.error('Error deleting course:', error);
      toast({
        title: "Error",
        description: "No se pudo eliminar el curso",
        variant: "destructive",
      });
    } finally {
      setCourseToDelete(null);
    }
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-foreground">Mis Cursos</h1>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="bg-gradient-card shadow-card border-0">
              <CardContent className="p-6">
                <div className="animate-pulse space-y-4">
                  <div className="h-4 bg-muted rounded w-3/4"></div>
                  <div className="h-3 bg-muted rounded w-1/2"></div>
                  <div className="h-3 bg-muted rounded w-2/3"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-foreground">Mis Cursos</h1>
        </div>

      {courses.length === 0 ? (
        <Card className="bg-gradient-card shadow-card border-0">
          <CardContent className="p-8 text-center">
            <BookOpen className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">
              No hay cursos disponibles
            </h3>
            <p className="text-muted-foreground">
              {profile?.role === 'student' 
                ? 'Aún no estás inscrito en ningún curso. Contacta a tu coordinador académico.'
                : 'Aún no tienes módulos asignados.'
              }
            </p>
          </CardContent>
        </Card>
      ) : showGroupedView ? (
        // Vista agrupada por ediciones para profesores y admins
        <div className="space-y-8">
          {ediciones.map((edicion) => (
            <div key={edicion.course_id} className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-gradient-card rounded-lg border border-border/50 gap-3">
                <div className="flex-1">
                  <h2 className="text-lg sm:text-xl font-bold text-foreground">
                    {edicion.program_name} - {edicion.course_name}
                  </h2>
                  <div className="flex flex-wrap gap-3 sm:gap-4 mt-2 text-xs sm:text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {edicion.academic_year} - {edicion.semester}
                    </span>
                    {profile?.role !== 'student' && (
                      <span className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5" />
                        {edicion.total_students} estudiantes únicos
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <BookOpen className="w-3.5 h-3.5" />
                      {edicion.modulos.length} {edicion.modulos.length === 1 ? 'módulo' : 'módulos'}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 pl-0 md:pl-4">
                {edicion.modulos.map((modulo) => (
                  <Card key={modulo.id} className="bg-gradient-card shadow-card border-0 hover:shadow-glow transition-all duration-300">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-base font-semibold text-foreground mb-1 truncate">
                            {modulo.name}
                          </CardTitle>
                          <Badge variant="secondary" className="text-xs">
                            {modulo.code}
                          </Badge>
                        </div>
                        <BookOpen className="w-5 h-5 text-primary flex-shrink-0" />
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
                        {modulo.description || 'Sin descripción disponible'}
                      </p>
                      
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Users className="w-3.5 h-3.5 flex-shrink-0" />
                          <span className="truncate">
                            Prof. {modulo.teacher?.first_name || 'Sin asignar'} {modulo.teacher?.last_name || ''}
                          </span>
                        </div>
                        
                        {modulo.enrollments && modulo.enrollments[0] && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Users className="w-3.5 h-3.5 flex-shrink-0" />
                            <span>{modulo.enrollments[0].count} estudiantes en este módulo</span>
                          </div>
                        )}
                      </div>

                      <div className="mt-4 pt-3 border-t border-border/50">
                        <Button 
                          className="w-full" 
                          size="sm"
                          variant="outline"
                          onClick={() => navigate(`/courses/${modulo.id}`)}
                        >
                          Ver Módulo
                          <ArrowRight className="w-3.5 h-3.5 ml-2" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        // Vista normal para estudiantes (sin agrupar)
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses.map((course) => (
            <Card key={course.id} className="bg-gradient-card shadow-card border-0 hover:shadow-glow transition-all duration-300">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg font-semibold text-foreground mb-1">
                      {course.name}
                    </CardTitle>
                    <Badge variant="secondary" className="text-xs">
                      {course.code}
                    </Badge>
                  </div>
                  <BookOpen className="w-6 h-6 text-primary" />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                  {course.description || 'Sin descripción disponible'}
                </p>
                
                <div className="space-y-3">
                  {/* Aula Virtual info for students */}
                  {profile?.role === 'student' && course.classroom && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <GraduationCap className="w-4 h-4" />
                      <span>{course.classroom.name} - {course.classroom.grade}</span>
                    </div>
                  )}
                  
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Users className="w-4 h-4" />
                    <span>
                      Prof. {course.teacher?.first_name || 'Sin asignar'} {course.teacher?.last_name || ''}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="w-4 h-4" />
                    <span>{course.academic_year} - {course.semester}</span>
                  </div>

                  {/* Enrollment date for students */}
                  {profile?.role === 'student' && course.enrolled_at && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="w-4 h-4" />
                      <span>Inscrito: {formatDateInUserTimezone(course.enrolled_at)}</span>
                    </div>
                  )}

                  {/* Student count for teachers and admins */}
                  {profile?.role !== 'student' && course.enrollments && course.enrollments[0] && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Users className="w-4 h-4" />
                      <span>{course.enrollments[0].count} estudiantes</span>
                    </div>
                  )}
                </div>

                <div className="mt-6 pt-4 border-t border-border/50 flex gap-2">
                  <Button 
                    className="flex-1" 
                    variant="outline"
                    onClick={() => navigate(`/courses/${course.id}`)}
                  >
                    Ver Curso
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                  {profile?.role === 'admin' && (
                    <Button
                      variant="destructive"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        setCourseToDelete(course.id);
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={!!courseToDelete} onOpenChange={() => setCourseToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Esto eliminará permanentemente el curso
              y todos los datos asociados (tareas, exámenes, asistencias, etc.).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => courseToDelete && handleDeleteCourse(courseToDelete)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </div>
    </DashboardLayout>
  );
};

export default Courses;