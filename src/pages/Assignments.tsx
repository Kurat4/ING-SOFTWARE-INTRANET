import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FileText, Calendar, Clock, Plus, AlertCircle, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { format, isAfter, isBefore, addDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CreateAssignmentDialog } from '@/components/assignments/CreateAssignmentDialog';
import { EditAssignmentDialog } from '@/components/assignments/EditAssignmentDialog';
import { parsePeruDateToUserTimezone } from '@/lib/timezoneUtils';

// Helper para parsear fechas convirtiendo de hora Perú a zona del usuario
const parseExamDate = (dateString: string): Date => {
  return parsePeruDateToUserTimezone(dateString);
};

interface Assignment {
  id: string;
  title: string;
  description: string;
  due_date: string;
  max_score: number;
  modulo_id: string;
  source: 'assignment' | 'weekly_resource';
  modulo: {
    id: string;
    name: string;
    course_id: string;
    course: {
      id: string;
      name: string;
      code: string;
    } | null;
  } | null;
  submissions?: {
    id: string;
    score: string;  // Ahora es texto (AD, A, B, C)
    submitted_at: string;
  }[];
}

const Assignments = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [courseFilter, setCourseFilter] = useState<string>('all');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingAssignmentId, setEditingAssignmentId] = useState<string | null>(null);

  useEffect(() => {
    fetchAssignments();
  }, [profile]);

  const fetchAssignments = async () => {
    if (!profile) return;

    try {
      let assignmentsData = null;
      let assignmentsError = null;

      // For teachers, fetch all assignments from their courses
      if (profile.role === 'teacher' || profile.role === 'admin') {
        const { data, error } = await supabase
          .from('assignments')
          .select(`
            *,
            modulo:modulos!inner (
              id,
              name,
              course_id,
              course:courses (
                id,
                name,
                code
              )
            ),
            submissions:assignment_submissions (
              id,
              score,
              submitted_at,
              student_id
            )
          `)
          // Teachers see ALL assignments (published and unpublished)
          .order('due_date', { ascending: true });

        assignmentsData = data;
        assignmentsError = error;
      } else {
        // For students, fetch only their enrolled courses' assignments
        const { data, error } = await supabase
          .from('assignments')
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
            ),
            submissions:assignment_submissions (
              id,
              score,
              submitted_at
            )
          `)
          .eq('is_published', true)
          .order('due_date', { ascending: true });

        assignmentsData = data;
        assignmentsError = error;
      }

      if (assignmentsError) throw assignmentsError;

      // Only use assignments from the assignments table (no duplicates from weekly resources)
      const formattedAssignments: Assignment[] = (assignmentsData || [])
        .filter(assignment => assignment.modulo) // Filter out assignments without modulo
        .map(assignment => ({
          id: assignment.id,
          title: assignment.title,
          description: assignment.description || '',
          due_date: assignment.due_date,
          max_score: assignment.max_score,
          modulo_id: assignment.modulo_id,
          source: 'assignment' as const,
          modulo: assignment.modulo,
          submissions: assignment.submissions
        })).sort((a, b) => parseExamDate(a.due_date).getTime() - parseExamDate(b.due_date).getTime());

      setAssignments(formattedAssignments);
    } catch (error) {
      console.error('Error fetching assignments:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar las tareas",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getAssignmentStatus = (assignment: Assignment) => {
    const now = new Date();
    const dueDate = parseExamDate(assignment.due_date);
    const hasSubmission = assignment.submissions && assignment.submissions.length > 0;

    if (hasSubmission) {
      const submission = assignment.submissions[0];
      // Score ya es letra directamente (AD, A, B, C)
      return {
        status: 'submitted',
        label: submission.score || 'Entregada',
        variant: submission.score ? 'default' as const : 'secondary' as const,
        color: submission.score ? 'text-primary' : 'text-secondary'
      };
    }

    if (isAfter(now, dueDate)) {
      return {
        status: 'overdue',
        label: 'Vencida',
        variant: 'destructive' as const,
        color: 'text-destructive'
      };
    }

    if (isBefore(now, addDays(dueDate, -1))) {
      return {
        status: 'pending',
        label: 'Pendiente',
        variant: 'outline' as const,
        color: 'text-muted-foreground'
      };
    }

    return {
      status: 'due-soon',
      label: 'Próxima a vencer',
      variant: 'destructive' as const,
      color: 'text-destructive'
    };
  };

  // Get unique courses for filter
  const uniqueCourses = Array.from(
    new Map(
      assignments
        .filter(a => a.modulo?.course_id)
        .map(a => [a.modulo!.course_id, a.modulo!])
    ).values()
  );

  // Apply filters
  const filteredAssignments = assignments.filter(assignment => {
    const matchesSearch = assignment.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         assignment.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (assignment.modulo?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false);
    
    const matchesCourse = courseFilter === 'all' || assignment.modulo?.course_id === courseFilter;
    
    const status = getAssignmentStatus(assignment).status;
    const matchesStatus = statusFilter === 'all' || status === statusFilter;

    return matchesSearch && matchesCourse && matchesStatus;
  });

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-foreground">Tareas</h1>
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
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-foreground">Tareas</h1>
          {(profile?.role === 'teacher' || profile?.role === 'tutor') && (
            <Button 
              className="bg-gradient-primary shadow-glow"
              onClick={() => setIsCreateDialogOpen(true)}
            >
              <Plus className="w-4 h-4 mr-2" />
              Crear Tarea
            </Button>
          )}
        </div>

        {/* Create Assignment Dialog */}
        <CreateAssignmentDialog
          open={isCreateDialogOpen}
          onOpenChange={setIsCreateDialogOpen}
          onSuccess={fetchAssignments}
        />

        {/* Edit Assignment Dialog */}
        <EditAssignmentDialog
          assignmentId={editingAssignmentId}
          open={editingAssignmentId !== null}
          onOpenChange={(open) => !open && setEditingAssignmentId(null)}
          onSuccess={fetchAssignments}
        />

        {/* Search and Filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar tareas..."
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
              <SelectItem value="pending">Pendiente</SelectItem>
              <SelectItem value="due-soon">Por vencer</SelectItem>
              <SelectItem value="overdue">Vencida</SelectItem>
              {profile?.role === 'student' && (
                <SelectItem value="submitted">Entregada</SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>

        {filteredAssignments.length === 0 ? (
          <Card className="bg-gradient-card shadow-card border-0">
            <CardContent className="p-8 text-center">
              <FileText className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">
                No hay tareas disponibles
              </h3>
              <p className="text-muted-foreground">
                {searchTerm || courseFilter !== 'all' || statusFilter !== 'all'
                  ? 'No se encontraron tareas con los filtros aplicados.'
                  : profile?.role === 'student' 
                    ? 'No tienes tareas pendientes en este momento.'
                    : 'Aún no has creado ninguna tarea para tus cursos.'
                }
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredAssignments.map((assignment) => {
              const status = getAssignmentStatus(assignment);
              
              return (
                <Card key={`${assignment.source}-${assignment.id}`} className="bg-gradient-card shadow-card border-0 hover:shadow-glow transition-all duration-300">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <CardTitle className="text-lg font-semibold text-foreground">
                            {assignment.title}
                          </CardTitle>
                          {profile?.role === 'teacher' || profile?.role === 'admin' ? (
                            assignment.submissions && assignment.submissions.filter(s => s.score).length > 0 && (
                              <Badge variant="secondary" className="text-xs">
                                Calificados: {assignment.submissions.filter(s => s.score).length}
                              </Badge>
                            )
                          ) : (
                            <Badge variant={status.variant} className="text-xs">
                              {status.label}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                          <Badge variant="secondary" className="text-xs">
                            Módulo
                          </Badge>
                          <span>{assignment.modulo?.name || 'Sin módulo'}</span>
                          {assignment.modulo?.course && (
                            <>
                              <span className="text-xs">•</span>
                              <Badge variant="outline" className="text-xs">
                                {assignment.modulo.course.name}
                              </Badge>
                            </>
                          )}
                        </div>
                      </div>
                      <FileText className="w-6 h-6 text-primary" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                      {assignment.description || 'Sin descripción disponible'}
                    </p>
                    
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          <span>
                            {format(parseExamDate(assignment.due_date), "d 'de' MMMM, yyyy", { locale: es })}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          <span>
                            {format(parseExamDate(assignment.due_date), "HH:mm")}
                          </span>
                        </div>
                      </div>
                      
                      <div className="text-sm font-medium text-foreground">
                        {assignment.max_score} pts
                      </div>
                    </div>

                    {status.status === 'due-soon' && (
                      <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 mb-4">
                        <AlertCircle className="w-4 h-4 text-destructive" />
                        <span className="text-sm text-destructive font-medium">
                          ¡Esta tarea vence pronto!
                        </span>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2">
                      <Button 
                        className="flex-1 min-w-[120px]" 
                        variant="outline"
                        asChild
                      >
                        <Link to={`/courses/${assignment.modulo_id}`}>
                          Ver Módulo
                        </Link>
                      </Button>
                      
                      {(profile?.role === 'teacher' || profile?.role === 'admin' || profile?.role === 'tutor') && (
                        <Button 
                          variant="outline"
                          onClick={() => setEditingAssignmentId(assignment.id)}
                        >
                          Editar
                        </Button>
                      )}
                      
                      {profile?.role === 'teacher' || profile?.role === 'admin' || profile?.role === 'tutor' ? (
                        <Button 
                          className="bg-gradient-primary shadow-glow flex-1 min-w-[140px]"
                          asChild
                        >
                          <Link to={`/assignments/${assignment.id}/review`}>
                            Revisar Entregas
                            {assignment.submissions && assignment.submissions.filter(s => !s.score).length > 0 && (
                              <Badge variant="secondary" className="ml-2">
                                {assignment.submissions.filter(s => !s.score).length}
                              </Badge>
                            )}
                          </Link>
                        </Button>
                      ) : (
                        profile?.role === 'student' && (
                          <Button 
                            className="bg-gradient-primary shadow-glow"
                            asChild
                          >
                            <Link to={`/assignments/${assignment.id}`}>
                              Ver Detalles
                            </Link>
                          </Button>
                        )
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Assignments;