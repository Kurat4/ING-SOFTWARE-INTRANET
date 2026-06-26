import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { format, isToday, isTomorrow, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Calendar, Clock, FileText, AlertCircle, ChevronRight } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Skeleton } from '@/components/ui/skeleton';
import { parseLocalDate } from '@/lib/dateUtils';

interface UpcomingEvent {
  id: string;
  title: string;
  type: 'academic' | 'assignment' | 'exam';
  date: string;
  description?: string;
  courseName?: string;
  moduleNumber?: number;
}

export function UpcomingEvents() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [events, setEvents] = useState<UpcomingEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile) {
      fetchUpcomingEvents();
    }
  }, [profile]);

  const fetchUpcomingEvents = async () => {
    if (!profile) return;
    
    setLoading(true);
    try {
      const today = new Date();
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);

      const upcomingEvents: UpcomingEvent[] = [];

      // Fetch academic events
      const { data: academicData } = await supabase
        .from('academic_events')
        .select('id, title, start_date, description, event_type')
        .eq('is_published', true)
        .gte('start_date', today.toISOString())
        .lte('start_date', nextWeek.toISOString())
        .order('start_date', { ascending: true })
        .limit(3);

      if (academicData) {
        academicData.forEach(event => {
          upcomingEvents.push({
            id: event.id,
            title: event.title,
            type: 'academic',
            date: event.start_date,
            description: event.description || undefined,
          });
        });
      }

      // Fetch assignments for students
      if (profile.role === 'student') {
        const { data: enrollments } = await supabase
          .from('course_enrollments')
          .select('modulo_id')
          .eq('student_id', profile.id);

        if (enrollments && enrollments.length > 0) {
          const moduloIds = enrollments.map(e => e.modulo_id);
          
          const { data: assignmentsData } = await supabase
            .from('assignments')
            .select(`
              id,
              title,
              due_date,
              description,
              courses!course_id (name, code)
            `)
            .in('modulo_id', moduloIds)
            .not('due_date', 'is', null)
            .gte('due_date', today.toISOString())
            .lte('due_date', nextWeek.toISOString())
            .order('due_date', { ascending: true })
            .limit(3);

          if (assignmentsData) {
            assignmentsData.forEach(assignment => {
              upcomingEvents.push({
                id: assignment.id,
                title: assignment.title,
                type: 'assignment',
                date: assignment.due_date,
                description: assignment.description || undefined,
                courseName: assignment.courses?.name,
              });
            });
          }

          // Fetch exams
          const { data: examsData } = await supabase
            .from('exams')
            .select(`
              id,
              title,
              start_time,
              description,
              modulos!modulo_id (
                num_modulo,
                courses!course_id (name, code)
              )
            `)
            .in('modulo_id', moduloIds)
            .eq('is_published', true)
            .gte('start_time', today.toISOString())
            .lte('start_time', nextWeek.toISOString())
            .order('start_time', { ascending: true })
            .limit(3);

          if (examsData) {
            examsData.forEach(exam => {
              upcomingEvents.push({
                id: exam.id,
                title: exam.title,
                type: 'exam',
                date: exam.start_time,
                description: exam.description || undefined,
                courseName: exam.modulos?.courses?.name,
                moduleNumber: exam.modulos?.num_modulo,
              });
            });
          }
        }
      }

      // Sort all events by date
      upcomingEvents.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      setEvents(upcomingEvents.slice(0, 5)); // Show top 5

    } catch (error) {
      console.error('Error fetching upcoming events:', error);
    } finally {
      setLoading(false);
    }
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'assignment':
        return <FileText className="h-4 w-4" />;
      case 'exam':
        return <AlertCircle className="h-4 w-4" />;
      default:
        return <Calendar className="h-4 w-4" />;
    }
  };

  const getEventColor = (type: string) => {
    switch (type) {
      case 'assignment':
        return 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border-orange-300 dark:border-orange-700';
      case 'exam':
        return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-300 dark:border-red-700';
      default:
        return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700';
    }
  };

  const getEventLabel = (type: string) => {
    switch (type) {
      case 'assignment':
        return 'Tarea';
      case 'exam':
        return 'Examen';
      default:
        return 'Evento';
    }
  };

  const getDateLabel = (dateStr: string) => {
    const date = parseLocalDate(dateStr);
    if (isToday(date)) return 'Hoy';
    if (isTomorrow(date)) return 'Mañana';
    return format(date, "EEE d MMM", { locale: es });
  };

  const handleEventClick = (event: UpcomingEvent) => {
    if (event.type === 'assignment') {
      navigate(`/assignments/${event.id}`);
    } else if (event.type === 'exam') {
      navigate(`/exams/${event.id}`);
    } else {
      navigate('/calendar');
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Próximos Eventos
            </CardTitle>
            <CardDescription>Esta semana</CardDescription>
          </div>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => navigate('/calendar')}
          >
            Ver todos
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground dark:text-gray-400">
            <Calendar className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No hay eventos próximos</p>
          </div>
        ) : (
          <div className="space-y-3">
            {events.map(event => (
              <div
                key={event.id}
                onClick={() => handleEventClick(event)}
                className="flex items-start gap-3 p-3 rounded-lg border dark:border-gray-700 hover:bg-accent/50 dark:hover:bg-gray-700 transition-colors cursor-pointer"
              >
                <div className={`p-2 rounded-md ${getEventColor(event.type)}`}>
                  {getEventIcon(event.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-medium text-sm truncate dark:text-gray-200">{event.title}</p>
                    <Badge variant="outline" className="text-xs">
                      {getEventLabel(event.type)}
                    </Badge>
                  </div>
                  {event.courseName && (
                    <p className="text-xs text-muted-foreground dark:text-gray-400 truncate">
                      {event.courseName}
                      {event.moduleNumber && ` - Módulo ${event.moduleNumber}`}
                    </p>
                  )}
                  <div className="flex items-center gap-1 text-xs text-muted-foreground dark:text-gray-500 mt-1">
                    <Clock className="h-3 w-3" />
                    <span>{getDateLabel(event.date)}</span>
                    <span>•</span>
                    <span>{format(parseLocalDate(event.date), "HH:mm", { locale: es })}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
