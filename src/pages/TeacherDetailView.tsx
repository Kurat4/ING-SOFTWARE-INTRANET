import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  ArrowLeft, Mail, Phone, Calendar, BookOpen, Award, TrendingUp,
  BarChart3, CheckCircle2, Clock, FileText, AlertCircle,
  Download, User, GraduationCap, TrendingDown, Users,
  Flag, ClipboardList, FileCheck, Activity, Target
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
  Cell,
  ResponsiveContainer,
} from 'recharts';

interface TeacherProfile {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  is_active: boolean;
  created_at: string;
}

interface TeacherMetrics {
  total_courses: number;
  active_courses: number;
  total_assignments: number;
  published_assignments: number;
  pending_grading: number;
  graded_submissions: number;
  total_exams: number;
  attendance_records: number;
  total_students: number;
  average_grade: number;
  grading_rate: number;
}

interface GradeDistribution {
  grade: string;
  count: number;
  percentage: number;
  color: string;
}

interface ActivityTimeline {
  date: string;
  assignments: number;
  gradings: number;
  attendance: number;
}

interface CourseDetail {
  course_id: string;
  course_name: string;
  course_code: string;
  student_count: number;
  assignment_count: number;
  average_score: number;
  attendance_rate: number;
  pending_grading: number;
}

interface StudentPerformance {
  student_id: string;
  student_name: string;
  student_code: string;
  average_score: number;
  total_assignments: number;
  attendance_rate: number;
  grade_level: string;
}

interface MonthlyTrend {
  month: string;
  assignments: number;
  gradings: number;
  average_score: number;
}

const GRADE_COLORS = {
  AD: '#10b981', // green
  A: '#3b82f6',  // blue
  B: '#f59e0b',  // yellow/orange
  C: '#ef4444',  // red
};

// Convert letter grades to numeric scores
const convertLetterGrade = (score: string | number): number => {
  if (typeof score === 'number') return score;
  if (!score) return 0;
  
  const scoreStr = String(score).toUpperCase().trim();
  
  // Try parsing as number first
  const numericScore = Number(scoreStr);
  if (!isNaN(numericScore)) return numericScore;
  
  // Letter grade conversion
  const letterGrades: { [key: string]: number } = {
    'AD': 19,   // 18-20
    'A': 16,    // 14-17
    'B': 12,    // 11-13
    'C': 10     // 0-10
  };
  
  return letterGrades[scoreStr] || 0;
};

