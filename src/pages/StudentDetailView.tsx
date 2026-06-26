import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  ArrowLeft, Mail, Phone, Calendar, BookOpen, Award, TrendingUp, 
  BarChart3, CheckCircle2, XCircle, Clock, FileCheck, AlertCircle,
  Download, User, GraduationCap
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

// Convert letter grades to numeric scores
const convertLetterGrade = (score: string): number => {
  const numericScore = Number(score);
  if (!isNaN(numericScore)) return numericScore;
  
  const letterGrades: { [key: string]: number } = {
    'AD': 18,
    'A': 15,
    'B': 12,
    'C': 9
  };
  
  return letterGrades[score.toUpperCase()] || 0;
};

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

interface CourseGrade {
  course_id: string;
  course_name: string;
  course_code: string;
  assignment_title: string;
  score: number;
  max_score: number;
  submitted_at: string;
  graded_at: string;
  feedback?: string;
}

interface CourseAttendance {
  course_id: string;
  course_name: string;
  course_code: string;
  date: string;
  status: string;
  notes?: string;
  recorded_at?: string;
}

interface CourseStats {
  course_id: string;
  course_name: string;
  course_code: string;
  average_score: number;
  total_assignments: number;
  attendance_rate: number;
  total_attendance_records: number;
  ad_count: number;
  a_count: number;
  b_count: number;
  c_count: number;
}

