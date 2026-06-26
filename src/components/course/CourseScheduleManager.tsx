import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Clock, Save } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

interface DaySchedule {
  day: string;
  start_time: string;
  end_time: string;
  enabled: boolean;
}

interface CourseScheduleManagerProps {
  courseId: string;
  canEdit: boolean;
}

const WEEKDAYS = [
  { value: 'monday', label: 'Lunes' },
  { value: 'tuesday', label: 'Martes' },
  { value: 'wednesday', label: 'Miércoles' },
  { value: 'thursday', label: 'Jueves' },
  { value: 'friday', label: 'Viernes' },
  { value: 'saturday', label: 'Sábado' },
  { value: 'sunday', label: 'Domingo' },
];

export function CourseScheduleManager({ courseId, canEdit: _canEdit }: CourseScheduleManagerProps) {
  const { profile } = useAuth();
  
  const [daySchedules, setDaySchedules] = useState<DaySchedule[]>(
    WEEKDAYS.map(day => ({
      day: day.value,
      start_time: '',
      end_time: '',
      enabled: false,
    }))
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [canEdit, setCanEdit] = useState(false);

  useEffect(() => {
    fetchSchedule();
    checkEditPermissions();
  }, [courseId, profile]);

  const checkEditPermissions = async () => {
    if (!profile) return;

    // Admins siempre pueden editar
    if (profile.role === 'admin' || profile.roles?.includes('admin')) {
      setCanEdit(true);
      return;
    }

    // Verificar si es tutor del curso
    if (profile.role === 'tutor' || profile.roles?.includes('tutor')) {
      try {
        const { data: teacherData, error } = await supabase
          .from('course_teachers')
          .select('id')
          .eq('course_id', courseId)
          .eq('teacher_id', profile.id)
          .maybeSingle();

        if (!error && teacherData) {
          setCanEdit(true);
          return;
        }
      } catch (error) {
        console.error('Error checking tutor permissions:', error);
      }
    }

    setCanEdit(false);
  };

  const fetchSchedule = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('modulos')
        .select('schedule')
        .eq('id', courseId)
        .single();

      if (error) throw error;

      if (data?.schedule && Array.isArray(data.schedule)) {
        // Map the schedule from DB to our DaySchedule format
        const scheduleMap = new Map(
          data.schedule.map((s: any) => [s.day, { start_time: s.start_time, end_time: s.end_time }])
        );
        
        setDaySchedules(
          WEEKDAYS.map(day => ({
            day: day.value,
            start_time: scheduleMap.get(day.value)?.start_time || '',
            end_time: scheduleMap.get(day.value)?.end_time || '',
            enabled: scheduleMap.has(day.value),
          }))
        );
      }
    } catch (error) {
      console.error('Error fetching schedule:', error);
      toast.error('Error al cargar el horario');
    } finally {
      setLoading(false);
    }
  };

  const handleDayToggle = (day: string) => {
    setDaySchedules(prev =>
      prev.map(d =>
        d.day === day ? { ...d, enabled: !d.enabled } : d
      )
    );
  };

  const handleTimeChange = (day: string, field: 'start_time' | 'end_time', value: string) => {
    setDaySchedules(prev =>
      prev.map(d =>
        d.day === day ? { ...d, [field]: value } : d
      )
    );
  };

  const handleSaveSchedule = async () => {
    try {
      setSaving(true);

      // Get only enabled days
      const enabledSchedules = daySchedules.filter(d => d.enabled);

      if (enabledSchedules.length === 0) {
        toast.error('Debe habilitar al menos un día');
        return;
      }

      // Validate that all enabled days have start and end times
      for (const schedule of enabledSchedules) {
        if (!schedule.start_time || !schedule.end_time) {
          const dayLabel = WEEKDAYS.find(w => w.value === schedule.day)?.label;
          toast.error(`Debe especificar horario completo para ${dayLabel}`);
          return;
        }
        
        // Validate that end time is after start time
        if (schedule.end_time <= schedule.start_time) {
          const dayLabel = WEEKDAYS.find(w => w.value === schedule.day)?.label;
          toast.error(`La hora de fin debe ser posterior a la hora de inicio para ${dayLabel}`);
          return;
        }
      }

      // Build the schedule array in the format expected by the DB
      const scheduleArray = enabledSchedules.map(s => ({
        day: s.day,
        start_time: s.start_time,
        end_time: s.end_time,
      }));

      const { error } = await supabase
        .from('modulos')
        .update({
          schedule: scheduleArray,
        })
        .eq('id', courseId);

      if (error) throw error;

      toast.success('Horario guardado correctamente');
    } catch (error) {
      console.error('Error saving schedule:', error);
      toast.error('Error al guardar el horario');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-center py-4">Cargando horario...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          <div>
            <CardTitle>Horario del Curso</CardTitle>
            <CardDescription>
              Define los días y horarios en que se imparte este curso
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          <Label>Horario por día</Label>
          <div className="space-y-2">
            {WEEKDAYS.map((day) => {
              const schedule = daySchedules.find(d => d.day === day.value);
              if (!schedule) return null;
              
              // Si no puede editar y el día no está habilitado, no mostrar nada
              if (!canEdit && !schedule.enabled) return null;
              
              return (
                <div
                  key={day.value}
                  className="border rounded-lg p-4 space-y-3 bg-card"
                >
                  {canEdit ? (
                    <>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id={`checkbox-${day.value}`}
                          checked={schedule.enabled}
                          onCheckedChange={() => handleDayToggle(day.value)}
                        />
                        <label
                          htmlFor={`checkbox-${day.value}`}
                          className="text-sm font-medium leading-none cursor-pointer"
                        >
                          {day.label}
                        </label>
                      </div>
                      
                      {schedule.enabled && (
                        <div className="grid grid-cols-2 gap-3 ml-6">
                          <div className="space-y-1">
                            <Label htmlFor={`start-${day.value}`} className="text-xs text-muted-foreground">
                              Hora de inicio
                            </Label>
                            <Input
                              id={`start-${day.value}`}
                              type="time"
                              value={schedule.start_time}
                              onChange={(e) => handleTimeChange(day.value, 'start_time', e.target.value)}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor={`end-${day.value}`} className="text-xs text-muted-foreground">
                              Hora de fin
                            </Label>
                            <Input
                              id={`end-${day.value}`}
                              type="time"
                              value={schedule.end_time}
                              onChange={(e) => handleTimeChange(day.value, 'end_time', e.target.value)}
                            />
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    // Vista de solo lectura
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{day.label}</span>
                      <span className="text-sm text-muted-foreground">
                        {schedule.start_time} - {schedule.end_time}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {canEdit && (
          <div className="flex justify-end">
            <Button onClick={handleSaveSchedule} disabled={saving} className="gap-2">
              <Save className="h-4 w-4" />
              {saving ? 'Guardando...' : 'Guardar Horario'}
            </Button>
          </div>
        )}

        {!canEdit && daySchedules.filter(d => d.enabled).length === 0 && (
          <div className="text-sm text-muted-foreground text-center py-4">
            No hay horarios configurados para este curso
          </div>
        )}
      </CardContent>
    </Card>
  );
}
