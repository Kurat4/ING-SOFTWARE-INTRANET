import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { format, isSameDay, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { CalendarIcon, MapPin, Clock, FileText } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/useAuth';
import { parsePeruDateToUserTimezone } from '@/lib/timezoneUtils';

interface AcademicEvent {
  id: string;
  title: string;
  description: string | null;
  event_type: string;
  start_date: string;
  end_date: string;
}

interface CourseEvent {
  id: string;
  title: string;
  description: string | null;
  event_type: string;
  start_date: string;
  end_date: string;
  location: string | null;
  course_id: string;
  courses?: {
    name: string;
    code: string;
  };
}

interface Assignment {
  id: string;
  title: string;
  description: string | null;
  due_date: string;
  course_id: string;
  courses?: {
    name: string;
    code: string;
  };
}

interface Exam {
  id: string;
  title: string;
  description: string | null;
  start_time: string;
  duration_minutes: number;
  course_id: string;
  modulo_id?: string;
  modulos?: {
    name: string;
    num_modulo: number;
    courses?: {
      name: string;
      code: string;
    };
  };
}

export function AcademicCalendar() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [academicEvents, setAcademicEvents] = useState<AcademicEvent[]>([]);
  const [courseEvents, setCourseEvents] = useState<CourseEvent[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      // Fetch academic events
      const { data: academicData, error: academicError } = await supabase
        .from('academic_events')
        .select('*')
        .eq('is_published', true)
        .order('start_date', { ascending: true });

      if (academicError) throw academicError;

      // Note: course_events table is not currently used
      const courseData: any[] = [];

      // Fetch assignments
      let assignmentsQuery = supabase
        .from('assignments')
        .select(`
          id,
          title,
          description,
          due_date,
          course_id,
          modulo_id,
          courses!course_id (
            name,
            code
          )
        `)
        .not('due_date', 'is', null)
        .order('due_date', { ascending: true });

      // If user is a student, only fetch their assignments
      if (profile?.role === 'student') {
        const { data: enrollments } = await supabase
          .from('course_enrollments')
          .select('modulo_id')
          .eq('student_id', profile.id);
        
        if (enrollments && enrollments.length > 0) {
          const moduloIds = enrollments.map(e => e.modulo_id);
          assignmentsQuery = assignmentsQuery.in('modulo_id', moduloIds);
        }
      }

      const { data: assignmentsData, error: assignmentsError } = await assignmentsQuery;

      if (assignmentsError) throw assignmentsError;

      // Fetch exams
      let examsQuery = supabase
        .from('exams')
        .select(`
          id,
          title,
          description,
          start_time,
          duration_minutes,
          course_id,
          modulo_id,
          modulos!modulo_id (
            name,
            num_modulo,
            courses!course_id (
              name,
              code
            )
          )
        `)
        .eq('is_published', true)
        .order('start_time', { ascending: true });

      // If user is a student, only fetch their exams
      if (profile?.role === 'student') {
        const { data: enrollments } = await supabase
          .from('course_enrollments')
          .select('modulo_id')
          .eq('student_id', profile.id);
        
        if (enrollments && enrollments.length > 0) {
          const moduloIds = enrollments.map(e => e.modulo_id);
          examsQuery = examsQuery.in('modulo_id', moduloIds);
        }
      }

      const { data: examsData, error: examsError } = await examsQuery;

      if (examsError) {
        console.error('Error fetching exams:', examsError);
      }

      setAcademicEvents(academicData || []);
      setCourseEvents(courseData || []);
      setAssignments(assignmentsData || []);
      setExams(examsData || []);
    } catch (error: any) {
      console.error('Error fetching events:', error);
      toast.error('Error al cargar los eventos');
    } finally {
      setLoading(false);
    }
  };

  const getEventsForDate = (date: Date) => {
    const academic = academicEvents.filter(event => {
      const startDate = parsePeruDateToUserTimezone(event.start_date);
      const endDate = parsePeruDateToUserTimezone(event.end_date);
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
      const checkDate = new Date(date);
      checkDate.setHours(12, 0, 0, 0);
      return checkDate >= startDate && checkDate <= endDate;
    });

    const course = courseEvents.filter(event => {
      const startDate = parsePeruDateToUserTimezone(event.start_date);
      const endDate = parsePeruDateToUserTimezone(event.end_date);
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
      const checkDate = new Date(date);
      checkDate.setHours(12, 0, 0, 0);
      return checkDate >= startDate && checkDate <= endDate;
    });

    const assignmentsForDate = assignments.filter(assignment => {
      const dueDate = parsePeruDateToUserTimezone(assignment.due_date);
      dueDate.setHours(0, 0, 0, 0);
      const checkDate = new Date(date);
      checkDate.setHours(0, 0, 0, 0);
      return dueDate.getTime() === checkDate.getTime();
    });

    const examsForDate = exams.filter(exam => {
      const examDate = parsePeruDateToUserTimezone(exam.start_time);
      examDate.setHours(0, 0, 0, 0);
      const checkDate = new Date(date);
      checkDate.setHours(0, 0, 0, 0);
      return examDate.getTime() === checkDate.getTime();
    });

    return { academic, course, assignments: assignmentsForDate, exams: examsForDate };
  };

  const selectedEvents = selectedDate ? getEventsForDate(selectedDate) : { academic: [], course: [], assignments: [], exams: [] };

  const getEventTypeBadgeVariant = (type: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      vacation: 'secondary',
      holiday: 'destructive',
      exam: 'outline',
      class: 'default',
      reunion: 'outline',
      portafolio: 'default',
      other: 'secondary'
    };
    return variants[type] || 'default';
  };

  const getEventTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      vacation: 'Vacaciones',
      holiday: 'Feriado',
      exam: 'Examen',
      class: 'Clase',
      reunion: 'Reunión',
      portafolio: 'Portafolio',
      other: 'Otro'
    };
    return labels[type] || type;
  };

  // Mark dates that have events
  const datesWithEvents = new Set<string>();
  [...academicEvents, ...courseEvents].forEach(event => {
    const start = parsePeruDateToUserTimezone(event.start_date);
    const end = parsePeruDateToUserTimezone(event.end_date);
    const current = new Date(start);
    while (current <= end) {
      datesWithEvents.add(format(current, 'yyyy-MM-dd'));
      current.setDate(current.getDate() + 1);
    }
  });
  
  // Mark dates that have assignments
  assignments.forEach(assignment => {
    const dueDate = parsePeruDateToUserTimezone(assignment.due_date);
    datesWithEvents.add(format(dueDate, 'yyyy-MM-dd'));
  });
  
  // Mark dates that have exams
  exams.forEach(exam => {
    const examDate = parsePeruDateToUserTimezone(exam.start_time);
    datesWithEvents.add(format(examDate, 'yyyy-MM-dd'));
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar Section */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Calendario</CardTitle>
            <CardDescription className="text-xs">Selecciona una fecha</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center pb-4">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              locale={es}
              className="rounded-md border-0 shadow-none"
              classNames={{
                months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
                month: "space-y-4",
                caption: "flex justify-center pt-1 relative items-center",
                caption_label: "text-sm font-medium",
                nav: "space-x-1 flex items-center",
                nav_button: "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100",
                nav_button_previous: "absolute left-1",
                nav_button_next: "absolute right-1",
                table: "w-full border-collapse space-y-1",
                head_row: "flex",
                head_cell: "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]",
                row: "flex w-full mt-2",
                cell: "text-center text-sm p-0 relative [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
                day: "h-9 w-9 p-0 font-normal aria-selected:opacity-100 hover:bg-accent hover:text-accent-foreground rounded-md",
                day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
                day_today: "bg-accent text-accent-foreground font-semibold",
                day_outside: "text-muted-foreground opacity-50",
                day_disabled: "text-muted-foreground opacity-50",
                day_range_middle: "aria-selected:bg-accent aria-selected:text-accent-foreground",
                day_hidden: "invisible",
              }}
              modifiers={{
                hasEvent: (date) => datesWithEvents.has(format(date, 'yyyy-MM-dd'))
              }}
              modifiersClassNames={{
                hasEvent: "relative after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:w-1 after:h-1 after:bg-primary after:rounded-full"
              }}
            />
          </CardContent>
        </Card>

        {/* Events List Section */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              {selectedDate && (
                <>
                  <CalendarIcon className="h-5 w-5 text-primary" />
                  {format(selectedDate, "EEEE, d 'de' MMMM 'de' yyyy", { locale: es })}
                </>
              )}
            </CardTitle>
            <CardDescription>
              {selectedEvents.academic.length + selectedEvents.course.length + selectedEvents.assignments.length + selectedEvents.exams.length > 0 
                ? `${selectedEvents.academic.length + selectedEvents.course.length + selectedEvents.assignments.length + selectedEvents.exams.length} evento(s) programado(s)`
                : 'No hay eventos para esta fecha'
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <Skeleton key={i} className="h-24 w-full" />
                ))}
              </div>
            ) : (
              <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                {selectedEvents.academic.length === 0 && selectedEvents.course.length === 0 && selectedEvents.assignments.length === 0 && selectedEvents.exams.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground dark:text-gray-400">
                    <CalendarIcon className="h-16 w-16 mx-auto mb-4 opacity-20" />
                    <p className="text-lg font-medium mb-1">Sin eventos programados</p>
                    <p className="text-sm">Selecciona otra fecha para ver eventos</p>
                  </div>
                )}

              {selectedEvents.academic.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-semibold text-sm text-muted-foreground dark:text-gray-400 uppercase tracking-wide flex items-center gap-2">
                    <div className="h-1 w-8 bg-blue-500 rounded"></div>
                    Eventos Académicos
                  </h3>
                  {selectedEvents.academic.map(event => (
                    <div
                      key={event.id}
                      className="group p-4 rounded-xl border-2 bg-gradient-to-br from-blue-50/50 dark:from-blue-950/30 to-transparent hover:from-blue-50 dark:hover:from-blue-950/50 hover:border-blue-300 dark:hover:border-blue-700 dark:border-gray-700 transition-all duration-200"
                    >
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <h4 className="font-semibold text-base dark:text-gray-200 group-hover:text-blue-700 dark:group-hover:text-blue-400 transition-colors">{event.title}</h4>
                        <Badge variant={getEventTypeBadgeVariant(event.event_type)} className="shrink-0">
                          {getEventTypeLabel(event.event_type)}
                        </Badge>
                      </div>
                      {event.description && (
                        <p className="text-sm text-muted-foreground dark:text-gray-400 mb-3 line-clamp-2">{event.description}</p>
                      )}
                      <div className="flex items-center gap-2 text-xs text-muted-foreground dark:text-gray-500">
                        <Clock className="h-3.5 w-3.5" />
                        <span className="font-medium">
                          {format(parsePeruDateToUserTimezone(event.start_date), "HH:mm", { locale: es })} - 
                          {format(parsePeruDateToUserTimezone(event.end_date), "HH:mm", { locale: es })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {selectedEvents.course.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-semibold text-sm text-muted-foreground">Eventos de Cursos</h3>
                  {selectedEvents.course.map(event => (
                    <div
                      key={event.id}
                      className="p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <h4 className="font-semibold">{event.title}</h4>
                          {event.courses && (
                            <p className="text-xs text-muted-foreground">
                              {event.courses.name} ({event.courses.code})
                            </p>
                          )}
                        </div>
                        <Badge variant={getEventTypeBadgeVariant(event.event_type)}>
                          {getEventTypeLabel(event.event_type)}
                        </Badge>
                      </div>
                      {event.description && (
                        <p className="text-sm text-muted-foreground mb-2">{event.description}</p>
                      )}
                      <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Clock className="h-3 w-3" />
                          <span>
                            {format(parseISO(event.start_date), "HH:mm", { locale: es })} - 
                            {format(parseISO(event.end_date), "HH:mm", { locale: es })}
                          </span>
                        </div>
                        {event.location && (
                          <div className="flex items-center gap-2">
                            <MapPin className="h-3 w-3" />
                            <span>{event.location}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {selectedEvents.assignments.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                    <div className="h-1 w-8 bg-orange-500 rounded"></div>
                    Tareas Pendientes
                  </h3>
                  {selectedEvents.assignments.map(assignment => (
                    <div
                      key={assignment.id}
                      onClick={() => navigate(`/assignments/${assignment.id}`)}
                      className="group p-4 rounded-xl border-2 border-l-4 border-l-orange-500 bg-gradient-to-br from-orange-50/50 to-transparent hover:from-orange-50 hover:border-orange-300 transition-all duration-200 cursor-pointer"
                    >
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex-1">
                          <h4 className="font-semibold text-base group-hover:text-orange-700 transition-colors mb-1">{assignment.title}</h4>
                          {assignment.courses && (
                            <p className="text-xs text-muted-foreground font-medium">
                              {assignment.courses.name} ({assignment.courses.code})
                            </p>
                          )}
                        </div>
                        <Badge variant="outline" className="bg-orange-100 text-orange-700 border-orange-300 shrink-0">
                          <FileText className="h-3 w-3 mr-1" />
                          Tarea
                        </Badge>
                      </div>
                      {assignment.description && (
                        <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{assignment.description}</p>
                      )}
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="h-3.5 w-3.5" />
                        <span className="font-medium">
                          Entrega: {format(parsePeruDateToUserTimezone(assignment.due_date), "HH:mm", { locale: es })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {selectedEvents.exams.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                    <div className="h-1 w-8 bg-red-500 rounded"></div>
                    Exámenes Programados
                  </h3>
                  {selectedEvents.exams.map(exam => (
                    <div
                      key={exam.id}
                      onClick={() => navigate(`/exams/${exam.id}`)}
                      className="group p-4 rounded-xl border-2 border-l-4 border-l-red-500 bg-gradient-to-br from-red-50/50 to-transparent hover:from-red-50 hover:border-red-300 transition-all duration-200 cursor-pointer"
                    >
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex-1">
                          <h4 className="font-semibold text-base group-hover:text-red-700 transition-colors mb-1">{exam.title}</h4>
                          {exam.modulos?.courses && (
                            <p className="text-xs text-muted-foreground font-medium">
                              {exam.modulos.courses.name} - Módulo {exam.modulos.num_modulo} ({exam.modulos.courses.code})
                            </p>
                          )}
                        </div>
                        <Badge variant="outline" className="bg-red-100 text-red-700 border-red-300 shrink-0">
                          Examen
                        </Badge>
                      </div>
                      {exam.description && (
                        <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{exam.description}</p>
                      )}
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="h-3.5 w-3.5" />
                        <span className="font-medium">
                          {format(parsePeruDateToUserTimezone(exam.start_time), "HH:mm", { locale: es })} • Duración: {exam.duration_minutes} min
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
    </div>
  );
}

