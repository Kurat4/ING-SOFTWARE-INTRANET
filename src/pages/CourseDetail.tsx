import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { formatSimpleDate, convertTimeToUserTimezone } from '@/lib/timezoneUtils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Users, GraduationCap, Clock, Calendar, ClipboardCheck, Plus, Edit, UserCheck, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { WeeklyContentManager } from '@/components/course/WeeklyContentManager';
import { AttendanceManager } from '@/components/course/AttendanceManager';
import { AttendanceRecords } from '@/components/course/AttendanceRecords';
import { StudentCourseAttendance } from '@/components/course/StudentCourseAttendance';
import { ExamsList } from '@/components/course/ExamsList';
import { CourseEditDialog } from '@/components/course/CourseEditDialog';
import { CourseAssignmentsReview } from '@/components/course/CourseAssignmentsReview';
import { CourseAccessGuard } from '@/components/course/CourseAccessGuard';

interface Course {
  id: string;
  name: string;
  code: string;
  description: string;
  academic_year: string;
  is_active: boolean;
  created_at: string;
  start_time?: string;
  end_time?: string;
  schedule?: string[];
  teacher?: {
    id: string;
    first_name: string;
    last_name: string;
    // Quitamos email de aquí porque al estudiante no le llega
  };
  classroom?: {
    name: string;
    grade: string;
    education_level: string;
  };
}

interface Teacher {
  id: string;
  first_name: string;
  last_name: string;
}

interface Student {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  enrolled_at: string;
}

