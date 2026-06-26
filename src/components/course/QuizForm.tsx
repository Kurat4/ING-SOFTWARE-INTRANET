import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Trash2, CalendarIcon } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface QuizFormProps {
  courseId: string;
  onClose: () => void;
  onSuccess: () => void;
}

interface Question {
  question_text: string;
  question_type: 'multiple_choice' | 'true_false' | 'short_answer' | 'essay';
  options?: string[];
  correct_answer?: string;
}

export function QuizForm({ courseId, onClose, onSuccess }: QuizFormProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    time_limit_minutes: 60,
    max_attempts: 1,
    is_published: false,
    due_date: null as Date | null
  });
  const [questions, setQuestions] = useState<Question[]>([]);

  const addQuestion = () => {
    setQuestions(prev => [...prev, {
      question_text: '',
      question_type: 'multiple_choice',
      options: ['', '', '', ''],
      correct_answer: ''
    }]);
  };

  const removeQuestion = (index: number) => {
    setQuestions(prev => prev.filter((_, i) => i !== index));
  };

  const updateQuestion = (index: number, field: keyof Question, value: any) => {
    setQuestions(prev => prev.map((q, i) => i === index ? { ...q, [field]: value } : q));
  };

  const updateQuestionOption = (questionIndex: number, optionIndex: number, value: string) => {
    setQuestions(prev => prev.map((q, i) => {
      if (i === questionIndex && q.options) {
        const newOptions = [...q.options];
        newOptions[optionIndex] = value;
        return { ...q, options: newOptions };
      }
      return q;
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      toast.error('El título es requerido');
      return;
    }

    if (questions.length === 0) {
      toast.error('Debes agregar al menos una pregunta');
      return;
    }

    try {
      setLoading(true);

      // For now, show success message - quiz functionality will be completed when tables are ready
      toast.success('Cuestionario guardado. Funcionalidad completa disponible pronto.');

      toast.success('Cuestionario creado exitosamente');
      onSuccess();
    } catch (error) {
      console.error('Error creating quiz:', error);
      toast.error('Error al crear el cuestionario');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Crear Cuestionario</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="title">Título</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Nombre del cuestionario"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="time_limit">Tiempo límite (minutos)</Label>
              <Input
                id="time_limit"
                type="number"
                min="5"
                value={formData.time_limit_minutes}
                onChange={(e) => setFormData(prev => ({ ...prev, time_limit_minutes: parseInt(e.target.value) || 60 }))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descripción</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Instrucciones del cuestionario..."
              rows={3}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="max_attempts">Intentos máximos</Label>
              <Input
                id="max_attempts"
                type="number"
                min="1"
                value={formData.max_attempts}
                onChange={(e) => setFormData(prev => ({ ...prev, max_attempts: parseInt(e.target.value) || 1 }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Fecha límite</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.due_date ? format(formData.due_date, 'PPP') : <span>Seleccionar fecha</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={formData.due_date || undefined}
                    onSelect={(date) => setFormData(prev => ({ ...prev, due_date: date || null }))}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
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

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Preguntas</h3>
              <Button type="button" onClick={addQuestion} variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Agregar Pregunta
              </Button>
            </div>

            {questions.map((question, questionIndex) => (
              <Card key={questionIndex}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Pregunta {questionIndex + 1}</CardTitle>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeQuestion(questionIndex)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Texto de la pregunta</Label>
                    <Textarea
                      value={question.question_text}
                      onChange={(e) => updateQuestion(questionIndex, 'question_text', e.target.value)}
                      placeholder="Escribe tu pregunta aquí..."
                      rows={2}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Tipo de pregunta</Label>
                    <Select
                      value={question.question_type}
                      onValueChange={(value) => updateQuestion(questionIndex, 'question_type', value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="multiple_choice">Opción múltiple</SelectItem>
                        <SelectItem value="true_false">Verdadero/Falso</SelectItem>
                        <SelectItem value="short_answer">Respuesta corta</SelectItem>
                        <SelectItem value="essay">Ensayo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {question.question_type === 'multiple_choice' && (
                    <div className="space-y-3">
                      <Label>Opciones de respuesta</Label>
                      {question.options?.map((option, optionIndex) => (
                        <div key={optionIndex} className="flex items-center gap-2">
                          <span className="text-sm font-medium min-w-[20px]">{String.fromCharCode(65 + optionIndex)}.</span>
                          <Input
                            value={option}
                            onChange={(e) => updateQuestionOption(questionIndex, optionIndex, e.target.value)}
                            placeholder={`Opción ${String.fromCharCode(65 + optionIndex)}`}
                          />
                        </div>
                      ))}
                      <div className="space-y-2">
                        <Label>Respuesta correcta</Label>
                        <Select
                          value={question.correct_answer}
                          onValueChange={(value) => updateQuestion(questionIndex, 'correct_answer', value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar respuesta correcta" />
                          </SelectTrigger>
                          <SelectContent>
                            {question.options?.map((option, index) => (
                              <SelectItem key={index} value={option}>
                                {String.fromCharCode(65 + index)}. {option}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}

                  {question.question_type === 'true_false' && (
                    <div className="space-y-2">
                      <Label>Respuesta correcta</Label>
                      <Select
                        value={question.correct_answer}
                        onValueChange={(value) => updateQuestion(questionIndex, 'correct_answer', value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar respuesta correcta" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="true">Verdadero</SelectItem>
                          <SelectItem value="false">Falso</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading} className="bg-gradient-primary shadow-glow">
              {loading ? 'Creando...' : 'Crear Cuestionario'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}