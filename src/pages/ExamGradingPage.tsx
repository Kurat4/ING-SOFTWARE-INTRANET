import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { CheckCircle, XCircle, Clock, Save, ArrowLeft, User, Calendar as CalendarIcon } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

// Las calificaciones ahora se almacenan como letras en la base de datos
const VALID_GRADES = ['AD', 'A', 'B', 'C'] as const;
type Grade = typeof VALID_GRADES[number];

interface Question {
  id: string;
  question_text: string;
  question_type: string;
  points: number;
  correct_answer: string | null;
  options: any;
  position: number;
}

interface SubmissionData {
  id: string;
  student_id: string;
  quiz_id: string;
  answers: Record<string, any>;
  score: string;  // Ahora es texto (AD, A, B, C)
  submitted_at: string;
  student: {
    first_name: string;
    last_name: string;
    email: string;
  };
}

const ExamGradingPage = () => {
  const { submissionId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const courseId = searchParams.get('courseId');
  const examId = searchParams.get('examId');

  const [submission, setSubmission] = useState<SubmissionData | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [grades, setGrades] = useState<Record<string, { score: string; feedback: string }>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (submissionId) {
      fetchSubmissionData();
    }
  }, [submissionId]);

  const fetchSubmissionData = async () => {
    try {
      setLoading(true);

      // Get submission with student info
      const { data: submissionData, error: submissionError } = await supabase
        .from('quiz_submissions')
        .select(`
          *,
          student:profiles!quiz_submissions_student_id_fkey (
            first_name,
            last_name,
            email
          )
        `)
        .eq('id', submissionId)
        .single();

      if (submissionError) throw submissionError;
      setSubmission(submissionData as SubmissionData);

      // Get questions
      const { data: questionsData, error: questionsError } = await supabase
        .from('quiz_questions')
        .select('*')
        .eq('quiz_id', submissionData.quiz_id)
        .order('position', { ascending: true });

      if (questionsError) throw questionsError;
      setQuestions((questionsData || []) as Question[]);

      // Initialize grades from existing data
      const answers = submissionData.answers as Record<string, any>;
      const initialGrades: Record<string, { score: string; feedback: string }> = {};
      
      Object.keys(answers).forEach(questionId => {
        const answer = answers[questionId];
        if (answer.requires_grading) {
          // Para preguntas que requieren calificación manual, usar el score guardado
          initialGrades[questionId] = {
            score: answer.points_earned !== undefined ? String(answer.points_earned) : '',
            feedback: answer.feedback || ''
          };
        }
      });
      
      setGrades(initialGrades);
    } catch (error) {
      console.error('Error fetching submission:', error);
      toast.error('Error al cargar la respuesta del estudiante');
    } finally {
      setLoading(false);
    }
  };

  const handleGradeChange = (questionId: string, field: 'score' | 'feedback', value: string) => {
    setGrades(prev => ({
      ...prev,
      [questionId]: {
        ...prev[questionId],
        [field]: value
      }
    }));
  };

  const calculateTotalScore = () => {
    let total = 0;
    
    questions.forEach(question => {
      const answer = submission?.answers[question.id];
      
      if (answer?.requires_grading) {
        // Use manually entered score (now a number)
        const enteredScore = grades[question.id]?.score;
        if (enteredScore) {
          total += Number(enteredScore);
        }
      } else if (answer?.is_correct !== undefined) {
        // Use auto-graded score
        total += answer.is_correct ? question.points : 0;
      }
    });
    
    return total;
  };

  const handleSave = async () => {
    if (!submission) return;

    try {
      setSaving(true);

      // Update answers with grades
      const updatedAnswers = { ...(submission.answers as Record<string, any>) };
      let totalScore = 0;

      Object.keys(updatedAnswers).forEach(questionId => {
        const answer = updatedAnswers[questionId];
        
        if (answer.requires_grading && grades[questionId]) {
          const enteredScore = Number(grades[questionId].score) || 0;
          answer.points_earned = enteredScore;
          answer.feedback = grades[questionId].feedback;
          totalScore += answer.points_earned;
        } else {
          totalScore += answer.points_earned || 0;
        }
      });

      console.log('Saving submission:', {
        submissionId,
        updatedAnswers,
        totalScore
      });

      // Convertir puntaje numérico total a letra
      const finalLetterGrade = totalScore >= 18 ? 'AD' : 
                                totalScore >= 15 ? 'A' : 
                                totalScore >= 12 ? 'B' : 'C';

      // Update submission
      const { error } = await supabase
        .from('quiz_submissions')
        .update({
          answers: updatedAnswers,
          score: finalLetterGrade  // Guardar como letra
        })
        .eq('id', submissionId);

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }

      toast.success('Calificación guardada exitosamente');
      
      // Navigate back to exam submissions list
      if (examId && courseId) {
        navigate(`/exam-submissions/${examId}?courseId=${courseId}`);
      } else if (courseId) {
        navigate(`/courses/${courseId}`);
      } else {
        navigate(-1);
      }
    } catch (error) {
      console.error('Error saving grade:', error);
      toast.error('Error al guardar la calificación');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !submission) {
    return (
      <DashboardLayout>
        <div className="p-6 space-y-6">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-1/3"></div>
            <div className="h-4 bg-muted rounded w-1/2"></div>
            <div className="h-32 bg-muted rounded"></div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const answers = submission.answers as Record<string, any>;
  const totalScore = calculateTotalScore();
  const maxScore = questions.reduce((sum, q) => sum + q.points, 0);

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Button
              variant="ghost"
              onClick={() => courseId ? navigate(`/courses/${courseId}`) : navigate(-1)}
              className="mb-2 -ml-2"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver
            </Button>
            <h1 className="text-3xl font-bold text-foreground">Calificar Examen</h1>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <User className="w-4 h-4" />
                <span className="font-medium">{submission.student.first_name} {submission.student.last_name}</span>
              </div>
              <div className="flex items-center gap-1">
                <CalendarIcon className="w-4 h-4" />
                <span>
                  Entregado el {format(new Date(submission.submitted_at), "d 'de' MMMM, yyyy 'a las' HH:mm", { locale: es })}
                </span>
              </div>
            </div>
          </div>

          <Card className="bg-gradient-card shadow-card border-0 p-4">
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-1">Calificación Total</p>
              <p className="text-3xl font-bold text-foreground">
                {totalScore.toFixed(1)} <span className="text-lg text-muted-foreground">/ {maxScore}</span>
              </p>
            </div>
          </Card>
        </div>

        <Separator />

        {/* Questions */}
        <div className="space-y-6">
          {questions.map((question, index) => {
            const answer = answers[question.id];
            if (!answer) return null;

            const isAutoGraded = question.question_type === 'multiple_choice' || question.question_type === 'true_false';
            const currentGrade = grades[question.id];

            return (
              <Card key={question.id} className="bg-gradient-card shadow-card border-0">
                <CardHeader className="pb-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline" className="font-mono">
                          #{index + 1}
                        </Badge>
                        <span className="text-sm font-medium text-muted-foreground">
                          {question.points} {question.points === 1 ? 'punto' : 'puntos'}
                        </span>
                      </div>
                      <CardTitle className="text-lg font-semibold">
                        {question.question_text}
                      </CardTitle>
                    </div>
                    {isAutoGraded && (
                      <Badge variant={answer.is_correct ? 'default' : 'destructive'} className="gap-1">
                        {answer.is_correct ? (
                          <>
                            <CheckCircle className="w-3 h-3" />
                            Correcta
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3 h-3" />
                            Incorrecta
                          </>
                        )}
                      </Badge>
                    )}
                    {!isAutoGraded && (
                      <Badge variant="secondary" className="gap-1">
                        <Clock className="w-3 h-3" />
                        Manual
                      </Badge>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  {/* Student Answer */}
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Respuesta del estudiante:</Label>
                    <div className="p-4 bg-muted/50 rounded-lg border border-border">
                      <p className="text-sm whitespace-pre-wrap">
                        {answer.answer || <span className="text-muted-foreground italic">Sin respuesta</span>}
                      </p>
                    </div>
                  </div>

                  {/* Correct Answer (if exists) */}
                  {question.correct_answer && (
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold">Respuesta esperada:</Label>
                      <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
                        <p className="text-sm">{question.correct_answer}</p>
                      </div>
                    </div>
                  )}

                  <Separator />

                  {/* Grading Section */}
                  {isAutoGraded ? (
                    <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
                      <span className="text-sm font-medium text-muted-foreground">
                        Calificación automática
                      </span>
                      <Badge variant={answer.is_correct ? "default" : "destructive"}>
                        {answer.is_correct ? `${question.points} pts` : '0 pts'}
                      </Badge>
                    </div>
                  ) : (
                    <div className="space-y-4 pt-4 border-t">
                      <div>
                        <Label htmlFor={`score-${question.id}`}>
                          Calificación
                        </Label>
                        <Select 
                          value={grades[question.id]?.score || ''} 
                          onValueChange={(value) => handleGradeChange(question.id, 'score', value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona una calificación" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="AD">AD - Logro Destacado</SelectItem>
                            <SelectItem value="A">A - Logro Esperado</SelectItem>
                            <SelectItem value="B">B - En Proceso</SelectItem>
                            <SelectItem value="C">C - En Inicio</SelectItem>
                          </SelectContent>
                        </Select>
                       </div>

                       <div>
                         <Label htmlFor={`feedback-${question.id}`}>
                           Retroalimentación
                         </Label>
                         <Textarea
                           id={`feedback-${question.id}`}
                           value={grades[question.id]?.feedback || ''}
                           onChange={(e) => handleGradeChange(question.id, 'feedback', e.target.value)}
                           placeholder="Añade comentarios para el estudiante..."
                           rows={3}
                         />
                       </div>
                     </div>
                   )}
                 </CardContent>
               </Card>
             );
           })}
        </div>

        {/* Footer Actions */}
        <Card className="bg-gradient-card shadow-card border-0 sticky bottom-6">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Calificación Final</p>
                <p className="text-2xl font-bold text-foreground">
                  {totalScore.toFixed(1)} / {maxScore} puntos
                </p>
              </div>
              
              <div className="flex gap-3">
                <Button 
                  variant="outline" 
                  onClick={() => courseId ? navigate(`/courses/${courseId}`) : navigate(-1)}
                  disabled={saving}
                >
                  Cancelar
                </Button>
                <Button 
                  onClick={handleSave} 
                  disabled={saving}
                  className="bg-gradient-primary shadow-glow min-w-[160px]"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {saving ? 'Guardando...' : 'Guardar Calificación'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default ExamGradingPage;