export default function StudentDetailView() {
  const { studentId } = useParams<{ studentId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [student, setStudent] = useState<Student | null>(null);
  const [grades, setGrades] = useState<CourseGrade[]>([]);
  const [attendance, setAttendance] = useState<CourseAttendance[]>([]);
  const [courseStats, setCourseStats] = useState<CourseStats[]>([]);

  useEffect(() => {
    if (studentId) {
      fetchStudentData();
    }
  }, [studentId]);

  const fetchStudentData = async () => {
    try {
      setLoading(true);

      // Fetch student profile
      const { data: studentData, error: studentError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', studentId)
        .single();

      if (studentError) throw studentError;
      setStudent(studentData);

      // Fetch all grades
      const { data: gradesData, error: gradesError } = await supabase
        .from('assignment_submissions')
        .select(`
          score,
          submitted_at,
          graded_at,
          feedback,
          assignments!inner(
            title,
            max_score,
            course_id,
            courses!inner(
              id,
              name,
              code
            )
          )
        `)
        .eq('student_id', studentId)
        .not('score', 'is', null)
        .order('graded_at', { ascending: false });

      if (gradesError) throw gradesError;

      const formattedGrades: CourseGrade[] = gradesData.map(g => ({
        course_id: (g.assignments as any).courses.id,
        course_name: (g.assignments as any).courses.name,
        course_code: (g.assignments as any).courses.code,
        assignment_title: (g.assignments as any).title,
        score: convertLetterGrade(g.score),
        max_score: Number((g.assignments as any).max_score),
        submitted_at: g.submitted_at || '',
        graded_at: g.graded_at || '',
        feedback: g.feedback || undefined
      }));

      setGrades(formattedGrades);

      // Fetch all attendance
      const { data: attendanceData, error: attendanceError } = await supabase
        .from('attendance')
        .select(`
          date,
          status,
          notes,
          recorded_at,
          course_id,
          classroom_id,
          courses(id, name, code)
        `)
        .eq('student_id', studentId)
        .order('date', { ascending: false })
        .order('recorded_at', { ascending: false });

      if (attendanceError) throw attendanceError;

      const formattedAttendance: CourseAttendance[] = attendanceData
        .filter(a => a.courses)
        .map(a => ({
          course_id: (a.courses as any).id,
          course_name: (a.courses as any).name,
          course_code: (a.courses as any).code,
          date: a.date,
          status: a.status || 'present',
          notes: a.notes || undefined,
          recorded_at: a.recorded_at || undefined
        }));

      setAttendance(formattedAttendance);

      // Calculate course stats
      const courseMap = new Map<string, CourseStats>();

      formattedGrades.forEach(grade => {
        if (!courseMap.has(grade.course_id)) {
          courseMap.set(grade.course_id, {
            course_id: grade.course_id,
            course_name: grade.course_name,
            course_code: grade.course_code,
            average_score: 0,
            total_assignments: 0,
            attendance_rate: 0,
            total_attendance_records: 0,
            ad_count: 0,
            a_count: 0,
            b_count: 0,
            c_count: 0
          });
        }

        const stats = courseMap.get(grade.course_id)!;
        stats.total_assignments++;
        stats.average_score += grade.score;

        if (grade.score >= 18) stats.ad_count++;
        else if (grade.score >= 14) stats.a_count++;
        else if (grade.score >= 11) stats.b_count++;
        else stats.c_count++;
      });

      formattedAttendance.forEach(att => {
        if (!courseMap.has(att.course_id)) {
          courseMap.set(att.course_id, {
            course_id: att.course_id,
            course_name: att.course_name,
            course_code: att.course_code,
            average_score: 0,
            total_assignments: 0,
            attendance_rate: 0,
            total_attendance_records: 0,
            ad_count: 0,
            a_count: 0,
            b_count: 0,
            c_count: 0
          });
        }

        const stats = courseMap.get(att.course_id)!;
        stats.total_attendance_records++;
        if (att.status === 'present' || att.status === 'late') {
          stats.attendance_rate++;
        }
      });

      courseMap.forEach(stats => {
        if (stats.total_assignments > 0) {
          stats.average_score = stats.average_score / stats.total_assignments;
        }
        if (stats.total_attendance_records > 0) {
          stats.attendance_rate = (stats.attendance_rate / stats.total_attendance_records) * 100;
        }
      });

      setCourseStats(Array.from(courseMap.values()));

    } catch (error) {
      console.error('Error fetching student data:', error);
      toast.error('Error al cargar los datos del estudiante');
    } finally {
      setLoading(false);
    }
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

  const getAttendanceIcon = (status: string) => {
    switch (status) {
      case 'present':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'absent':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'late':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'justified':
        return <FileCheck className="h-4 w-4 text-blue-500" />;
      default:
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    }
  };

  const getAttendanceLabel = (status: string): string => {
    switch (status) {
      case 'present': return 'Presente';
      case 'absent': return 'Ausente';
      case 'late': return 'Tardanza';
      case 'justified': return 'Justificado';
      default: return 'Presente';
    }
  };

  const exportToCSV = (type: 'grades' | 'attendance') => {
    if (type === 'grades') {
      const headers = ['Curso', 'Código', 'Tarea', 'Nota', 'Puntaje Máx', 'Letra', 'Fecha Calificación', 'Retroalimentación'];
      const rows = grades.map(g => [
        g.course_name,
        g.course_code,
        g.assignment_title,
        g.score.toString(),
        g.max_score.toString(),
        getGradeLetter(g.score),
        format(new Date(g.graded_at), 'dd/MM/yyyy HH:mm'),
        g.feedback || ''
      ]);

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      
      link.setAttribute('href', url);
      link.setAttribute('download', `calificaciones_${student?.student_code}_${format(new Date(), 'yyyy-MM-dd')}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success('Calificaciones exportadas exitosamente');
    } else {
      const headers = ['Curso', 'Código', 'Fecha', 'Hora Registro', 'Estado', 'Observaciones'];
      const rows = attendance.map(a => [
        a.course_name,
        a.course_code,
        format(new Date(a.date), 'dd/MM/yyyy'),
        a.recorded_at ? format(new Date(a.recorded_at), 'HH:mm:ss') : '-',
        getAttendanceLabel(a.status),
        a.notes || ''
      ]);

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      
      link.setAttribute('href', url);
      link.setAttribute('download', `asistencia_${student?.student_code}_${format(new Date(), 'yyyy-MM-dd')}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success('Asistencia exportada exitosamente');
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-64"></div>
            <div className="grid gap-4 md:grid-cols-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-32 bg-muted rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!student) {
    return (
      <DashboardLayout>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            No se encontró el estudiante
          </AlertDescription>
        </Alert>
      </DashboardLayout>
    );
  }

  const totalGrades = grades.length;
  const averageScore = totalGrades > 0 
    ? grades.reduce((acc, g) => acc + g.score, 0) / totalGrades 
    : 0;

  const totalAttendance = attendance.length;
  const attendanceStats = attendance.reduce(
    (acc, a) => {
      if (a.status === 'present') acc.present++;
      else if (a.status === 'absent') acc.absent++;
      else if (a.status === 'late') acc.late++;
      else if (a.status === 'justified') acc.justified++;
      return acc;
    },
    { present: 0, absent: 0, late: 0, justified: 0 }
  );

  const attendanceRate = totalAttendance > 0
    ? ((attendanceStats.present + attendanceStats.late) / totalAttendance) * 100
    : 0;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(-1)}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver
            </Button>
            <div>
              <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
                <User className="h-8 w-8" />
                {student.paternal_surname} {student.maternal_surname}, {student.first_name}
              </h1>
              <p className="text-muted-foreground">
                Código: {student.student_code}
              </p>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="bg-gradient-to-br from-primary/10 to-primary/5">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Promedio General</p>
                  <p className="text-3xl font-bold mt-1">{averageScore.toFixed(1)}</p>
                  <Badge variant="outline" className="mt-2">
                    {getGradeLetter(averageScore)}
                  </Badge>
                </div>
                <Award className="h-12 w-12 text-primary opacity-50" />
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                {totalGrades} {totalGrades === 1 ? 'calificación' : 'calificaciones'}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Asistencia</p>
                  <p className="text-3xl font-bold mt-1">{attendanceRate.toFixed(1)}%</p>
                  <Badge 
                    variant={attendanceRate >= 90 ? 'default' : attendanceRate >= 75 ? 'secondary' : 'destructive'}
                    className="mt-2"
                  >
                    {attendanceRate >= 90 ? 'Excelente' : attendanceRate >= 75 ? 'Buena' : 'Regular'}
                  </Badge>
                </div>
                <BarChart3 className="h-12 w-12 text-green-600 opacity-50" />
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                {totalAttendance} {totalAttendance === 1 ? 'registro' : 'registros'}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Cursos</p>
                  <p className="text-3xl font-bold mt-1">{courseStats.length}</p>
                  <Badge variant="outline" className="mt-2">
                    Activos
                  </Badge>
                </div>
                <GraduationCap className="h-12 w-12 text-blue-600 opacity-50" />
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                En aula virtual
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Contact Information */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Información Personal</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Email</p>
                  <p className="text-sm font-medium">{student.email}</p>
                </div>
              </div>
              {student.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Teléfono</p>
                    <p className="text-sm font-medium">{student.phone}</p>
                  </div>
                </div>
              )}
              {student.birth_date && (
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Fecha de Nacimiento</p>
                    <p className="text-sm font-medium">{format(new Date(student.birth_date), 'dd/MM/yyyy')}</p>
                  </div>
                </div>
              )}
              {student.document_number && (
                <div className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">DNI</p>
                    <p className="text-sm font-medium">{student.document_number}</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Course Performance */}
        <Card>
          <CardHeader>
            <CardTitle>Desempeño por Curso</CardTitle>
            <CardDescription>Resumen de calificaciones y asistencia en cada curso</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Curso</TableHead>
                  <TableHead className="text-center">Promedio</TableHead>
                  <TableHead className="text-center">Tareas</TableHead>
                  <TableHead className="text-center">AD</TableHead>
                  <TableHead className="text-center">A</TableHead>
                  <TableHead className="text-center">B</TableHead>
                  <TableHead className="text-center">C</TableHead>
                  <TableHead className="text-center">Asistencia</TableHead>
                  <TableHead className="text-center">Registros</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {courseStats.map(course => (
                  <TableRow key={course.course_id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{course.course_name}</p>
                        <p className="text-xs text-muted-foreground">{course.course_code}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      {course.total_assignments > 0 ? (
                        <Badge variant={getGradeBadgeVariant(course.average_score)}>
                          {course.average_score.toFixed(1)} - {getGradeLetter(course.average_score)}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">{course.total_assignments}</TableCell>
                    <TableCell className="text-center">
                      <span className="text-green-600 font-medium">{course.ad_count}</span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="text-blue-600 font-medium">{course.a_count}</span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="text-yellow-600 font-medium">{course.b_count}</span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="text-red-600 font-medium">{course.c_count}</span>
                    </TableCell>
                    <TableCell className="text-center">
                      {course.total_attendance_records > 0 ? (
                        <span className="font-medium">{course.attendance_rate.toFixed(1)}%</span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">{course.total_attendance_records}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Detailed Tabs */}
        <Tabs defaultValue="grades" className="space-y-4">
          <TabsList>
            <TabsTrigger value="grades">Calificaciones Detalladas</TabsTrigger>
            <TabsTrigger value="attendance">Asistencia Detallada</TabsTrigger>
          </TabsList>

          <TabsContent value="grades" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Todas las Calificaciones</CardTitle>
                    <CardDescription>Historial completo de tareas calificadas</CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => exportToCSV('grades')}>
                    <Download className="h-4 w-4 mr-2" />
                    Exportar CSV
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {grades.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No hay calificaciones registradas
                    </div>
                  ) : (
                    grades.map((grade, index) => (
                      <Card key={index} className="border-l-4" style={{
                        borderLeftColor: grade.score >= 18 ? '#22c55e' : 
                                        grade.score >= 14 ? '#3b82f6' :
                                        grade.score >= 11 ? '#eab308' : '#ef4444'
                      }}>
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <CardTitle className="text-base">{grade.assignment_title}</CardTitle>
                              <CardDescription>
                                {grade.course_name} ({grade.course_code})
                              </CardDescription>
                            </div>
                            <Badge variant={getGradeBadgeVariant(grade.score)} className="text-lg px-3 py-1">
                              {grade.score} - {getGradeLetter(grade.score)}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Puntuación</span>
                            <span className="font-medium">{grade.score} / {grade.max_score}</span>
                          </div>
                          <Progress value={(grade.score / grade.max_score) * 100} className="h-2" />
                          <div className="flex justify-between text-sm pt-2">
                            <span className="text-muted-foreground">Calificado</span>
                            <span>{format(new Date(grade.graded_at), "d 'de' MMMM yyyy 'a las' HH:mm", { locale: es })}</span>
                          </div>
                          {grade.feedback && (
                            <div className="pt-2 border-t">
                              <p className="text-sm font-medium mb-1">Retroalimentación del Profesor:</p>
                              <p className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">{grade.feedback}</p>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="attendance" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Registro de Asistencia</CardTitle>
                    <CardDescription>Historial completo de asistencia</CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => exportToCSV('attendance')}>
                    <Download className="h-4 w-4 mr-2" />
                    Exportar CSV
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {attendance.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No hay registros de asistencia
                    </div>
                  ) : (
                    attendance.map((record, index) => (
                      <Card key={index}>
                        <CardContent className="py-4">
                          <div className="flex items-center justify-between">
                            <div className="space-y-1 flex-1">
                              <div className="flex items-center gap-2">
                                {getAttendanceIcon(record.status)}
                                <span className="font-medium">{getAttendanceLabel(record.status)}</span>
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {record.course_name} ({record.course_code})
                              </p>
                              {record.notes && (
                                <p className="text-sm text-muted-foreground italic">
                                  📝 {record.notes}
                                </p>
                              )}
                              {record.recorded_at && (
                                <p className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  Registrado: {format(new Date(record.recorded_at), "d MMM yyyy 'a las' HH:mm", { locale: es })}
                                </p>
                              )}
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-medium">
                                {format(new Date(record.date), "EEEE", { locale: es })}
                              </p>
                              <p className="text-lg font-bold">
                                {format(new Date(record.date), 'd MMM', { locale: es })}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {format(new Date(record.date), 'yyyy', { locale: es })}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