export default function TeacherDetailView() {
  const { teacherId } = useParams<{ teacherId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [teacher, setTeacher] = useState<TeacherProfile | null>(null);
  const [metrics, setMetrics] = useState<TeacherMetrics | null>(null);
  const [gradeDistribution, setGradeDistribution] = useState<GradeDistribution[]>([]);
  const [activityTimeline, setActivityTimeline] = useState<ActivityTimeline[]>([]);
  const [courses, setCourses] = useState<CourseDetail[]>([]);
  const [students, setStudents] = useState<StudentPerformance[]>([]);
  const [monthlyTrends, setMonthlyTrends] = useState<MonthlyTrend[]>([]);
  const [currentStudentPage, setCurrentStudentPage] = useState(1);
  const studentsPerPage = 25;

  useEffect(() => {
    if (teacherId) {
      fetchTeacherData();
    }
  }, [teacherId]);

  const fetchTeacherData = async () => {
    try {
      setLoading(true);

      // Fetch teacher profile
      const { data: teacherData, error: teacherError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', teacherId)
        .single();

      if (teacherError) throw teacherError;
      setTeacher(teacherData);

      // Fetch all courses taught by this teacher
      const { data: coursesData, error: coursesError } = await supabase
        .from('courses')
        .select('id, name, code')
        .eq('teacher_id', teacherId);

      if (coursesError) throw coursesError;

      const courseIds = coursesData?.map(c => c.id) || [];

      console.log('Teacher ID:', teacherId);
      console.log('Course IDs:', courseIds);

      // First, get all assignments
      const { data: allAssignments } = await supabase
        .from('assignments')
        .select('id, is_published, course_id, created_at')
        .in('course_id', courseIds);

      const assignmentIds = allAssignments?.map(a => a.id) || [];
      
      console.log('Total assignments:', allAssignments?.length);

      // Then get ALL submissions in ONE query
      let allSubmissions: any[] = [];
      if (assignmentIds.length > 0) {
        const { data: submissionsData, error: submissionsError } = await supabase
          .from('assignment_submissions')
          .select('id, assignment_id, student_id, score, graded_at, submitted_at')
          .in('assignment_id', assignmentIds);
        
        console.log('Submissions error:', submissionsError);
        console.log('Total submissions fetched:', submissionsData?.length);
        
        allSubmissions = submissionsData || [];
      }

      // Fetch metrics in parallel - now passing pre-fetched data
      await Promise.all([
        fetchMetrics(courseIds, allAssignments || [], allSubmissions),
        fetchGradeDistribution(allSubmissions),
        fetchActivityTimeline(courseIds, allAssignments || [], allSubmissions),
        fetchCourseDetails(coursesData || [], allAssignments || [], allSubmissions),
        fetchStudentPerformance(courseIds, assignmentIds, allSubmissions),
        fetchMonthlyTrends(allAssignments || [], allSubmissions),
      ]);

    } catch (error: any) {
      console.error('Error fetching teacher data:', error);
      toast.error('Error al cargar datos del profesor');
    } finally {
      setLoading(false);
    }
  };

  const fetchMetrics = async (courseIds: string[], assignments: any[], submissions: any[]) => {
    if (courseIds.length === 0) {
      setMetrics({
        total_courses: 0,
        active_courses: 0,
        total_assignments: 0,
        published_assignments: 0,
        pending_grading: 0,
        graded_submissions: 0,
        total_exams: 0,
        attendance_records: 0,
        total_students: 0,
        average_grade: 0,
        grading_rate: 0,
      });
      return;
    }

    const publishedCount = assignments.filter(a => a.is_published).length;

    console.log('Total submissions:', submissions.length);
    console.log('Submissions with score:', submissions.filter(s => s.score !== null && s.score !== undefined).length);

    const gradedCount = submissions.filter(s => s.score !== null && s.score !== undefined && s.score !== '').length;
    const pendingCount = submissions.filter(s => s.submitted_at && (!s.score || s.score === null || s.score === '')).length;

    console.log('Graded count:', gradedCount);
    console.log('Pending count:', pendingCount);

    // Calculate average grade
    const scores = submissions
      .filter(s => s.score !== null && s.score !== undefined && s.score !== '')
      .map(s => {
        const score = convertLetterGrade(s.score);
        console.log('Processing score:', s.score, '-> Number:', score);
        return score;
      })
      .filter(s => s > 0);
    
    console.log('Valid scores for average:', scores);
    const avgGrade = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    console.log('Average grade:', avgGrade);

    // Get exams
    const { data: exams } = await supabase
      .from('exams')
      .select('id')
      .in('course_id', courseIds);

    // Get attendance records
    const { data: attendance } = await supabase
      .from('attendance')
      .select('id')
      .in('course_id', courseIds)
      .eq('recorded_by', teacherId);

    // Get unique students count using direct SQL query via rpc
    // This bypasses RLS restrictions that prevent directivos from seeing enrollments
    console.log('Getting student count for teacher:', teacherId);
    
    let uniqueStudents = 0;
    
    const { data: studentCountResult, error: studentCountError } = await supabase
      .rpc('get_teacher_student_count', { teacher_id: teacherId });

    if (studentCountError) {
      console.error('RPC error (will calculate manually):', studentCountError);
      // Fallback: calculate manually if RPC not available yet
      const { data: coursesForCount } = await supabase
        .from('courses')
        .select('id')
        .eq('teacher_id', teacherId);
      
      if (coursesForCount && coursesForCount.length > 0) {
        const courseIdsForCount = coursesForCount.map(c => c.id);
        const { data: enrollments } = await supabase
          .from('course_enrollments')
          .select('student_id')
          .in('course_id', courseIdsForCount);
        
        uniqueStudents = new Set(enrollments?.map(e => e.student_id) || []).size;
        console.log('Student count (fallback method):', uniqueStudents);
      } else {
        uniqueStudents = 0;
      }
    } else {
      uniqueStudents = studentCountResult || 0;
      console.log('Student count from RPC:', uniqueStudents);
    }

    // Get active courses
    const { data: activeCourses } = await supabase
      .from('courses')
      .select('id')
      .eq('teacher_id', teacherId)
      .eq('is_active', true);

    setMetrics({
      total_courses: courseIds.length,
      active_courses: activeCourses?.length || 0,
      total_assignments: assignments?.length || 0,
      published_assignments: publishedCount,
      pending_grading: pendingCount,
      graded_submissions: gradedCount,
      total_exams: exams?.length || 0,
      attendance_records: attendance?.length || 0,
      total_students: uniqueStudents,
      average_grade: avgGrade,
      grading_rate: submissions.length ? (gradedCount / submissions.length) * 100 : 0,
    });
  };

  const fetchGradeDistribution = async (submissions: any[]) => {
    if (submissions.length === 0) {
      setGradeDistribution([]);
      return;
    }

    const grades = { AD: 0, A: 0, B: 0, C: 0 };
    submissions.forEach(s => {
      // Only count if score exists and is not null
      if (s.score === null || s.score === undefined) return;
      
      const score = convertLetterGrade(s.score);
      if (score === 0) return;
      
      if (score >= 18) grades.AD++;
      else if (score >= 14) grades.A++;
      else if (score >= 11) grades.B++;
      else grades.C++;
    });

    const total = Object.values(grades).reduce((a, b) => a + b, 0);
    const distribution: GradeDistribution[] = Object.entries(grades).map(([grade, count]) => ({
      grade,
      count,
      percentage: total > 0 ? (count / total) * 100 : 0,
      color: GRADE_COLORS[grade as keyof typeof GRADE_COLORS],
    }));

    setGradeDistribution(distribution);
  };

  const fetchActivityTimeline = async (courseIds: string[], assignments: any[], submissions: any[]) => {
    if (courseIds.length === 0) {
      setActivityTimeline([]);
      return;
    }

    const last30Days = new Date();
    last30Days.setDate(last30Days.getDate() - 30);

    // Filter assignments created in last 30 days
    const recentAssignments = assignments.filter(a => 
      a.created_at && new Date(a.created_at) >= last30Days
    );

    // Filter gradings in last 30 days
    const gradings = submissions.filter(s => 
      s.graded_at && new Date(s.graded_at) >= last30Days
    );

    // Get attendance records in last 30 days
    const { data: attendance } = await supabase
      .from('attendance')
      .select('date')
      .in('course_id', courseIds)
      .eq('recorded_by', teacherId)
      .gte('date', last30Days.toISOString());

    // Group by date
    const dateMap = new Map<string, { assignments: number; gradings: number; attendance: number }>();

    recentAssignments.forEach(a => {
      const date = format(new Date(a.created_at), 'yyyy-MM-dd');
      const current = dateMap.get(date) || { assignments: 0, gradings: 0, attendance: 0 };
      dateMap.set(date, { ...current, assignments: current.assignments + 1 });
    });

    gradings.forEach(g => {
      const date = format(new Date(g.graded_at), 'yyyy-MM-dd');
      const current = dateMap.get(date) || { assignments: 0, gradings: 0, attendance: 0 };
      dateMap.set(date, { ...current, gradings: current.gradings + 1 });
    });

    attendance?.forEach(a => {
      const date = format(new Date(a.date), 'yyyy-MM-dd');
      const current = dateMap.get(date) || { assignments: 0, gradings: 0, attendance: 0 };
      dateMap.set(date, { ...current, attendance: current.attendance + 1 });
    });

    // Convert to array and sort by date
    const timeline = Array.from(dateMap.entries())
      .map(([date, data]) => ({
        date: format(new Date(date), 'dd MMM', { locale: es }),
        ...data,
      }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-14); // Last 14 days for better visualization

    setActivityTimeline(timeline);
  };

  const fetchCourseDetails = async (coursesData: any[], allAssignments: any[], allSubmissions: any[]) => {
    const courseDetails = await Promise.all(
      coursesData.map(async (course) => {
        // Get students enrolled using RPC to bypass RLS
        const { data: studentCount } = await supabase
          .rpc('get_course_student_count', { p_course_id: course.id });

        const enrollmentCount = studentCount || 0;

        // Filter assignments for this course
        const assignments = allAssignments.filter(a => a.course_id === course.id);
        const assignmentIds = assignments.map(a => a.id);

        // Filter submissions for this course's assignments
        const submissions = allSubmissions.filter(s => assignmentIds.includes(s.assignment_id));

        const scores = submissions
          .filter(s => s.score !== null && s.score !== undefined)
          .map(s => convertLetterGrade(s.score))
          .filter(s => s > 0);
        const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;

        const pendingGrading = submissions.filter(s => s.submitted_at && (!s.score || s.score === null)).length;

        // Get attendance
        const { data: attendance } = await supabase
          .from('attendance')
          .select('status')
          .eq('course_id', course.id);

        const presentCount = attendance?.filter(a => a.status === 'present').length || 0;
        const totalAttendance = attendance?.length || 0;
        const attendanceRate = totalAttendance > 0 ? (presentCount / totalAttendance) * 100 : 0;

        return {
          course_id: course.id,
          course_name: course.name,
          course_code: course.code,
          student_count: enrollmentCount,
          assignment_count: assignments?.length || 0,
          average_score: avgScore,
          attendance_rate: attendanceRate,
          pending_grading: pendingGrading,
        };
      })
    );

    setCourses(courseDetails);
  };

  const fetchStudentPerformance = async (courseIds: string[], assignmentIds: string[], allSubmissions: any[]) => {
    if (courseIds.length === 0) {
      setStudents([]);
      return;
    }

    // Get all students using RPC to bypass RLS
    const { data: studentsData, error: studentsError } = await supabase
      .rpc('get_teacher_students', { p_teacher_id: teacherId });

    console.log('Students from RPC:', studentsData?.length);
    console.log('Students error:', studentsError);

    if (!studentsData || studentsData.length === 0) {
      console.log('No students found');
      setStudents([]);
      return;
    }

    // Get student performance
    const studentPerformance = await Promise.all(
      studentsData.map(async (student) => {

        // Filter submissions for this student
        const submissions = allSubmissions.filter(s => s.student_id === student.student_id);

        const scores = submissions
          .filter(s => s.score !== null && s.score !== undefined)
          .map(s => convertLetterGrade(s.score))
          .filter(s => s > 0);
        const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;

        // Get attendance
        const { data: attendance } = await supabase
          .from('attendance')
          .select('status')
          .eq('student_id', student.student_id)
          .in('course_id', courseIds);

        const presentCount = attendance?.filter(a => a.status === 'present').length || 0;
        const totalAttendance = attendance?.length || 0;
        const attendanceRate = totalAttendance > 0 ? (presentCount / totalAttendance) * 100 : 0;

        let gradeLevel = 'C';
        if (avgScore >= 18) gradeLevel = 'AD';
        else if (avgScore >= 14) gradeLevel = 'A';
        else if (avgScore >= 11) gradeLevel = 'B';

        return {
          student_id: student.student_id,
          student_name: student.student_name,
          student_code: student.student_code,
          average_score: avgScore,
          total_assignments: submissions?.length || 0,
          attendance_rate: attendanceRate,
          grade_level: gradeLevel,
        };
      })
    );

    setStudents(studentPerformance.sort((a, b) => b.average_score - a.average_score));
  };

  const fetchMonthlyTrends = async (assignments: any[], allSubmissions: any[]) => {
    if (assignments.length === 0) {
      setMonthlyTrends([]);
      return;
    }

    const last6Months = new Date();
    last6Months.setMonth(last6Months.getMonth() - 6);

    // Filter assignments from last 6 months
    const recentAssignments = assignments.filter(a => 
      a.created_at && new Date(a.created_at) >= last6Months
    );

    const assignmentIds = recentAssignments.map(a => a.id);

    // Filter submissions from last 6 months for these assignments
    const submissions = allSubmissions.filter(s => 
      assignmentIds.includes(s.assignment_id) &&
      s.graded_at && 
      new Date(s.graded_at) >= last6Months &&
      s.score !== null && 
      s.score !== undefined
    );

    // Group by month
    const monthMap = new Map<string, { assignments: number; gradings: number; scores: number[] }>();

    recentAssignments.forEach(a => {
      const month = format(new Date(a.created_at), 'MMM yyyy', { locale: es });
      const current = monthMap.get(month) || { assignments: 0, gradings: 0, scores: [] };
      monthMap.set(month, { ...current, assignments: current.assignments + 1 });
    });

    submissions.forEach(s => {
      const month = format(new Date(s.graded_at), 'MMM yyyy', { locale: es });
      const current = monthMap.get(month) || { assignments: 0, gradings: 0, scores: [] };
      const score = convertLetterGrade(s.score);
      if (score > 0) {
        current.scores.push(score);
      }
      monthMap.set(month, { ...current, gradings: current.gradings + 1 });
    });

    // Convert to array
    const trends = Array.from(monthMap.entries())
      .map(([month, data]) => ({
        month,
        assignments: data.assignments,
        gradings: data.gradings,
        average_score: data.scores.length > 0 ? data.scores.reduce((a, b) => a + b, 0) / data.scores.length : 0,
      }))
      .slice(-6);

    setMonthlyTrends(trends);
  };

  const handleExport = () => {
    if (!teacher || !metrics) return;

    const csvContent = [
      ['Reporte de Profesor'],
      [''],
      ['Información General'],
      ['Nombre', `${teacher.first_name} ${teacher.last_name}`],
      ['Email', teacher.email],
      ['Estado', teacher.is_active ? 'Activo' : 'Inactivo'],
      [''],
      ['Métricas'],
      ['Cursos Totales', metrics.total_courses],
      ['Cursos Activos', metrics.active_courses],
      ['Tareas Totales', metrics.total_assignments],
      ['Tareas Publicadas', metrics.published_assignments],
      ['Pendientes de Calificar', metrics.pending_grading],
      ['Calificadas', metrics.graded_submissions],
      ['Exámenes Creados', metrics.total_exams],
      ['Registros de Asistencia', metrics.attendance_records],
      ['Estudiantes Totales', metrics.total_students],
      ['Promedio General', metrics.average_grade.toFixed(2)],
      ['Tasa de Calificación', `${metrics.grading_rate.toFixed(1)}%`],
    ]
      .map(row => row.join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `profesor_${teacher.last_name}_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();

    toast.success('Reporte exportado exitosamente');
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  if (!teacher) {
    return (
      <DashboardLayout>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            No se encontró información del profesor.
          </AlertDescription>
        </Alert>
        <Button onClick={() => navigate('/directivo-dashboard')} className="mt-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver al Dashboard
        </Button>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/directivo-dashboard')}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold">
                {teacher.first_name} {teacher.last_name}
              </h1>
              <p className="text-muted-foreground">{teacher.email}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Badge variant={teacher.is_active ? 'default' : 'secondary'}>
              {teacher.is_active ? 'Activo' : 'Inactivo'}
            </Badge>
            <Button onClick={handleExport} variant="outline" size="sm">
              <Download className="mr-2 h-4 w-4" />
              Exportar
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        {metrics && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Cursos Activos</CardTitle>
                <BookOpen className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics.active_courses}</div>
                <p className="text-xs text-muted-foreground">
                  de {metrics.total_courses} totales
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Estudiantes</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics.total_students}</div>
                <p className="text-xs text-muted-foreground">
                  en todos los cursos
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Promedio General</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics.average_grade.toFixed(1)}</div>
                <p className="text-xs text-muted-foreground">
                  de 20 puntos
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pendientes</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics.pending_grading}</div>
                <p className="text-xs text-muted-foreground">
                  tareas por calificar
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Contact Info Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Información de Contacto
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{teacher.email}</span>
              </div>
              {teacher.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{teacher.phone}</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">
                  Miembro desde {format(new Date(teacher.created_at), 'dd MMM yyyy', { locale: es })}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Detailed Tabs */}
        <Tabs defaultValue="performance" className="space-y-4">
          <TabsList>
            <TabsTrigger value="performance">
              <Award className="mr-2 h-4 w-4" />
              Rendimiento
            </TabsTrigger>
            <TabsTrigger value="activity">
              <Activity className="mr-2 h-4 w-4" />
              Actividad
            </TabsTrigger>
            <TabsTrigger value="courses">
              <BookOpen className="mr-2 h-4 w-4" />
              Cursos
            </TabsTrigger>
            <TabsTrigger value="students">
              <GraduationCap className="mr-2 h-4 w-4" />
              Estudiantes
            </TabsTrigger>
            <TabsTrigger value="trends">
              <TrendingUp className="mr-2 h-4 w-4" />
              Tendencias
            </TabsTrigger>
          </TabsList>

          {/* Performance Tab */}
          <TabsContent value="performance" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              {/* Grade Distribution Pie Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>Distribución de Calificaciones</CardTitle>
                  <CardDescription>
                    Porcentaje de calificaciones por nivel
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {gradeDistribution.length > 0 ? (
                    <ChartContainer
                      config={{
                        AD: { label: 'AD (18-20)', color: GRADE_COLORS.AD },
                        A: { label: 'A (14-17)', color: GRADE_COLORS.A },
                        B: { label: 'B (11-13)', color: GRADE_COLORS.B },
                        C: { label: 'C (0-10)', color: GRADE_COLORS.C },
                      }}
                      className="h-[300px]"
                    >
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={gradeDistribution}
                            dataKey="count"
                            nameKey="grade"
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={90}
                            label={({ grade, percentage }) => `${grade}: ${percentage.toFixed(1)}%`}
                          >
                            {gradeDistribution.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <ChartTooltip content={<ChartTooltipContent />} />
                        </PieChart>
                      </ResponsiveContainer>
                    </ChartContainer>
                  ) : (
                    <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                      No hay datos de calificaciones disponibles
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Grade Statistics */}
              <Card>
                <CardHeader>
                  <CardTitle>Estadísticas de Calificación</CardTitle>
                  <CardDescription>
                    Detalle numérico por nivel de logro
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {gradeDistribution.map((dist) => (
                    <div key={dist.grade} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: dist.color }}
                          />
                          <span className="text-sm font-medium">{dist.grade}</span>
                          <span className="text-xs text-muted-foreground">
                            ({dist.grade === 'AD' ? '18-20' : dist.grade === 'A' ? '14-17' : dist.grade === 'B' ? '11-13' : '0-10'})
                          </span>
                        </div>
                        <span className="text-sm font-bold">{dist.count}</span>
                      </div>
                      <Progress value={dist.percentage} className="h-2" />
                      <p className="text-xs text-muted-foreground text-right">
                        {dist.percentage.toFixed(1)}%
                      </p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            {/* Additional Metrics */}
            {metrics && (
              <Card>
                <CardHeader>
                  <CardTitle>Métricas de Desempeño</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">Tareas Publicadas</span>
                      </div>
                      <p className="text-2xl font-bold">{metrics.published_assignments}</p>
                      <p className="text-xs text-muted-foreground">
                        de {metrics.total_assignments} creadas
                      </p>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">Tasa de Calificación</span>
                      </div>
                      <p className="text-2xl font-bold">{metrics.grading_rate.toFixed(1)}%</p>
                      <Progress value={metrics.grading_rate} className="h-2" />
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Target className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">Exámenes Creados</span>
                      </div>
                      <p className="text-2xl font-bold">{metrics.total_exams}</p>
                      <p className="text-xs text-muted-foreground">
                        {metrics.attendance_records} registros de asistencia
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Activity Tab */}
          <TabsContent value="activity" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Actividad Reciente (Últimos 14 días)</CardTitle>
                <CardDescription>
                  Tareas publicadas, calificaciones y registros de asistencia
                </CardDescription>
              </CardHeader>
              <CardContent>
                {activityTimeline.length > 0 ? (
                  <ChartContainer
                    config={{
                      assignments: { label: 'Tareas', color: '#3b82f6' },
                      gradings: { label: 'Calificaciones', color: '#10b981' },
                      attendance: { label: 'Asistencia', color: '#f59e0b' },
                    }}
                    className="h-[300px]"
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={activityTimeline}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Legend />
                        <Area
                          type="monotone"
                          dataKey="assignments"
                          stackId="1"
                          stroke="#3b82f6"
                          fill="#3b82f6"
                          fillOpacity={0.6}
                          name="Tareas"
                        />
                        <Area
                          type="monotone"
                          dataKey="gradings"
                          stackId="1"
                          stroke="#10b981"
                          fill="#10b981"
                          fillOpacity={0.6}
                          name="Calificaciones"
                        />
                        <Area
                          type="monotone"
                          dataKey="attendance"
                          stackId="1"
                          stroke="#f59e0b"
                          fill="#f59e0b"
                          fillOpacity={0.6}
                          name="Asistencia"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                    No hay actividad reciente
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Courses Tab */}
          <TabsContent value="courses" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Cursos Asignados</CardTitle>
                <CardDescription>
                  Detalle de rendimiento por curso
                </CardDescription>
              </CardHeader>
              <CardContent>
                {courses.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Curso</TableHead>
                        <TableHead>Código</TableHead>
                        <TableHead className="text-right">Estudiantes</TableHead>
                        <TableHead className="text-right">Tareas</TableHead>
                        <TableHead className="text-right">Promedio</TableHead>
                        <TableHead className="text-right">Asistencia</TableHead>
                        <TableHead className="text-right">Pendientes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {courses.map((course) => (
                        <TableRow key={course.course_id}>
                          <TableCell className="font-medium">{course.course_name}</TableCell>
                          <TableCell>{course.course_code}</TableCell>
                          <TableCell className="text-right">{course.student_count}</TableCell>
                          <TableCell className="text-right">{course.assignment_count}</TableCell>
                          <TableCell className="text-right">
                            <Badge
                              variant={
                                course.average_score >= 14
                                  ? 'default'
                                  : course.average_score >= 11
                                  ? 'secondary'
                                  : 'destructive'
                              }
                            >
                              {course.average_score.toFixed(1)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {course.attendance_rate.toFixed(1)}%
                          </TableCell>
                          <TableCell className="text-right">
                            {course.pending_grading > 0 ? (
                              <Badge variant="outline">{course.pending_grading}</Badge>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No hay cursos asignados
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Course Comparison Chart */}
            {courses.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Comparación entre Cursos</CardTitle>
                  <CardDescription>
                    Promedio de calificaciones por curso
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ChartContainer
                    config={{
                      average_score: { label: 'Promedio', color: '#3b82f6' },
                    }}
                    className="h-[600px]"
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={courses}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          dataKey="course_name" 
                          angle={-45}
                          textAnchor="end"
                          height={120}
                          interval={0}
                        />
                        <YAxis domain={[0, 20]} />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Bar dataKey="average_score" fill="#3b82f6" name="Promedio" />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Students Tab */}
          <TabsContent value="students" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Estudiantes Enseñados</CardTitle>
                <CardDescription>
                  Rendimiento de estudiantes en todos los cursos ({students.length} total)
                </CardDescription>
              </CardHeader>
              <CardContent>
                {students.length > 0 ? (
                  <>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Código</TableHead>
                          <TableHead>Estudiante</TableHead>
                          <TableHead className="text-right">Tareas</TableHead>
                          <TableHead className="text-right">Promedio</TableHead>
                          <TableHead className="text-right">Asistencia</TableHead>
                          <TableHead className="text-right">Nivel</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {students
                          .slice(
                            (currentStudentPage - 1) * studentsPerPage,
                            currentStudentPage * studentsPerPage
                          )
                          .map((student) => (
                            <TableRow key={student.student_id}>
                              <TableCell>{student.student_code}</TableCell>
                              <TableCell className="font-medium">{student.student_name}</TableCell>
                              <TableCell className="text-right">{student.total_assignments}</TableCell>
                              <TableCell className="text-right">
                                {student.average_score.toFixed(1)}
                              </TableCell>
                              <TableCell className="text-right">
                                {student.attendance_rate.toFixed(1)}%
                              </TableCell>
                              <TableCell className="text-right">
                                <Badge
                                  style={{
                                    backgroundColor: GRADE_COLORS[student.grade_level as keyof typeof GRADE_COLORS],
                                  }}
                                >
                                  {student.grade_level}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                    
                    {/* Pagination Controls */}
                    {students.length > studentsPerPage && (
                      <div className="flex items-center justify-between mt-4">
                        <div className="text-sm text-muted-foreground">
                          Mostrando {((currentStudentPage - 1) * studentsPerPage) + 1} - {Math.min(currentStudentPage * studentsPerPage, students.length)} de {students.length} estudiantes
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentStudentPage(prev => Math.max(1, prev - 1))}
                            disabled={currentStudentPage === 1}
                          >
                            Anterior
                          </Button>
                          <div className="flex items-center gap-2 px-3">
                            <span className="text-sm">
                              Página {currentStudentPage} de {Math.ceil(students.length / studentsPerPage)}
                            </span>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentStudentPage(prev => Math.min(Math.ceil(students.length / studentsPerPage), prev + 1))}
                            disabled={currentStudentPage >= Math.ceil(students.length / studentsPerPage)}
                          >
                            Siguiente
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No hay estudiantes registrados
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Trends Tab */}
          <TabsContent value="trends" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Tendencias Mensuales</CardTitle>
                <CardDescription>
                  Evolución de actividad y rendimiento en los últimos 6 meses
                </CardDescription>
              </CardHeader>
              <CardContent>
                {monthlyTrends.length > 0 ? (
                  <ChartContainer
                    config={{
                      assignments: { label: 'Tareas Creadas', color: '#3b82f6' },
                      gradings: { label: 'Calificaciones', color: '#10b981' },
                      average_score: { label: 'Promedio', color: '#f59e0b' },
                    }}
                    className="h-[300px]"
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={monthlyTrends}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis yAxisId="left" />
                        <YAxis yAxisId="right" orientation="right" domain={[0, 20]} />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Legend />
                        <Line
                          yAxisId="left"
                          type="monotone"
                          dataKey="assignments"
                          stroke="#3b82f6"
                          strokeWidth={2}
                          name="Tareas"
                        />
                        <Line
                          yAxisId="left"
                          type="monotone"
                          dataKey="gradings"
                          stroke="#10b981"
                          strokeWidth={2}
                          name="Calificaciones"
                        />
                        <Line
                          yAxisId="right"
                          type="monotone"
                          dataKey="average_score"
                          stroke="#f59e0b"
                          strokeWidth={2}
                          name="Promedio"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                    No hay datos suficientes para mostrar tendencias
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