export default function CourseDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [course, setCourse] = useState<Course | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [additionalTeachers, setAdditionalTeachers] = useState<Teacher[]>([]);

  // Check if user can edit this course (solo admin)
  const canEdit = profile && profile.role === 'admin';
  
  // Check if user is a teacher of this course (para otras funcionalidades)
  const isTeacher = profile && course && (
    (profile.role === 'teacher' && course.teacher && profile.id === course.teacher.id) ||
    (profile.role === 'teacher' && additionalTeachers.some(t => t.id === profile.id))
  );

  useEffect(() => {
    if (id) {
      fetchCourse();
      fetchStudents();
      fetchAdditionalTeachers();
    }
  }, [id]);


  const fetchCourse = async () => {
    try {
      // 1. AGREGAR 'schedule' AL SELECT
      const { data, error } = await supabase
        .from('modulos')
        .select(`
          id,
          name,
          code,
          start_date,
          end_date,
          schedule,  
          teacher_principal_id,
          course:courses (
            id,
            name,
            academic_year,
            semester
          ),
          teacher:profiles!modulos_teacher_principal_id_fkey (
            id,
            first_name,
            last_name
          )
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      
      // 2. LÓGICA PARA PROCESAR EL HORARIO (JSON -> Vista)
      // El admin guarda algo como: { "Lunes": "09:00-11:00", "Miércoles": "09:00-11:00" }
      const scheduleData = data.schedule || {}; 
      const days = Object.keys(scheduleData); // ["Lunes", "Miércoles"]
      
      // Intentamos sacar la hora del primer día disponible para mostrarla
      let startTime = '';
      let endTime = '';
      
      if (days.length > 0) {
        const timeRange = scheduleData[days[0]]; // "09:00-11:00"
        if (timeRange && timeRange.includes('-')) {
          const [start, end] = timeRange.split('-');
          startTime = start.trim();
          endTime = end.trim();
        }
      }

      const transformedCourse = {
        id: data.id,
        name: data.name,
        code: data.code,
        description: `${data.course?.name || ''} - Inicio: ${formatSimpleDate(data.start_date)}`,
        academic_year: data.course?.academic_year || '',
        semester: data.course?.semester || '',
        is_active: true,
        created_at: data.start_date,
        // 3. ASIGNAR LOS VALORES REALES
        start_time: startTime, // Ahora sí tiene valor
        end_time: endTime,     // Ahora sí tiene valor
        schedule: days,        // Ahora es un array de días ["Lunes", "Martes"]
        teacher: data.teacher
      };
      
      setCourse(transformedCourse as any);
    } catch (error) {
      console.error('Error fetching module:', error);
      toast.error('Error al cargar el módulo');
      navigate('/courses');
    }
  };

  const fetchStudents = async () => {
    try {
      const { data, error } = await supabase
        .from('course_enrollments')
        .select(`
          enrolled_at,
          access_status,
          student_id,
          profiles!fk_enrollments_profiles(
            id,
            first_name,
            last_name,
            email,
            student_code
          )
        `)
        .eq('modulo_id', id);

      if (error) throw error;
      
      console.log('Raw enrollment data:', data);
      
      const enrolledStudents = data
        ?.map(enrollment => {
          console.log('Processing enrollment:', enrollment);
          const student = enrollment.profiles;
          if (!student) {
            console.warn('Enrollment without student data:', enrollment);
            return null;
          }
          return {
            ...(student as any),
            enrolled_at: enrollment.enrolled_at,
            payment_status: enrollment.access_status || 'pending'
          };
        })
        .filter((student): student is Student => student !== null) || [];
      
      console.log('Processed students:', enrolledStudents);
      setStudents(enrolledStudents);
    } catch (error) {
      console.error('Error fetching students:', error);
      toast.error('Error al cargar los estudiantes');
    } finally {
      setLoading(false);
    }
  };

  const fetchAdditionalTeachers = async () => {
    try {
      // Obtener profesores adicionales del módulo
      const { data, error } = await supabase
        .from('course_teachers')
        .select(`
          teacher:profiles!course_teachers_teacher_id_fkey(
            id,
            first_name,
            last_name
          )
        `)
        .eq('course_id', id);

      if (error) throw error;
      setAdditionalTeachers(data?.map(item => item.teacher).filter(Boolean) || []);
    } catch (error) {
      console.error('Error fetching additional teachers:', error);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  if (!course) {
    return (
      <DashboardLayout>
        <div className="text-center">
          <h1 className="text-2xl font-bold">Curso No Encontrado</h1>
          <Button onClick={() => navigate('/courses')} className="mt-4">
            Volver a Cursos
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <CourseAccessGuard courseId={id!}>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(-1)}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver
            </Button>
          </div>

        {/* Course Info */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <CardTitle className="text-2xl">{course.name}</CardTitle>
                <CardDescription className="mt-2">
                  <span className="font-mono text-sm bg-muted px-2 py-1 rounded">
                    {course.code}
                  </span>
                </CardDescription>
                {course.description && (
                  <p className="mt-3 text-muted-foreground">
                    {course.description}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={course.is_active ? "default" : "secondary"}>
                  {course.is_active ? "Activo" : "Inactivo"}
                </Badge>
                {canEdit && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsEditDialogOpen(true)}
                    className="gap-2"
                  >
                    <Edit className="h-4 w-4" />
                    Editar
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="flex items-center gap-2">
                <GraduationCap className="h-4 w-4 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">Profesores</p>
                  <div className="font-medium">
                    <span>{course.teacher?.first_name || 'Sin asignar'} {course.teacher?.last_name || ''}</span>
                    {course.teacher && <Badge variant="secondary" className="ml-2">Principal</Badge>}
                  </div>
                  {additionalTeachers.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {additionalTeachers.map((teacher) => (
                        <Badge key={teacher.id} variant="outline" className="gap-1 text-xs">
                          <UserCheck className="h-3 w-3" />
                          {teacher.first_name} {teacher.last_name}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              
              {course.classroom && (
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Aula Virtual</p>
                    <p className="font-medium">{course.classroom.name}</p>
                  </div>
                </div>
              )}
              
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Horario</p>
                  <div className="font-medium">
                    {Array.isArray(course.schedule) && course.schedule.length > 0
                      ? course.schedule.join(', ')
                      : 'Por definir'}
                    {(course.start_time || course.end_time) && (
                      <div className="text-xs text-blue-600 font-semibold">
                        {convertTimeToUserTimezone(course.start_time)} - {convertTimeToUserTimezone(course.end_time)}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Año Académico</p>
                  <p className="font-medium">{course.academic_year}</p>
                </div>
              </div>

            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="content" className="space-y-4">
          <TabsList className={`grid w-full ${profile?.role === 'admin' ? 'grid-cols-6' : 'grid-cols-5'}`}>
            <TabsTrigger value="content">Contenido</TabsTrigger>
            <TabsTrigger value="attendance" className="flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4" />
              Asistencia
            </TabsTrigger>
            <TabsTrigger value="exams">Exámenes</TabsTrigger>
            {(profile?.role === 'teacher' || profile?.role === 'admin') && (
              <TabsTrigger value="submissions" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Entregas
              </TabsTrigger>
            )}
            <TabsTrigger value="students" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Estudiantes
            </TabsTrigger>
          </TabsList>

          <TabsContent value="content">
            <WeeklyContentManager 
              courseId={course.id} 
              canEdit={canEdit || isTeacher || false}
            />
          </TabsContent>

          <TabsContent value="attendance">
            {profile?.role === 'admin' || isTeacher ? (
              <div className="space-y-6">
                <AttendanceManager courseId={course.id} />
                <AttendanceRecords courseId={course.id} />
              </div>
            ) : profile?.role === 'student' ? (
              <StudentCourseAttendance courseId={course.id} />
            ) : (
              <div className="p-6">
                <p className="text-muted-foreground">No tienes permisos para ver el historial de asistencia de este curso.</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="exams">
            <div className="space-y-4">
              {(canEdit || isTeacher) && (
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>Exámenes del Módulo</CardTitle>
                      <Button onClick={() => navigate(`/modulos/${course.id}/create-exam`)} className="bg-gradient-primary shadow-glow">
                        <Plus className="h-4 w-4 mr-2" />
                        Crear Examen
                      </Button>
                    </div>
                  </CardHeader>
                </Card>
              )}
              
              <ExamsList courseId={course.id} canEdit={canEdit || isTeacher || false} />
            </div>
          </TabsContent>

          <TabsContent value="submissions">
            <CourseAssignmentsReview courseId={course.id} />
          </TabsContent>

          <TabsContent value="students">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Estudiantes Inscritos ({students.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {students.length > 0 ? (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {students.map((student) => (
                      <div key={student.id} className="p-4 border rounded-lg">
                        <h3 className="font-medium">
                          {student?.first_name || 'Sin nombre'} {student?.last_name || ''}
                        </h3>
                        <p className="text-sm text-muted-foreground">{student.email}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Inscrito: {formatSimpleDate(student.enrolled_at)}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium mb-2">No hay estudiantes inscritos</h3>
                    <p className="text-muted-foreground">
                      Este curso aún no tiene estudiantes inscritos.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Course Edit Dialog */}
        <CourseEditDialog
          courseId={course.id}
          open={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
          onSuccess={() => {
            fetchCourse();
            fetchAdditionalTeachers();
          }}
        />
        </div>
      </CourseAccessGuard>
    </DashboardLayout>
  );
}
