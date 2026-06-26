import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ArrowLeft, Edit, Eye, Clock, CheckCircle, Users, ClipboardList } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface Submission {
  id: string;
  student_id: string;
  score: string;  // Ahora es texto (AD, A, B, C)
  submitted_at: string;
  answers: Record<string, any>;
  student: {
    first_name: string;
    last_name: string;
    email: string;
  };
  hasUngradedQuestions: boolean;
}

interface Student {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
}

const ExamSubmissionsPage = () => {
  const { examId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const courseId = searchParams.get('courseId');

  const [examTitle, setExamTitle] = useState<string>('');
  const [examMaxScore, setExamMaxScore] = useState<number>(0);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [enrolledStudents, setEnrolledStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (examId && courseId) {
      fetchData();
    }
  }, [examId, courseId]);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Get exam info
      const { data: examData, error: examError } = await supabase
        .from('exams')
        .select('title, max_score, modulo_id, course_id')
        .eq('id', examId)
        .single();

      if (examError) throw examError;
      setExamTitle(examData.title);
      setExamMaxScore(examData.max_score);

      // Find quiz
      const { data: quizData, error: quizError } = await supabase
        .from('quizzes')
        .select('id')
        .eq('modulo_id', examData.modulo_id)
        .eq('title', examData.title)
        .maybeSingle();

      if (quizError) throw quizError;

      // Get all enrolled students
      const { data: enrollments, error: enrollError } = await supabase
        .from('course_enrollments')
        .select(`
          student_id,
          profiles!course_enrollments_student_id_fkey1(
            id,
            first_name,
            last_name,
            email
          )
        `)
        .eq('modulo_id', courseId);

      if (enrollError) throw enrollError;
      
      const students = (enrollments || []).map((e: any) => e.profiles).filter(Boolean);
      setEnrolledStudents(students);

      // Get submissions if quiz exists
      if (quizData) {
        const { data: submissionsData, error: submissionsError } = await supabase
          .from('quiz_submissions')
          .select(`
            id,
            student_id,
            score,
            submitted_at,
            answers,
            student:profiles!quiz_submissions_student_id_fkey (
              first_name,
              last_name,
              email
            )
          `)
          .eq('quiz_id', quizData.id);

        if (submissionsError) throw submissionsError;

        // Check which submissions have ungraded questions
        const submissionsWithStatus = (submissionsData || []).map(sub => {
          const answers = sub.answers as Record<string, any>;
          const hasUngraded = Object.values(answers).some(
            (ans: any) => ans.requires_grading && ans.points_earned === undefined
          );
          
          return {
            ...sub,
            hasUngradedQuestions: hasUngraded
          };
        });

        setSubmissions(submissionsWithStatus as Submission[]);
      } else {
        setSubmissions([]);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Error al cargar las respuestas');
    } finally {
      setLoading(false);
    }
  };

  const getSubmissionStatus = (studentId: string) => {
    const submission = submissions.find(s => s.student_id === studentId);
    
    if (!submission) {
      return {
        status: 'pending',
        label: 'No entregado',
        icon: Clock,
        variant: 'secondary' as const,
      };
    }

    if (submission.hasUngradedQuestions) {
      return {
        status: 'needs_grading',
        label: 'Por calificar',
        icon: Clock,
        variant: 'default' as const,
      };
    }

    return {
      status: 'graded',
      label: 'Calificado',
      icon: CheckCircle,
      variant: 'default' as const,
    };
  };

  const handleGradeStudent = (submissionId: string) => {
    navigate(`/exam-grading/${submissionId}?courseId=${courseId}&examId=${examId}`);
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="p-6 space-y-6">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-1/3"></div>
            <div className="h-64 bg-muted rounded"></div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const submittedCount = submissions.length;
  const gradedCount = submissions.filter(s => !s.hasUngradedQuestions).length;
  const pendingGradingCount = submissions.filter(s => s.hasUngradedQuestions).length;

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="space-y-4">
          <Button
            variant="ghost"
            onClick={() => courseId ? navigate(`/courses/${courseId}`) : navigate(-1)}
            className="-ml-2"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver al curso
          </Button>

          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <ClipboardList className="w-8 h-8 text-primary" />
                <div>
                  <h1 className="text-3xl font-bold text-foreground">{examTitle}</h1>
                  <p className="text-sm text-muted-foreground">Respuestas de estudiantes</p>
                </div>
              </div>
            </div>

            <Card className="bg-gradient-card shadow-card border-0">
              <CardContent className="p-4">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground mb-1">Puntaje Máximo</p>
                  <p className="text-2xl font-bold text-foreground">{examMaxScore} pts</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="bg-gradient-card shadow-card border-0">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Estudiantes</p>
                    <p className="text-2xl font-bold text-foreground">{enrolledStudents.length}</p>
                  </div>
                  <Users className="w-8 h-8 text-primary opacity-50" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-card shadow-card border-0">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Entregados</p>
                    <p className="text-2xl font-bold text-foreground">{submittedCount}</p>
                  </div>
                  <CheckCircle className="w-8 h-8 text-primary opacity-50" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-card shadow-card border-0">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Por Calificar</p>
                    <p className="text-2xl font-bold text-accent">{pendingGradingCount}</p>
                  </div>
                  <Clock className="w-8 h-8 text-accent opacity-50" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-card shadow-card border-0">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Calificados</p>
                    <p className="text-2xl font-bold text-primary">{gradedCount}</p>
                  </div>
                  <CheckCircle className="w-8 h-8 text-primary opacity-50" />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <Separator />

        {/* Students Table */}
        <Card className="bg-gradient-card shadow-card border-0">
          <CardHeader>
            <CardTitle>Listado de Estudiantes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">#</TableHead>
                    <TableHead>Estudiante</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Calificación</TableHead>
                    <TableHead>Fecha de entrega</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {enrolledStudents.map((student, index) => {
                    const submission = submissions.find(s => s.student_id === student.id);
                    const status = getSubmissionStatus(student.id);
                    const StatusIcon = status.icon;

                    return (
                      <TableRow key={student.id}>
                        <TableCell className="font-medium text-muted-foreground">
                          {index + 1}
                        </TableCell>
                        <TableCell className="font-medium">
                          {student.first_name} {student.last_name}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {student.email}
                        </TableCell>
                        <TableCell>
                          <Badge variant={status.variant} className="gap-1">
                            <StatusIcon className="w-3 h-3" />
                            {status.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {submission ? (
                            <div className="flex items-center gap-2">
                              <span className="font-medium">
                                {submission.score}
                              </span>
                              {submission.hasUngradedQuestions && (
                                <Badge variant="secondary" className="text-xs">
                                  Parcial
                                </Badge>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {submission ? (
                            format(new Date(submission.submitted_at), "d/MM/yyyy HH:mm", { locale: es })
                          ) : (
                            '-'
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {submission ? (
                            <Button
                              variant={submission.hasUngradedQuestions ? "default" : "ghost"}
                              size="sm"
                              onClick={() => handleGradeStudent(submission.id)}
                              className={submission.hasUngradedQuestions ? "bg-gradient-primary shadow-glow" : ""}
                            >
                              {submission.hasUngradedQuestions ? (
                                <>
                                  <Edit className="w-4 h-4 mr-2" />
                                  Calificar
                                </>
                              ) : (
                                <>
                                  <Eye className="w-4 h-4 mr-2" />
                                  Ver respuestas
                                </>
                              )}
                            </Button>
                          ) : (
                            <span className="text-sm text-muted-foreground italic">
                              No disponible
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {enrolledStudents.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        No hay estudiantes inscritos en este curso
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default ExamSubmissionsPage;
