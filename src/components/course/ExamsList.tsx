import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, Clock, AlertCircle, ClipboardList, Users, Pencil } from 'lucide-react';
import { format, isAfter, isBefore, addMinutes } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { EditExamDialog } from './EditExamDialog';
import { parsePeruDateToUserTimezone } from '@/lib/timezoneUtils';

interface Exam {
  id: string;
  title: string;
  description: string;
  start_time: string;
  duration_minutes: number;
  max_score: number;
  is_published: boolean;
}

interface ExamsListProps {
  courseId: string;
  canEdit: boolean;
}

// Función helper para parsear fechas convirtiendo de hora Perú a zona del usuario
const parseExamDate = (dateString: string): Date => {
  return parsePeruDateToUserTimezone(dateString);
};

export function ExamsList({ courseId, canEdit }: ExamsListProps) {
  const navigate = useNavigate();
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingExam, setEditingExam] = useState<Exam | null>(null);

  useEffect(() => {
    fetchExams();
  }, [courseId]);

  const fetchExams = async () => {
    try {
      const { data, error } = await supabase
        .from('exams')
        .select('*')
        .eq('modulo_id', courseId)
        .order('start_time', { ascending: true });

      if (error) throw error;

      // Filter to show only published exams for students
      const filteredExams = canEdit 
        ? (data || [])
        : (data || []).filter(exam => exam.is_published);

      setExams(filteredExams);
    } catch (error) {
      console.error('Error fetching exams:', error);
      toast.error('Error al cargar los exámenes');
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

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="space-y-3">
                <div className="h-4 bg-muted rounded w-3/4"></div>
                <div className="h-3 bg-muted rounded w-1/2"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (exams.length === 0) {
    return (
      <Card className="bg-gradient-card shadow-card border-0">
        <CardContent className="p-8 text-center">
          <ClipboardList className="w-16 h-16 mx-auto text-muted-foreground mb-4 opacity-50" />
          <h3 className="text-lg font-semibold text-foreground mb-2">
            No hay exámenes programados
          </h3>
          <p className="text-muted-foreground">
            {canEdit 
              ? 'Haz clic en "Crear Examen" para agregar un nuevo examen.'
              : 'El profesor aún no ha programado exámenes para este curso.'
            }
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {editingExam && (
        <EditExamDialog
          open={!!editingExam}
          onOpenChange={(open) => !open && setEditingExam(null)}
          exam={editingExam}
          onEditSuccess={fetchExams}
        />
      )}
      
      <div className="space-y-4">
        {exams.map((exam) => {
          const status = getExamStatus(exam);
          
          return (
            <Card key={exam.id} className="bg-gradient-card shadow-card border-0 hover:shadow-glow transition-all duration-300">
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

                {status.status === 'upcoming' && canEdit && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/10 border border-primary/20 mb-4">
                    <AlertCircle className="w-4 h-4 text-primary" />
                    <span className="text-sm text-primary font-medium">
                      Programado para {format(parseExamDate(exam.start_time), "d 'de' MMMM 'a las' HH:mm", { locale: es })}
                    </span>
                  </div>
                )}

                {!exam.is_published && canEdit && (
                  <Badge variant="secondary" className="mb-4">
                    Borrador (no visible para estudiantes)
                  </Badge>
                )}

                {canEdit && (
                  <div className="flex gap-2 mt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditingExam(exam)}
                      className="flex-1"
                    >
                      <Pencil className="w-4 h-4 mr-2" />
                      Editar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/exam-submissions/${exam.id}?courseId=${courseId}`)}
                      className="flex-1"
                    >
                      <Users className="w-4 h-4 mr-2" />
                      Ver Respuestas
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </>
  );
}
