import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Users, GraduationCap, Calendar, AlertCircle, Eye, Search, BookOpen, Target, Clock, TrendingUp, TrendingDown, Award, CheckCircle2, Building2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { StudentDetailDialog } from '@/components/tutor/StudentDetailDialog';
import { StatCard } from '@/components/tutor/StatCard';
import { GradeDistributionChart } from '@/components/tutor/GradeDistributionChart';
import { StudentsAtRiskTable } from '@/components/tutor/StudentsAtRiskTable';
import { CourseScheduleManager } from '@/components/course/CourseScheduleManager';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import { Progress } from '@/components/ui/progress';

// Convert letter grades to numeric scores
const convertLetterGrade = (score: string): number => {
  const numericScore = Number(score);
  if (!isNaN(numericScore)) return numericScore;
  
  // Letter grade conversion
  const letterGrades: { [key: string]: number } = {
    'AD': 18,
    'A': 15,
    'B': 12,
    'C': 9
  };
  
  return letterGrades[score.toUpperCase()] || 0;
};

interface Course {
  id: string;
  name: string;
  code: string;
  grade?: string;
  section?: string;
  academic_year?: string;
}

interface Student {
  id: string;
  first_name: string;
  last_name: string;
  paternal_surname: string;
  maternal_surname: string;
  student_code: string;
  email: string;
  phone?: string;
  document_number?: string;
  birth_date?: string;
}

interface AttendanceRecord {
  student_id: string;
  present: number;
  absent: number;
  late: number;
  justified: number;
  total: number;
  attendance_rate: number;
  last_attendance_date?: string;
  last_recorded_at?: string;
}

interface GradeRecord {
  student_id: string;
  ad_count: number;
  a_count: number;
  b_count: number;
  c_count: number;
  total_graded: number;
  average_score: number;
  course_grades?: CourseGradeDetail[];
}

interface CourseGradeDetail {
  course_id: string;
  course_name: string;
  course_code: string;
  average: number;
  count: number;
}

interface CourseData {
  id: string;
  name: string;
  code: string;
}

