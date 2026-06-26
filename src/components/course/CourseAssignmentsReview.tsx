import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FileText, Calendar, Clock, Users, Eye, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { CreateAssignmentDialog } from '@/components/assignments/CreateAssignmentDialog';

interface Assignment {
  id: string;
  title: string;
  description: string;
  due_date: string;
  max_score: number;
  created_at: string;
  submissions_count?: number;
  graded_count?: number;
}

interface CourseAssignmentsReviewProps {
  courseId: string;
}

// Función helper para parsear fechas sin conversión de timezone
const parseAssignmentDate = (dateString: string): Date => {
  const match = dateString.match(/(\d{4})-(\d{2})-(\d{2})[\sT](\d{2}):(\d{2}):(\d{2})/);
  if (match) {
    const [, year, month, day, hours, minutes, seconds] = match;
    return new Date(
      parseInt(year),
      parseInt(month) - 1,
      parseInt(day),
      parseInt(hours),
      parseInt(minutes),
      parseInt(seconds)
    );
  }
  return new Date(dateString);
};

export function CourseAssignmentsReview({ courseId }: CourseAssignmentsReviewProps) {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  useEffect(() => {
    fetchAssignments();
  }, [courseId]);

  const fetchAssignments = async () => {
    try {
      setLoading(true);

      // Fetch assignments for this course/module
      const { data: assignmentsData, error: assignmentsError} = await supabase
        .from('assignments')
        .select('id, title, description, due_date, max_score, created_at')
        .eq('modulo_id', courseId)
        .order('created_at', { ascending: false });

      if (assignmentsError) throw assignmentsError;

      // For each assignment, get submission counts
      const assignmentsWithCounts = await Promise.all(
        (assignmentsData || []).map(async (assignment) => {
          const { count: totalCount } = await supabase
            .from('assignment_submissions')
            .select('*', { count: 'exact', head: true })
            .eq('assignment_id', assignment.id);

          const { count: gradedCount } = await supabase
            .from('assignment_submissions')
            .select('*', { count: 'exact', head: true })
            .eq('assignment_id', assignment.id)
            .not('score', 'is', null);

          return {
            ...assignment,
            submissions_count: totalCount || 0,
            graded_count: gradedCount || 0
          };
        })
      );

      setAssignments(assignmentsWithCounts);
    } catch (error) {
      console.error('Error fetching assignments:', error);
      toast.error('Error al cargar las tareas');
    } finally {
      setLoading(false);
    }
  };

  if (profile?.role !== 'teacher' && profile?.role !== 'admin') {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <p className="text-muted-foreground">No tienes permisos para ver las entregas.</p>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader>
              <div className="h-6 bg-muted rounded w-1/3"></div>
            </CardHeader>
            <CardContent>
              <div className="h-20 bg-muted rounded"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (assignments.length === 0) {
    return (
      <>
        <CreateAssignmentDialog
          open={isCreateDialogOpen}
          onOpenChange={setIsCreateDialogOpen}
          onSuccess={fetchAssignments}
          moduleId={courseId}
        />
        
        <div className="flex justify-end mb-4">
          <Button
            onClick={() => setIsCreateDialogOpen(true)}
            className="bg-gradient-primary shadow-glow"
          >
            <Plus className="w-4 h-4 mr-2" />
            Crear Tarea
          </Button>
        </div>
        
        <Card>
          <CardContent className="p-12 text-center">
            <FileText className="w-16 h-16 mx-auto text-muted-foreground mb-4 opacity-50" />
            <h3 className="text-lg font-semibold text-foreground mb-2">
              No hay tareas aún
            </h3>
            <p className="text-muted-foreground">
              Haz clic en "Crear Tarea" para agregar la primera tarea.
            </p>
          </CardContent>
        </Card>
      </>
    );
  }

  return (
    <>
      <CreateAssignmentDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onSuccess={fetchAssignments}
        moduleId={courseId}
      />
      
      <div className="flex justify-end mb-4">
        <Button
          onClick={() => setIsCreateDialogOpen(true)}
          className="bg-gradient-primary shadow-glow"
        >
          <Plus className="w-4 h-4 mr-2" />
          Crear Tarea
        </Button>
      </div>
      
      <div className="space-y-4">
        {assignments.map((assignment) => {
          const pendingCount = (assignment.submissions_count || 0) - (assignment.graded_count || 0);
          const dueDate = parseAssignmentDate(assignment.due_date);
          const isOverdue = dueDate < new Date();

        return (
          <Card key={assignment.id} className="bg-gradient-card shadow-card border-0">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-xl mb-2">{assignment.title}</CardTitle>
                  {assignment.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                      {assignment.description}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-3 text-sm">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Calendar className="w-4 h-4" />
                      <span>
                        Vence: {format(dueDate, "d 'de' MMMM, yyyy", { locale: es })}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Clock className="w-4 h-4" />
                      <span>
                        {format(dueDate, "HH:mm", { locale: es })}
                      </span>
                    </div>
                    {isOverdue && (
                      <Badge variant="destructive" className="text-xs">
                        Vencida
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex gap-4">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">
                      <span className="font-medium">{assignment.submissions_count || 0}</span> entregas
                    </span>
                  </div>
                  {pendingCount > 0 && (
                    <Badge variant="secondary" className="bg-orange-500/10 text-orange-600 dark:text-orange-400">
                      {pendingCount} sin calificar
                    </Badge>
                  )}
                  {(assignment.graded_count || 0) > 0 && (
                    <Badge variant="default" className="bg-green-500/10 text-green-600 dark:text-green-400">
                      {assignment.graded_count} calificadas
                    </Badge>
                  )}
                </div>
                <Button
                  onClick={() => navigate(`/assignments/${assignment.id}/review`)}
                  className="bg-gradient-primary shadow-glow"
                >
                  <Eye className="w-4 h-4 mr-2" />
                  Revisar Entregas
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
      </div>
    </>
  );
}
