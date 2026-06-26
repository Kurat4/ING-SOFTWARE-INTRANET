import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Eye, CheckCircle, Clock, Edit } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface ExamSubmissionsProps {
  examId: string;
  courseId: string;
}

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

export function ExamSubmissions({ examId, courseId }: ExamSubmissionsProps) {
  const navigate = useNavigate();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [enrolledStudents, setEnrolledStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [quizId, setQuizId] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, [examId, courseId]);

  const fetchData = async () => {
    try {
      // Get exam to find quiz
      const { data: examData, error: examError } = await supabase
        .from('exams')
        .select('title, course_id')
        .eq('id', examId)
        .single();

      if (examError) throw examError;

      // Find quiz
      const { data: quizData, error: quizError } = await supabase
        .from('quizzes')
        .select('id')
        .eq('course_id', examData.course_id)
        .eq('title', examData.title)
        .single();

      if (quizError) throw quizError;
      setQuizId(quizData.id);

      // Get all enrolled students
      const { data: enrollments, error: enrollError } = await supabase
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

      if (enrollError) throw enrollError;
      setEnrolledStudents(enrollments || []);

      // Get submissions
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
    } catch (error) {
      console.error('Error fetching submissions:', error);
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
        color: 'text-muted-foreground'
      };
    }

    if (submission.hasUngradedQuestions) {
      return {
        status: 'needs_grading',
        label: 'Por calificar',
        icon: Clock,
        variant: 'default' as const,
        color: 'text-primary'
      };
    }

    return {
      status: 'graded',
      label: 'Calificado',
      icon: CheckCircle,
      variant: 'default' as const,
      color: 'text-primary'
    };
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-1/2"></div>
            <div className="h-4 bg-muted rounded w-3/4"></div>
            <div className="h-4 bg-muted rounded w-2/3"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-card shadow-card border-0">
      <CardHeader>
        <CardTitle>Respuestas de Estudiantes</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Estudiante</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Calificación</TableHead>
                <TableHead>Fecha de entrega</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {enrolledStudents.map((enrollment) => {
                const student = enrollment.student;
                const submission = submissions.find(s => s.student_id === student.id);
                const status = getSubmissionStatus(student.id);
                const StatusIcon = status.icon;

                return (
                  <TableRow key={student.id}>
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
                        <span className="font-medium">
                          {submission.score}
                          {submission.hasUngradedQuestions && (
                            <span className="text-xs text-muted-foreground ml-1">(parcial)</span>
                          )}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {submission ? (
                        format(new Date(submission.submitted_at), "d 'de' MMMM, yyyy 'a las' HH:mm", { locale: es })
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {submission ? (
                        <Button
                          variant={submission.hasUngradedQuestions ? "default" : "ghost"}
                          size="sm"
                          onClick={() => navigate(`/exam-grading/${submission.id}?courseId=${courseId}&examId=${examId}`)}
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
                        <span className="text-sm text-muted-foreground">No disponible</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {enrolledStudents.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No hay estudiantes inscritos en este curso
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
          <div className="space-x-4">
            <span>Total: {enrolledStudents.length} estudiantes</span>
            <span>Entregados: {submissions.length}</span>
            <span>Por calificar: {submissions.filter(s => s.hasUngradedQuestions).length}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