export default function TutorDashboard() {
  const { profile, activeRole, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [tutorCourses, setTutorCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [attendanceData, setAttendanceData] = useState<AttendanceRecord[]>([]);
  const [gradeData, setGradeData] = useState<GradeRecord[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [courses, setCourses] = useState<CourseData[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCourseForSchedule, setSelectedCourseForSchedule] = useState<string | null>(null);

  useEffect(() => {
    console.log('🔐 === TUTOR DASHBOARD AUTH DEBUG ===');
    console.log('👤 User:', user);
    console.log('📋 Profile:', profile);
    console.log('🎭 Active Role:', activeRole);
    console.log('📝 Profile ID:', profile?.id);
    console.log('🎯 Profile Role:', profile?.role);
    console.log('🎪 Profile Roles Array:', profile?.roles);
    console.log('=====================================');

    const currentRole = activeRole || profile?.role;
    if (currentRole === 'tutor' || profile?.roles?.includes('tutor')) {
      fetchTutorData();
    } else {
      console.warn('⚠️ Usuario no tiene rol de tutor');
      setLoading(false);
    }
  }, [profile, activeRole, user]);

  const fetchTutorData = async () => {
    try {
      console.log('🚀 === INICIANDO fetchTutorData ===');
      console.log('🆔 Profile ID para consulta:', profile?.id);
      
      if (!profile?.id) {
        console.error('❌ NO HAY PROFILE ID - Usuario no autenticado o perfil no cargado');
        toast.error('No se pudo cargar tu perfil. Por favor, inicia sesión nuevamente.');
        setLoading(false);
        return;
      }

      setLoading(true);

      // Fetch modules where user is tutor - check course_teachers table
      console.log('📡 Consultando módulos donde el usuario es tutor:', profile.id);
      const { data: coursesData, error: coursesError } = await supabase
        .from('course_teachers')
        .select(`
          course_id,
          modulos!course_teachers_course_id_fkey!inner(
            id,
            name,
            code,
            start_date,
            end_date,
            course:courses (
              id,
              name,
              academic_year,
              semester
            )
          )
        `)
        .eq('teacher_id', profile.id);

      console.log('📦 Respuesta de módulos:', { coursesData, coursesError });

      if (coursesError) {
        throw coursesError;
      }
      
      if (!coursesData || coursesData.length === 0) {
        console.warn('⚠️ No se encontraron módulos asignados como tutor');
        toast.error('No tienes módulos asignados como tutor');
        setLoading(false);
        return;
      }

      // Extract modules from the join
      const courses = coursesData.map(item => {
        const modulo = (item.modulos as any);
        return {
          id: modulo.id,
          name: modulo.nombre,
          code: modulo.codigo,
          grade: modulo.course?.name || '',
          section: '',
          academic_year: modulo.course?.academic_year || ''
        };
      });

      console.log(`✅ ${courses.length} cursos encontrados:`, courses);
      setTutorCourses(courses);
      
      // Select the first course by default
      const firstCourseId = courses[0].id;
      setSelectedCourseId(firstCourseId);
      
      // Load data for the first course
      await loadCourseData(firstCourseId, courses.map(c => c.id));

    } catch (error) {
      console.error('❌ === ERROR EN fetchTutorData ===');
      console.error('Error completo:', error);
      console.error('=====================================');
      toast.error('Error al cargar los datos del dashboard');
    } finally {
      console.log('🏁 fetchTutorData finalizado');
      setLoading(false);
    }
  };

  const loadCourseData = async (courseId: string, allCourseIds: string[]) => {
    try {
      console.log('📚 === CARGANDO DATOS DEL CURSO ===');
      console.log('🆔 Course ID:', courseId);

      // Set courses for schedule management
      const coursesForSchedule = tutorCourses.length > 0 ? tutorCourses : allCourseIds.map(id => ({ id, name: '', code: '' }));
      setCourses(coursesForSchedule);

      // Fetch students enrolled in ALL tutor modules via course_enrollments
      console.log('📡 Consultando estudiantes matriculados en todos los módulos del tutor...');
      const { data: studentsData, error: studentsError } = await supabase
        .from('course_enrollments')
        .select(`
          student_id,
          profiles!inner(*)
        `)
        .in('modulo_id', allCourseIds);

      console.log('📦 Respuesta de estudiantes:', { studentsData, studentsError });

      if (studentsError) throw studentsError;

      // Remove duplicates by student_id
      const uniqueStudents = Array.from(
        new Map(studentsData.map(item => [item.student_id, item.profiles])).values()
      ) as Student[];

      console.log('👥 Total estudiantes únicos encontrados:', uniqueStudents.length);
      setStudents(uniqueStudents);

      // Fetch attendance data
      const studentIds = uniqueStudents.map(s => s.id);
      
      const { data: attendanceRaw, error: attendanceError } = await supabase
        .from('attendance')
        .select('student_id, status, date, recorded_at')
        .in('student_id', studentIds)
        .in('course_id', allCourseIds)
        .order('date', { ascending: false });

      if (attendanceError) throw attendanceError;

      // Process attendance data
      const attendanceMap = new Map<string, AttendanceRecord>();
      studentIds.forEach(studentId => {
        attendanceMap.set(studentId, {
          student_id: studentId,
          present: 0,
          absent: 0,
          late: 0,
          justified: 0,
          total: 0,
          attendance_rate: 0,
          last_attendance_date: undefined,
          last_recorded_at: undefined
        });
      });

      attendanceRaw?.forEach(record => {
        const current = attendanceMap.get(record.student_id)!;
        
        if (!current.last_attendance_date) {
          current.last_attendance_date = record.date;
          current.last_recorded_at = record.recorded_at;
        }
        
        current.total++;
        if (record.status === 'present') current.present++;
        else if (record.status === 'absent') current.absent++;
        else if (record.status === 'late') current.late++;
        else if (record.status === 'justified') current.justified++;
      });

      attendanceMap.forEach((record) => {
        if (record.total > 0) {
          record.attendance_rate = ((record.present + record.late) / record.total) * 100;
        }
      });

      setAttendanceData(Array.from(attendanceMap.values()));

      // Fetch grades data
      console.log('📡 Consultando calificaciones de estudiantes...');
      const { data: submissionsData, error: submissionsError } = await supabase
        .from('assignment_submissions')
        .select(`
          student_id, 
          score, 
          assignment_id, 
          assignments!inner(
            course_id,
            courses!inner(
              id,
              name,
              code
            )
          )
        `)
        .in('student_id', studentIds)
        .not('score', 'is', null);

      if (submissionsError) throw submissionsError;

      const allSubmissions = submissionsData || [];

      // Process grades data with course breakdown
      const gradeMap = new Map<string, GradeRecord>();
      studentIds.forEach(studentId => {
        gradeMap.set(studentId, {
          student_id: studentId,
          ad_count: 0,
          a_count: 0,
          b_count: 0,
          c_count: 0,
          total_graded: 0,
          average_score: 0,
          course_grades: []
        });
      });

      const studentCourseGrades = new Map<string, Map<string, { total: number; count: number; course_name: string; course_code: string }>>();

      allSubmissions.forEach(sub => {
        const current = gradeMap.get(sub.student_id)!;
        current.total_graded++;
        const score = convertLetterGrade(sub.score);

        if (score >= 18) current.ad_count++;
        else if (score >= 14) current.a_count++;
        else if (score >= 11) current.b_count++;
        else current.c_count++;

        if (!studentCourseGrades.has(sub.student_id)) {
          studentCourseGrades.set(sub.student_id, new Map());
        }
        const courseGradesMap = studentCourseGrades.get(sub.student_id)!;
        const subCourseId = (sub.assignments as any).courses.id;
        
        if (!courseGradesMap.has(subCourseId)) {
          courseGradesMap.set(subCourseId, {
            total: 0,
            count: 0,
            course_name: (sub.assignments as any).courses.name,
            course_code: (sub.assignments as any).courses.code
          });
        }
        
        const courseData = courseGradesMap.get(subCourseId)!;
        courseData.total += score;
        courseData.count++;
      });

      gradeMap.forEach((record, studentId) => {
        if (record.total_graded > 0) {
          const studentSubmissions = allSubmissions.filter(s => s.student_id === record.student_id);
          const sum = studentSubmissions.reduce((acc, s) => acc + convertLetterGrade(s.score), 0);
          record.average_score = sum / record.total_graded;

          const courseGradesMap = studentCourseGrades.get(record.student_id);
          if (courseGradesMap) {
            record.course_grades = Array.from(courseGradesMap.entries()).map(([cId, data]) => ({
              course_id: cId,
              course_name: data.course_name,
              course_code: data.course_code,
              average: data.total / data.count,
              count: data.count
            }));
          }
        }
      });

      setGradeData(Array.from(gradeMap.values()));

    } catch (error) {
      console.error('❌ === ERROR EN loadCourseData ===');
      console.error('Error completo:', error);
      toast.error('Error al cargar los datos del curso');
    }
  };

  const handleCourseChange = async (courseId: string) => {
    setSelectedCourseId(courseId);
    setLoading(true);
    await loadCourseData(courseId, tutorCourses.map(c => c.id));
    setLoading(false);
  };

  const getGradeLetter = (score: number): string => {
    if (score >= 18) return 'AD';
    if (score >= 14) return 'A';
    if (score >= 11) return 'B';
    return 'C';
  };

  const getGradeBadgeVariant = (score: number): 'default' | 'secondary' | 'outline' | 'destructive' => {
    if (score >= 18) return 'default';
    if (score >= 14) return 'secondary';
    if (score >= 11) return 'outline';
    return 'destructive';
  };

  const getAttendanceStatus = (rate: number): { label: string; variant: 'default' | 'destructive' | 'secondary' | 'outline' } => {
    if (rate >= 90) return { label: 'Excelente', variant: 'default' };
    if (rate >= 75) return { label: 'Buena', variant: 'secondary' };
    if (rate >= 60) return { label: 'Regular', variant: 'outline' };
    return { label: 'Crítica', variant: 'destructive' };
  };

  const currentRole = activeRole || profile?.role;
  const hasTutorRole = currentRole === 'tutor' || profile?.roles?.includes('tutor');
  
  if (!hasTutorRole) {
    return (
      <DashboardLayout>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            No tienes permisos para acceder a este dashboard. Solo tutores pueden ver esta página.
          </AlertDescription>
        </Alert>
      </DashboardLayout>
    );
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-64"></div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-32 bg-muted rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const selectedCourse = tutorCourses.find(c => c.id === selectedCourseId);

  if (!selectedCourse && !loading && tutorCourses.length === 0) {
    return (
      <DashboardLayout>
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            No tienes cursos asignados como tutor. Contacta al administrador para que te asigne un curso.
          </AlertDescription>
        </Alert>
      </DashboardLayout>
    );
  }

  const overallAttendanceRate = attendanceData.length > 0
    ? attendanceData.reduce((acc, r) => acc + r.attendance_rate, 0) / attendanceData.length
    : 0;

  const overallAverageScore = gradeData.length > 0
    ? gradeData.reduce((acc, r) => acc + r.average_score, 0) / gradeData.length
    : 0;

  // Calculate students at risk
  const studentsAtRisk = students
    .map(student => {
      const attendance = attendanceData.find(a => a.student_id === student.id);
      const grades = gradeData.find(g => g.student_id === student.id);
      
      const attendanceRate = attendance?.attendance_rate || 0;
      const averageScore = grades?.average_score || 0;
      
      const riskFactors: string[] = [];
      if (attendanceRate < 75) riskFactors.push('Asistencia baja');
      if (averageScore > 0 && averageScore < 11) riskFactors.push('Bajo rendimiento');
      if (attendanceRate < 60) riskFactors.push('Asistencia crítica');
      
      return {
        student,
        attendanceRate,
        averageScore,
        riskFactors
      };
    })
    .filter(item => item.riskFactors.length > 0);

  // Prepare grade distribution data
  const totalGradeDistribution = gradeData.reduce(
    (acc, g) => ({
      ad: acc.ad + g.ad_count,
      a: acc.a + g.a_count,
      b: acc.b + g.b_count,
      c: acc.c + g.c_count
    }),
    { ad: 0, a: 0, b: 0, c: 0 }
  );

  // Filter students by search
  const filteredStudents = students.filter(student => {
    const fullName = `${student.paternal_surname} ${student.maternal_surname} ${student.first_name} ${student.student_code}`.toLowerCase();
    return fullName.includes(searchTerm.toLowerCase());
  });

  const studentsWithGoodPerformance = students.filter(student => {
    const attendance = attendanceData.find(a => a.student_id === student.id);
    const grades = gradeData.find(g => g.student_id === student.id);
    return (attendance?.attendance_rate || 0) >= 90 && (grades?.average_score || 0) >= 14;
  }).length;

  // Show auth error state
  if (!user) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              No hay una sesión activa. Por favor, inicia sesión para ver el dashboard de tutoría.
            </AlertDescription>
          </Alert>
        </div>
      </DashboardLayout>
    );
  }

  if (!profile?.id) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              No se pudo cargar tu perfil de usuario. Por favor, intenta cerrar sesión e iniciar sesión nuevamente.
            </AlertDescription>
          </Alert>
        </div>
      </DashboardLayout>
    );
  }

  if (!selectedCourse && !loading && tutorCourses.length > 0) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Selecciona un curso para ver los datos.
            </AlertDescription>
          </Alert>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Dashboard de Tutoría</h1>
            {selectedCourse && (
              <p className="text-muted-foreground">
                {selectedCourse.name} ({selectedCourse.code})
                {selectedCourse.grade && selectedCourse.section && ` - ${selectedCourse.grade} ${selectedCourse.section}`}
              </p>
            )}
          </div>
          
          {tutorCourses.length > 1 && (
            <div className="flex items-center gap-3">
              <BookOpen className="h-5 w-5 text-muted-foreground" />
              <Select value={selectedCourseId || undefined} onValueChange={handleCourseChange}>
                <SelectTrigger className="w-[280px] bg-background z-50">
                  <SelectValue placeholder="Selecciona un curso" />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  {tutorCourses.map((course) => (
                    <SelectItem key={course.id} value={course.id}>
                      {course.name} ({course.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* Enhanced Stats Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total Estudiantes"
            value={students.length}
            icon={Users}
            description="En tus cursos de tutoría"
          />
          
          <StatCard
            title="Asistencia Promedio"
            value={`${overallAttendanceRate.toFixed(1)}%`}
            icon={Calendar}
            description="De tus estudiantes"
            trend={overallAttendanceRate >= 85 ? 'up' : overallAttendanceRate >= 75 ? 'neutral' : 'down'}
            trendValue={overallAttendanceRate >= 85 ? 'Excelente' : overallAttendanceRate >= 75 ? 'Buena' : 'Requiere atención'}
          />
          
          <StatCard
            title="Promedio General"
            value={`${overallAverageScore.toFixed(1)} - ${getGradeLetter(overallAverageScore)}`}
            icon={GraduationCap}
            description="De tareas calificadas"
            trend={overallAverageScore >= 14 ? 'up' : overallAverageScore >= 11 ? 'neutral' : 'down'}
            trendValue={overallAverageScore >= 14 ? 'Sobresaliente' : overallAverageScore >= 11 ? 'Satisfactorio' : 'Necesita mejorar'}
          />
          
          <StatCard
            title="Estudiantes Destacados"
            value={studentsWithGoodPerformance}
            icon={Target}
            description="Con +90% asistencia y +14 promedio"
            trend={studentsWithGoodPerformance > students.length * 0.5 ? 'up' : 'neutral'}
            trendValue={`${students.length > 0 ? ((studentsWithGoodPerformance / students.length) * 100).toFixed(0) : 0}% del grupo`}
          />
        </div>

        {/* Visualizations */}
        <div className="grid gap-4">
          <GradeDistributionChart data={totalGradeDistribution} />
        </div>

        {/* Students at Risk */}
        <StudentsAtRiskTable 
          students={studentsAtRisk}
          onViewDetails={setSelectedStudent}
        />

        {/* Student Details with Search */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Detalles por Estudiante</CardTitle>
                <CardDescription>Busca y revisa el desempeño individual</CardDescription>
              </div>
              <div className="relative w-64">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar estudiante..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
          </CardHeader>
        </Card>

        <Tabs defaultValue="grades" className="space-y-4">
          <TabsList>
            <TabsTrigger value="grades">Calificaciones</TabsTrigger>
            <TabsTrigger value="attendance">Asistencia</TabsTrigger>
            <TabsTrigger value="schedules">Horarios</TabsTrigger>
          </TabsList>

          <TabsContent value="grades" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Desempeño Académico por Estudiante</CardTitle>
                <CardDescription>
                  Calificaciones de tareas entregadas y evaluadas
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {filteredStudents.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      No se encontraron estudiantes que coincidan con la búsqueda
                    </div>
                  )}
                  {filteredStudents.map(student => {
                    const grades = gradeData.find(g => g.student_id === student.id);
                    if (!grades || grades.total_graded === 0) {
                      return (
                        <div key={student.id} className="flex items-center justify-between p-4 border rounded-lg gap-4">
                          <div className="flex-1">
                            <p className="font-medium">
                              {student.paternal_surname} {student.maternal_surname}, {student.first_name}
                            </p>
                            <p className="text-sm text-muted-foreground">{student.student_code}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">Sin calificaciones</Badge>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setSelectedStudent(student)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div key={student.id} className="p-4 border rounded-lg hover:border-primary/50 transition-colors">
                        <div className="flex flex-col space-y-4">
                          {/* Header */}
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <p className="font-medium text-lg">
                                {student.paternal_surname} {student.maternal_surname}, {student.first_name}
                              </p>
                              <p className="text-sm text-muted-foreground">{student.student_code}</p>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setSelectedStudent(student)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </div>

                          {/* Main Score Display */}
                          <div className="flex items-center justify-between p-3 bg-gradient-to-r from-primary/10 to-primary/5 rounded-lg border">
                            <div className="flex items-center gap-3">
                              <Award className="h-8 w-8 text-primary" />
                              <div>
                                <div className="text-2xl font-bold">{grades.average_score.toFixed(1)}</div>
                                <div className="text-sm text-muted-foreground">Promedio General</div>
                              </div>
                            </div>
                            <Badge variant="default" className="text-lg px-4 py-1">
                              {getGradeLetter(grades.average_score)}
                            </Badge>
                          </div>

                          {/* Grade Distribution */}
                          <div className="grid grid-cols-4 gap-2">
                            <div className="text-center p-3 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800">
                              <div className="font-bold text-green-700 dark:text-green-400 text-2xl">{grades.ad_count}</div>
                              <div className="text-xs text-green-600 dark:text-green-500 font-medium">AD (18-20)</div>
                              <div className="text-xs text-muted-foreground mt-1">Logro Destacado</div>
                            </div>
                            <div className="text-center p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                              <div className="font-bold text-blue-700 dark:text-blue-400 text-2xl">{grades.a_count}</div>
                              <div className="text-xs text-blue-600 dark:text-blue-500 font-medium">A (14-17)</div>
                              <div className="text-xs text-muted-foreground mt-1">Logro Esperado</div>
                            </div>
                            <div className="text-center p-3 bg-yellow-50 dark:bg-yellow-950/30 rounded-lg border border-yellow-200 dark:border-yellow-800">
                              <div className="font-bold text-yellow-700 dark:text-yellow-400 text-2xl">{grades.b_count}</div>
                              <div className="text-xs text-yellow-600 dark:text-yellow-500 font-medium">B (11-13)</div>
                              <div className="text-xs text-muted-foreground mt-1">En Proceso</div>
                            </div>
                            <div className="text-center p-3 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-800">
                              <div className="font-bold text-red-700 dark:text-red-400 text-2xl">{grades.c_count}</div>
                              <div className="text-xs text-red-600 dark:text-red-500 font-medium">C (0-10)</div>
                              <div className="text-xs text-muted-foreground mt-1">En Inicio</div>
                            </div>
                          </div>

                          {/* Progress Indicator */}
                          <div className="flex items-center justify-between text-sm pt-2 border-t">
                            <span className="text-muted-foreground">
                              {grades.total_graded} {grades.total_graded === 1 ? 'tarea calificada' : 'tareas calificadas'}
                            </span>
                            {grades.average_score >= 14 ? (
                              <div className="flex items-center gap-1 text-green-600">
                                <TrendingUp className="h-4 w-4" />
                                <span className="font-medium">Rendimiento Excelente</span>
                              </div>
                            ) : grades.average_score >= 11 ? (
                              <div className="flex items-center gap-1 text-blue-600">
                                <Target className="h-4 w-4" />
                                <span className="font-medium">Rendimiento Satisfactorio</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1 text-red-600">
                                <TrendingDown className="h-4 w-4" />
                                <span className="font-medium">Necesita Apoyo</span>
                              </div>
                            )}
                          </div>

                          {/* Course Breakdown */}
                          {grades.course_grades && grades.course_grades.length > 0 && (
                            <div className="pt-3 border-t space-y-2">
                              <p className="text-xs font-medium text-muted-foreground">Desempeño por Curso:</p>
                              <div className="grid grid-cols-1 gap-2">
                                {grades.course_grades.map(cg => (
                                  <div key={cg.course_id} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                                    <div className="flex-1">
                                      <p className="text-xs font-medium">{cg.course_name}</p>
                                      <p className="text-xs text-muted-foreground">{cg.course_code}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <Badge variant={getGradeBadgeVariant(cg.average)}>
                                        {cg.average.toFixed(1)} - {getGradeLetter(cg.average)}
                                      </Badge>
                                      <span className="text-xs text-muted-foreground">({cg.count})</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="attendance" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Asistencia por Estudiante</CardTitle>
                <CardDescription>
                  Registro de asistencia en todos los cursos del aula
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {filteredStudents.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      No se encontraron estudiantes que coincidan con la búsqueda
                    </div>
                  )}
                  {filteredStudents.map(student => {
                    const attendance = attendanceData.find(a => a.student_id === student.id);
                    if (!attendance || attendance.total === 0) {
                      return (
                        <div key={student.id} className="flex items-center justify-between p-4 border rounded-lg gap-4">
                          <div className="flex-1">
                            <p className="font-medium">
                              {student.paternal_surname} {student.maternal_surname}, {student.first_name}
                            </p>
                            <p className="text-sm text-muted-foreground">{student.student_code}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">Sin registros</Badge>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setSelectedStudent(student)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      );
                    }

                    const status = getAttendanceStatus(attendance.attendance_rate);

                    return (
                      <div key={student.id} className="p-4 border rounded-lg hover:border-primary/50 transition-colors">
                        <div className="flex flex-col space-y-4">
                          {/* Header */}
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <p className="font-medium text-lg">
                                {student.paternal_surname} {student.maternal_surname}, {student.first_name}
                              </p>
                              <div className="flex items-center gap-3 mt-1">
                                <p className="text-sm text-muted-foreground">{student.student_code}</p>
                                {attendance.last_attendance_date && (
                                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                    <Clock className="h-3 w-3" />
                                    Última asistencia: {format(new Date(attendance.last_attendance_date), "d MMM", { locale: es })}
                                    {attendance.last_recorded_at && 
                                      ` a las ${format(new Date(attendance.last_recorded_at), 'HH:mm')}`
                                    }
                                  </div>
                                )}
                              </div>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setSelectedStudent(student)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </div>

                          {/* Progress Bar */}
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">Tasa de asistencia</span>
                              <Badge variant={status.variant} className="font-semibold">
                                {attendance.attendance_rate.toFixed(1)}% - {status.label}
                              </Badge>
                            </div>
                            <Progress value={attendance.attendance_rate} className="h-2" />
                          </div>

                          {/* Stats Grid */}
                          <div className="grid grid-cols-4 gap-2">
                            <div className="text-center p-2 bg-green-50 dark:bg-green-950/30 rounded border border-green-200 dark:border-green-800">
                              <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 mx-auto mb-1" />
                              <div className="font-bold text-green-700 dark:text-green-400 text-lg">{attendance.present}</div>
                              <div className="text-xs text-green-600 dark:text-green-500">Presente</div>
                            </div>
                            <div className="text-center p-2 bg-red-50 dark:bg-red-950/30 rounded border border-red-200 dark:border-red-800">
                              <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 mx-auto mb-1" />
                              <div className="font-bold text-red-700 dark:text-red-400 text-lg">{attendance.absent}</div>
                              <div className="text-xs text-red-600 dark:text-red-500">Falta</div>
                            </div>
                            <div className="text-center p-2 bg-yellow-50 dark:bg-yellow-950/30 rounded border border-yellow-200 dark:border-yellow-800">
                              <Clock className="h-4 w-4 text-yellow-600 dark:text-yellow-400 mx-auto mb-1" />
                              <div className="font-bold text-yellow-700 dark:text-yellow-400 text-lg">{attendance.late}</div>
                              <div className="text-xs text-yellow-600 dark:text-yellow-500">Tarde</div>
                            </div>
                            <div className="text-center p-2 bg-blue-50 dark:bg-blue-950/30 rounded border border-blue-200 dark:border-blue-800">
                              <BookOpen className="h-4 w-4 text-blue-600 dark:text-blue-400 mx-auto mb-1" />
                              <div className="font-bold text-blue-700 dark:text-blue-400 text-lg">{attendance.justified}</div>
                              <div className="text-xs text-blue-600 dark:text-blue-500">Justif.</div>
                            </div>
                          </div>

                          {/* Total */}
                          <div className="text-center text-sm text-muted-foreground pt-2 border-t">
                            Total: {attendance.total} registros de asistencia
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="schedules" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Gestión de Horarios de Cursos</CardTitle>
                <CardDescription>
                  Administra los horarios de tus cursos de tutoría
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {tutorCourses.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No hay cursos asignados como tutor
                    </div>
                  ) : (
                    <div className="grid gap-3">
                      {tutorCourses.map(course => (
                        <div key={course.id} className="flex items-center justify-between p-4 border rounded-lg">
                          <div>
                            <p className="font-medium">{course.name}</p>
                            <p className="text-sm text-muted-foreground">{course.code}</p>
                          </div>
                          <Button
                            variant="outline"
                            onClick={() => setSelectedCourseForSchedule(course.id)}
                          >
                            <Clock className="h-4 w-4 mr-2" />
                            Editar Horario
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <StudentDetailDialog
          student={selectedStudent}
          open={!!selectedStudent}
          onOpenChange={(open) => !open && setSelectedStudent(null)}
          classroomId={selectedCourseId || ''}
        />

        {/* Schedule Edit Dialog */}
        <Dialog open={!!selectedCourseForSchedule} onOpenChange={(open) => !open && setSelectedCourseForSchedule(null)}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Editar Horario del Curso</DialogTitle>
              <DialogDescription>
                Define los días y horarios en que se imparte este curso
              </DialogDescription>
            </DialogHeader>
            {selectedCourseForSchedule && (
              <CourseScheduleManager
                courseId={selectedCourseForSchedule}
                canEdit={true}
              />
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
