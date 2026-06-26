import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

interface EditExamDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exam: {
    id: string;
    title: string;
    description: string;
    start_time: string;
    duration_minutes: number;
    is_published: boolean;
  };
  onEditSuccess: () => void;
}

// Función helper para parsear fecha de la BD sin conversión de timezone
const parseExamDate = (dateString: string): Date => {
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

export const EditExamDialog = ({ 
  open, 
  onOpenChange, 
  exam,
  onEditSuccess 
}: EditExamDialogProps) => {
  const [title, setTitle] = useState(exam.title);
  const [description, setDescription] = useState(exam.description || '');
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(exam.duration_minutes.toString());
  const [isPublished, setIsPublished] = useState(exam.is_published);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (exam.start_time) {
      // Parsear la fecha sin conversión de timezone
      const date = parseExamDate(exam.start_time);
      const dateStr = date.toISOString().split('T')[0];
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const timeStr = `${hours}:${minutes}`;
      setStartDate(dateStr);
      setStartTime(timeStr);
    }
    setTitle(exam.title);
    setDescription(exam.description || '');
    setDurationMinutes(exam.duration_minutes.toString());
    setIsPublished(exam.is_published);
  }, [exam]);

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error('El título es requerido');
      return;
    }

    if (!startDate || !startTime) {
      toast.error('La fecha y hora de inicio son requeridas');
      return;
    }

    const duration = parseInt(durationMinutes);
    if (isNaN(duration) || duration < 5) {
      toast.error('La duración debe ser al menos 5 minutos');
      return;
    }

    setIsSubmitting(true);

    try {
      // Guardar la hora tal cual fue ingresada (sin conversión de timezone)
      const formatDateForDB = (dateStr: string, timeStr: string) => {
        const [year, month, day] = dateStr.split('-');
        const [hours, minutes] = timeStr.split(':');
        return `${year}-${month}-${day} ${hours}:${minutes}:00+00`;
      };

      const startTimeFormatted = formatDateForDB(startDate, startTime);
      
      const { error } = await supabase
        .from('exams')
        .update({
          title: title.trim(),
          description: description.trim() || null,
          start_time: startTimeFormatted,
          duration_minutes: duration,
          is_published: isPublished,
        })
        .eq('id', exam.id);

      if (error) throw error;

      // También actualizar el quiz asociado
      const { error: quizError } = await supabase
        .from('quizzes')
        .update({
          title: title.trim(),
          description: description.trim() || null,
          due_date: startTimeFormatted,
          time_limit_minutes: duration,
          is_published: isPublished,
        })
        .eq('modulo_id', exam.modulo_id)
        .eq('title', exam.title);

      if (quizError) {
        console.error('Error updating quiz:', quizError);
        // No lanzamos error para no bloquear, pero lo registramos
      }

      toast.success('Examen actualizado correctamente');
      onEditSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error updating exam:', error);
      toast.error(error.message || 'No se pudo actualizar el examen');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Editar Examen</DialogTitle>
          <DialogDescription>
            Modifica los detalles del examen
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="title">Título *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Título del examen"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descripción</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descripción del examen"
              className="min-h-[100px]"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">Fecha de inicio *</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="startTime">Hora de inicio *</Label>
              <Input
                id="startTime"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="duration">Duración (minutos) *</Label>
            <Input
              id="duration"
              type="number"
              min="5"
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(e.target.value)}
            />
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="is_published"
              checked={isPublished}
              onCheckedChange={setIsPublished}
            />
            <Label htmlFor="is_published">Publicar (visible para estudiantes)</Label>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="bg-gradient-primary shadow-glow"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Guardando...
              </>
            ) : (
              'Guardar Cambios'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
