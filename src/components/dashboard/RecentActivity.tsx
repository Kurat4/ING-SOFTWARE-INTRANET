import { useState, useEffect } from "react";
import { CheckCircle, Clock, AlertCircle, FileText, ClipboardList, BookOpen, ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format, formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { parseLocalDate } from "@/lib/dateUtils";

interface Activity {
  id: string;
  title: string;
  subject: string;
  time: string;
  status: 'completed' | 'pending' | 'new' | 'graded';
  icon: any;
  type: 'assignment' | 'exam' | 'grade';
}

const ITEMS_PER_PAGE = 8;

export function RecentActivity() {
  const { profile } = useAuth();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalActivities, setTotalActivities] = useState(0);

  useEffect(() => {
    if (profile?.id) {
      fetchRecentActivity();
    }
  }, [profile, currentPage]);

  const fetchRecentActivity = async () => {
    try {
      setLoading(true);
      const activities: Activity[] = [];

      // Para profesores
      if (profile?.role === 'teacher' || profile?.role === 'admin') {
        await fetchTeacherActivity(activities);
      } else {
        // Para estudiantes
        await fetchStudentActivity(activities);
      }

      // Sort by most recent/urgent
      activities.sort((a, b) => {
        if (a.status === 'pending' && b.status !== 'pending') return -1;
        if (b.status === 'pending' && a.status !== 'pending') return 1;
        return 0;
      });

      setTotalActivities(activities.length);
      const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
      const paginatedActivities = activities.slice(startIndex, startIndex + ITEMS_PER_PAGE);
      setActivities(paginatedActivities);
    } catch (error) {
      console.error('Error fetching recent activity:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTeacherActivity = async (activities: Activity[]) => {
    // Get modulos where teacher is principal or additional
    const { data: modulos } = await supabase
      .from('modulos')
      .select('id, name')
      .or(`teacher_principal_id.eq.${profile!.id},aditional_teachers.cs.{${profile!.id}}`);

    const moduloIds = modulos?.map(m => m.id) || [];

    if (moduloIds.length === 0) return;

    // Get recent submissions to review
    const { data: submissions } = await supabase
      .from('assignment_submissions')
      .select(`
        id,
        submitted_at,
        graded_at,
        assignments!inner(
          title,
          modulo_id,
          modulos!inner(
            name,
            courses!inner(name)
          )
        )
      `)
      .in('assignments.modulo_id', moduloIds)
      .order('submitted_at', { ascending: false })
      .limit(10);

    submissions?.forEach((sub: any) => {
      const courseName = sub.assignments?.modulos?.courses?.name || sub.assignments?.modulos?.name || 'Curso';
      activities.push({
        id: `sub-${sub.id}`,
        title: sub.graded_at
          ? `Tarea calificada: ${sub.assignments.title}`
          : `Nueva entrega: ${sub.assignments.title}`,
        subject: courseName,
        time: formatDistanceToNow(parseLocalDate(sub.submitted_at), { addSuffix: true, locale: es }),
        status: sub.graded_at ? 'graded' : 'pending',
        icon: sub.graded_at ? CheckCircle : AlertCircle,
        type: 'assignment'
      });
    });

    // Get upcoming exams
    const { data: upcomingExams } = await supabase
      .from('exams')
      .select(`
        id,
        title,
        start_time,
        modulo_id,
        modulos!inner(
          name,
          courses!inner(name)
        )
      `)
      .in('modulo_id', moduloIds)
      .eq('is_published', true)
      .gt('start_time', new Date().toISOString())
      .order('start_time', { ascending: true })
      .limit(5);

    upcomingExams?.forEach((exam: any) => {
      const examDate = parseLocalDate(exam.start_time);
      const courseName = exam.modulos?.courses?.name || exam.modulos?.name || 'Curso';
      activities.push({
        id: `exam-${exam.id}`,
        title: `Examen próximo: ${exam.title}`,
        subject: courseName,
        time: format(examDate, "d 'de' MMMM, HH:mm", { locale: es }),
        status: 'new',
        icon: ClipboardList,
        type: 'exam'
      });
    });
  };

  const fetchStudentActivity = async (activities: Activity[]) => {
    // Get enrolled modulos
    const { data: enrollments } = await supabase
      .from('course_enrollments')
      .select('modulo_id, modulos!inner(name, courses!inner(name))')
      .eq('student_id', profile!.id);

    const moduloIds = enrollments?.map(e => e.modulo_id) || [];

    if (moduloIds.length === 0) return;

    if (moduloIds.length === 0) return;

    // Get recent assignment submissions (completed)
    const { data: submissions } = await supabase
      .from('assignment_submissions')
      .select(`
        id,
        submitted_at,
        score,
        assignments!inner(
          title,
          modulo_id,
          modulos!inner(
            name,
            courses!inner(name)
          )
        )
      `)
      .eq('student_id', profile!.id)
      .order('submitted_at', { ascending: false })
      .limit(5);

    submissions?.forEach((sub: any) => {
      const courseName = sub.assignments?.modulos?.courses?.name || sub.assignments?.modulos?.name || 'Curso';
      activities.push({
        id: `sub-${sub.id}`,
        title: sub.score !== null
          ? `Tarea calificada: ${sub.assignments.title}`
          : `Tarea entregada: ${sub.assignments.title}`,
        subject: courseName,
        time: formatDistanceToNow(parseLocalDate(sub.submitted_at), { addSuffix: true, locale: es }),
        status: sub.score !== null ? 'graded' : 'completed',
        icon: sub.score !== null ? CheckCircle : FileText,
        type: 'assignment'
      });
    });

    // Get upcoming assignments (pending)
    const { data: upcomingAssignments } = await supabase
      .from('assignments')
      .select(`
        id,
        title,
        due_date,
        modulo_id,
        modulos!inner(
          name,
          courses!inner(name)
        )
      `)
      .in('modulo_id', moduloIds)
      .eq('is_published', true)
      .gt('due_date', new Date().toISOString())
      .order('due_date', { ascending: true })
      .limit(3);

    // Check which ones are not submitted
    const assignmentIds = upcomingAssignments?.map(a => a.id) || [];
    const { data: existingSubmissions } = await supabase
      .from('assignment_submissions')
      .select('assignment_id')
      .eq('student_id', profile!.id)
      .in('assignment_id', assignmentIds);

    const submittedSet = new Set(existingSubmissions?.map(s => s.assignment_id) || []);

    upcomingAssignments?.forEach((assignment: any) => {
      if (!submittedSet.has(assignment.id)) {
        const dueDate = parseLocalDate(assignment.due_date);
        const isUrgent = (dueDate.getTime() - Date.now()) < 24 * 60 * 60 * 1000; // Less than 24 hours
        const courseName = assignment.modulos?.courses?.name || assignment.modulos?.name || 'Curso';

        activities.push({
          id: `assign-${assignment.id}`,
          title: `Tarea pendiente: ${assignment.title}`,
          subject: courseName,
          time: format(dueDate, "d 'de' MMMM, HH:mm", { locale: es }),
          status: isUrgent ? 'pending' : 'new',
          icon: AlertCircle,
          type: 'assignment'
        });
      }
    });

    // Get upcoming exams
    const { data: upcomingExams } = await supabase
      .from('exams')
      .select(`
        id,
        title,
        start_time,
        modulo_id,
        modulos!inner(
          name,
          courses!inner(name)
        )
      `)
      .in('modulo_id', moduloIds)
      .eq('is_published', true)
      .gt('start_time', new Date().toISOString())
      .order('start_time', { ascending: true })
      .limit(3);

    upcomingExams?.forEach((exam: any) => {
      const examDate = parseLocalDate(exam.start_time);
      const courseName = exam.modulos?.courses?.name || exam.modulos?.name || 'Curso';
      activities.push({
        id: `exam-${exam.id}`,
        title: `Examen próximo: ${exam.title}`,
        subject: courseName,
        time: format(examDate, "d 'de' MMMM, HH:mm", { locale: es }),
        status: 'new',
        icon: ClipboardList,
        type: 'exam'
      });
    });
  };

  const totalPages = Math.ceil(totalActivities / ITEMS_PER_PAGE);

  const getStatusConfig = (status: string) => {
    switch (status) {
      case "completed":
        return { 
          variant: "secondary" as const, 
          label: "Completado",
          iconColor: "text-green-500 dark:text-green-400"
        };
      case "graded":
        return { 
          variant: "default" as const, 
          label: "Calificado",
          iconColor: "text-blue-500 dark:text-blue-400"
        };
      case "pending":
        return { 
          variant: "destructive" as const, 
          label: "Urgente",
          iconColor: "text-destructive dark:text-red-400"
        };
      case "new":
        return { 
          variant: "outline" as const, 
          label: "Próximo",
          iconColor: "text-accent dark:text-blue-300"
        };
      default:
        return { 
          variant: "outline" as const, 
          label: "Desconocido",
          iconColor: "text-muted-foreground dark:text-gray-400"
        };
    }
  };

  if (loading) {
    return (
      <Card className="bg-gradient-card dark:bg-gray-800 shadow-card border-0 dark:border dark:border-gray-700">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-foreground dark:text-white">
            Actividad Reciente
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (activities.length === 0) {
    return (
      <Card className="bg-gradient-card dark:bg-gray-800 shadow-card border-0 dark:border dark:border-gray-700">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-foreground dark:text-white">
            Actividad Reciente
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground dark:text-gray-400">
            <AlertCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No hay actividad reciente</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-card dark:bg-gray-800 shadow-card border-0 dark:border dark:border-gray-700">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-foreground dark:text-white">
          Actividad Reciente
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {activities.map((activity) => {
            const Icon = activity.icon;
            const statusConfig = getStatusConfig(activity.status);
            
            return (
              <div key={activity.id} className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 dark:hover:bg-gray-700 transition-colors">
                <div className={`mt-0.5 ${statusConfig.iconColor}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground dark:text-gray-200 truncate">
                    {activity.title}
                  </p>
                  <p className="text-xs text-muted-foreground dark:text-gray-400">
                    {activity.subject}
                  </p>
                  <p className="text-xs text-muted-foreground dark:text-gray-500 mt-1">
                    {activity.time}
                  </p>
                </div>
                <Badge variant={statusConfig.variant} className="text-xs">
                  {statusConfig.label}
                </Badge>
              </div>
            );
          })}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-6 pt-4 border-t border-border/30 dark:border-gray-700">
            <p className="text-sm text-muted-foreground dark:text-gray-400">
              {totalActivities} actividades
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1 || loading}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm text-muted-foreground px-2 py-1">
                {currentPage} / {totalPages}
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages || loading}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}