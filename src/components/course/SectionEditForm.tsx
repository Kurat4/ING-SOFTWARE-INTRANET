import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface WeeklySection {
  id: string;
  week_number: number;
  title: string;
  description?: string;
  start_date?: string;
  end_date?: string;
  is_published: boolean;
}

interface SectionEditFormProps {
  section: WeeklySection;
  courseId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function SectionEditForm({ section, courseId, onClose, onSuccess }: SectionEditFormProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    week_number: section.week_number,
    title: section.title,
    description: section.description || '',
    start_date: section.start_date || '',
    end_date: section.end_date || '',
    is_published: section.is_published
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      toast.error('El título de la semana es requerido');
      return;
    }

    if (formData.week_number < 1) {
      toast.error('El número de semana debe ser mayor a 0');
      return;
    }

    setLoading(true);
    try {
      // Check if week number already exists (excluding current section)
      const { data: existingWeek } = await supabase
        .from('course_weekly_sections')
        .select('id')
        .eq('course_id', courseId)
        .eq('week_number', formData.week_number)
        .neq('id', section.id)
        .single();

      if (existingWeek) {
        toast.error('Ya existe una semana con ese número');
        setLoading(false);
        return;
      }

      const { error } = await supabase
        .from('course_weekly_sections')
        .update({
          week_number: formData.week_number,
          title: formData.title.trim(),
          description: formData.description.trim() || null,
          start_date: formData.start_date || null,
          end_date: formData.end_date || null,
          is_published: formData.is_published,
          position: formData.week_number
        })
        .eq('id', section.id);

      if (error) throw error;

      toast.success('Semana actualizada exitosamente');
      onSuccess();
    } catch (error) {
      console.error('Error updating section:', error);
      toast.error('Error al actualizar la semana');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Editar Semana</DialogTitle>
          <DialogDescription>
            Modifica los detalles de esta semana del curso.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="week_number">Número de Semana *</Label>
              <Input
                id="week_number"
                type="number"
                min="1"
                value={formData.week_number}
                onChange={(e) => setFormData(prev => ({ ...prev, week_number: parseInt(e.target.value) || 1 }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="title">Título *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Ej: Introducción al tema"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descripción</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Describe el contenido de esta semana..."
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start_date">Fecha de Inicio</Label>
              <Input
                id="start_date"
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData(prev => ({ ...prev, start_date: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end_date">Fecha de Fin</Label>
              <Input
                id="end_date"
                type="date"
                value={formData.end_date}
                onChange={(e) => setFormData(prev => ({ ...prev, end_date: e.target.value }))}
              />
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="is_published"
              checked={formData.is_published}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_published: checked }))}
            />
            <Label htmlFor="is_published">Publicar semana</Label>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Guardando...' : 'Guardar Cambios'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
