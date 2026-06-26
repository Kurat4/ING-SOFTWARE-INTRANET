import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface SectionFormProps {
  courseId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function SectionForm({ courseId, onClose, onSuccess }: SectionFormProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    week_number: 1,
    title: '',
    description: '',
    start_date: '',
    end_date: '',
    is_published: false
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
      // Check if week number already exists
      const { data: existingWeek } = await supabase
        .from('course_weekly_sections')
        .select('id')
        .eq('course_id', courseId)
        .eq('week_number', formData.week_number)
        .single();

      if (existingWeek) {
        toast.error('Ya existe una semana con ese número');
        setLoading(false);
        return;
      }

      const { error } = await supabase
        .from('course_weekly_sections')
        .insert({
          course_id: courseId,
          week_number: formData.week_number,
          title: formData.title.trim(),
          description: formData.description.trim() || null,
          start_date: formData.start_date || null,
          end_date: formData.end_date || null,
          is_published: formData.is_published,
          position: formData.week_number
        });

      if (error) throw error;

      toast.success('Semana creada exitosamente');
      onSuccess();
    } catch (error) {
      console.error('Error creating section:', error);
      toast.error('Error al crear la semana');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Crear Nueva Semana</DialogTitle>
          <DialogDescription>
            Organiza el contenido de tu curso por semanas para facilitar el aprendizaje.
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
              placeholder="Descripción opcional de lo que se verá en esta semana"
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
                min={formData.start_date}
              />
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="is_published"
              checked={formData.is_published}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_published: checked }))}
            />
            <Label htmlFor="is_published">Publicar inmediatamente</Label>
          </div>

          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Creando...' : 'Crear Semana'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}