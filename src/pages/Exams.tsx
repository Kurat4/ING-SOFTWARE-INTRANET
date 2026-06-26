import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ClipboardList, Calendar, Clock, Plus, AlertCircle, XCircle, CheckCircle, Search } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format, isAfter, isBefore, addMinutes } from 'date-fns';
import { es } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useExamMonitor } from '@/hooks/useExamMonitor';
import { parsePeruDateToUserTimezone, getUserTimezone } from '@/lib/timezoneUtils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// Helper para parsear fechas convirtiendo de hora Perú a zona del usuario
const parseExamDate = (dateString: string): Date => {
  return parsePeruDateToUserTimezone(dateString);
};

interface Exam {
  id: string;
  title: string;
  description: string;
  start_time: string;
  duration_minutes: number;
  max_score: number;
  modulo_id: string;
  source: 'exam' | 'weekly_resource';
  modulo: {
    id: string;
    name: string;
    course_id: string;
    course: {
      id: string;
      name: string;
      code: string;
    } | null;
  };
  submission?: {
    score: string;  // Ahora es texto (AD, A, B, C)
    answers: any;
    submitted_at: string;
  } | null;
}

const Exams = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeExam, setActiveExam] = useState<string | null>(null);
  const [showClosedDialog, setShowClosedDialog] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [courseFilter, setCourseFilter] = useState<string>('all');

  const { abandonCount, maxAbandonAttempts } = useExamMonitor({
    examId: activeExam || '',
    isActive: !!activeExam,
    onExamClosed: () => {
      setShowClosedDialog(true);
      setActiveExam(null);
    },
    userId: profile?.id || '',
  });

  const checkExamSubmission = async (examId: string, quizTitle: string, moduloId: string) => {
    if (!profile?.id) return null;

    // Find quiz by exam title
    const { data: quizData } = await supabase
      .from('quizzes')
      .select('id')
      .eq('modulo_id', moduloId)
      .eq('title', quizTitle)
      .maybeSingle();

    if (!quizData) return null;

    // Check if already submitted
    const { data: submission } = await supabase
      .from('quiz_submissions')
      .select('score, answers, submitted_at')
      .eq('quiz_id', quizData.id)
      .eq('student_id', profile.id)
      .maybeSingle();

    return submission;
  };

  useEffect(() => {
    fetchExams();
  }, [profile]);

  const fetchExams = async () => {
    if (!profile) return;

    try {
      // Fetch from exams table
      const { data: examsData, error: examsError } = await supabase
        .from('exams')
        .select(`
          *,
          modulo:modulos (
            id,
            name,
            course_id,
            course:courses (
              id,
              name,
              code
            )
          )
        `)
        .eq('is_published', true)
        .order('start_time', { ascending: true });

      if (examsError) throw examsError;

      // Combine exams and check submissions for students
      const combinedExams: Exam[] = await Promise.all([
        ...(examsData || []).map(async exam => {
          const submission = profile?.role === 'student' 
            ? await checkExamSubmission(exam.id, exam.title, exam.modulo_id)
            : null;
          
          return {
            id: exam.id,
            title: exam.title,
            description: exam.description || '',
            start_time: exam.start_time,
            duration_minutes: exam.duration_minutes,
            max_score: exam.max_score,
            modulo_id: exam.modulo_id,
            source: 'exam' as const,
            modulo: exam.modulo,
            submission
          };
        })
      ]);

      const sortedExams = combinedExams.sort((a, b) => 
        parseExamDate(a.start_time).getTime() - parseExamDate(b.start_time).getTime()
      );

      setExams(sortedExams);
    } catch (error) {
      console.error('Error fetching exams:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los exámenes",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getExamStatus = (exam: Exam) => {
    const now = new Date();
    const startTime = parseExamDate(exam.start_time);
    const endTime = addMinutes(startTime, exam.duration_minutes);

    if (isAfter(now, endTime)) {
      return {
        status: 'completed',
        label: 'Finalizado',
        variant: 'secondary' as const,
        color: 'text-muted-foreground'
      };
    }

    if (isBefore(now, startTime)) {
      return {
        status: 'upcoming',
        label: 'Próximo',
        variant: 'default' as const,
        color: 'text-primary'
      };
    }

    return {
      status: 'in-progress',
      label: 'En progreso',
      variant: 'destructive' as const,
      color: 'text-destructive'
    };
  };

  // Get unique courses for filter
  const uniqueCourses = Array.from(
    new Map(
      exams
        .filter(e => e.modulo?.course_id)
        .map(e => [e.modulo.course_id, e.modulo])
    ).values()
  );

  // Apply filters
  const filteredExams = exams.filter(exam => {
    const matchesSearch = exam.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         exam.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         exam.modulo?.name?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCourse = courseFilter === 'all' || exam.modulo?.course_id === courseFilter;
    
    const status = getExamStatus(exam).status;
    const matchesStatus = statusFilter === 'all' || status === statusFilter;

    return matchesSearch && matchesCourse && matchesStatus;
  });

  if (loading) {
    return (
      <DashboardLayout>
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold text-foreground">Exámenes</h1>
          </div>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
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
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-foreground">Exámenes</h1>
          {profile?.role === 'teacher' && (
            <Button className="bg-gradient-primary shadow-glow">
              <Plus className="w-4 h-4 mr-2" />
              Crear Examen
            </Button>
          )}
        </div>

        {/* Search and Filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar exámenes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <Select value={courseFilter} onValueChange={setCourseFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Todos los cursos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los cursos</SelectItem>
              {uniqueCourses.map(modulo => (
                <SelectItem key={modulo.course_id} value={modulo.course_id}>
                  {modulo.name} {modulo.course ? `- ${modulo.course.name}` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Todos los estados" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              <SelectItem value="upcoming">Próximo</SelectItem>
              <SelectItem value="in-progress">En progreso</SelectItem>
              <SelectItem value="completed">Finalizado</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {filteredExams.length === 0 ? (
          <Card className="bg-gradient-card shadow-card border-0">
            <CardContent className="p-8 text-center">
              <ClipboardList className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">
                No hay exámenes disponibles
              </h3>
              <p className="text-muted-foreground">
                {searchTerm || courseFilter !== 'all' || statusFilter !== 'all'
                  ? 'No se encontraron exámenes con los filtros aplicados.'
                  : profile?.role === 'student' 
                    ? 'No tienes exámenes programados en este momento.'
                    : 'Aún no has creado ningún examen para tus cursos.'
                }
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredExams.map((exam) => {
              const status = getExamStatus(exam);
              
              return (
                <Card key={`${exam.source}-${exam.id}`} className="bg-gradient-card shadow-card border-0 hover:shadow-glow transition-all duration-300">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <CardTitle className="text-lg font-semibold text-foreground">
                            {exam.title}
                          </CardTitle>
                          <Badge variant={status.variant} className="text-xs">
                            {status.label}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                          <Badge variant="secondary" className="text-xs">
                            Módulo
                          </Badge>
                          <span>{exam.modulo.name}</span>
                          {exam.modulo.course && (
                            <>
                              <span className="text-xs">•</span>
                              <Badge variant="outline" className="text-xs">
                                {exam.modulo.course.name}
                              </Badge>
                            </>
                          )}
                        </div>
                      </div>
                      <ClipboardList className="w-6 h-6 text-primary" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                      {exam.description || 'Sin descripción disponible'}
                    </p>
                    
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          <span>
                            {format(parseExamDate(exam.start_time), "d 'de' MMMM, yyyy", { locale: es })}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          <span>
                            {format(parseExamDate(exam.start_time), "HH:mm")} ({exam.duration_minutes} min)
                          </span>
                        </div>
                      </div>
                      
                      <div className="text-sm font-medium text-foreground">
                        {exam.max_score} pts
                      </div>
                    </div>

                    {status.status === 'in-progress' && (
                      <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 mb-4">
                        <AlertCircle className="w-4 h-4 text-destructive" />
                        <span className="text-sm text-destructive font-medium">
                          ¡El examen está en progreso!
                        </span>
                      </div>
                    )}

                    <div className="flex gap-2">
                      <Button 
                        className="flex-1" 
                        variant="outline"
                        asChild
                      >
                        <Link to={`/courses/${exam.modulo_id}`}>
                          Ver Módulo
                        </Link>
                      </Button>
                      
                      {profile?.role === 'student' && (
                        <>
                          {exam.submission ? (
                            <div className="flex-1 space-y-2">
                              <div className="p-3 rounded-lg bg-primary/10 border border-primary/20 text-center">
                                <CheckCircle className="w-5 h-5 text-primary mx-auto mb-1" />
                                <p className="text-sm font-medium text-primary">
                                  Completado - Nota: {exam.submission.score}
                                </p>
                              </div>
                              {(() => {
                                const answers = exam.submission.answers || {};
                                const hasUngradedQuestions = Object.values(answers).some(
                                  (answer: any) => answer.requires_grading === true && answer.points_earned === undefined
                                );
                                
                                return hasUngradedQuestions ? (
                                  <div className="p-2 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center gap-2">
                                    <Clock className="w-4 h-4 text-accent" />
                                    <span className="text-xs font-medium text-accent">
                                      Pendiente de revisión
                                    </span>
                                  </div>
                                ) : (
                                  <div className="p-2 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center gap-2">
                                    <CheckCircle className="w-4 h-4 text-primary" />
                                    <span className="text-xs font-medium text-primary">
                                      Revisado por el profesor
                                    </span>
                                  </div>
                                );
                              })()}
                            </div>
                          ) : (
                            <>
                              {isBefore(new Date(), parseExamDate(exam.start_time)) ? (
                                <div className="flex-1 p-3 rounded-lg bg-muted/50 border border-muted text-center">
                                  <Clock className="w-5 h-5 text-muted-foreground mx-auto mb-1" />
                                  <p className="text-sm font-medium text-muted-foreground">
                                    Disponible: {format(parseExamDate(exam.start_time), "d MMM, HH:mm", { locale: es })}
                                  </p>
                                </div>
                              ) : (
                                <Button 
                                  className="bg-gradient-primary shadow-glow flex-1"
                                  asChild
                                >
                                  <Link to={`/exams/${exam.id}/take`}>
                                    {status.status === 'in-progress' ? 'Iniciar Examen' : 'Ver Examen'}
                                  </Link>
                                </Button>
                              )}
                            </>
                          )}
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <AlertDialog open={showClosedDialog} onOpenChange={setShowClosedDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <XCircle className="w-5 h-5" />
              Examen Cerrado
            </AlertDialogTitle>
            <AlertDialogDescription>
              El examen se ha cerrado automáticamente porque saliste de la página demasiadas veces.
              Esto ha sido registrado en el sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setShowClosedDialog(false)}>
              Entendido
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
};

export default Exams;
