import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Trash2, CalendarIcon, Clock } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

interface ExamFormProps {
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

export function ExamForm({ courseId, onClose, onSuccess }: ExamFormProps) {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    start_time: null as Date | null,
    duration_minutes: 60,
    is_published: false
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
    
    if (!profile?.id) {
      toast.error('No se pudo obtener tu perfil. Intenta recargar la página');
      return;
    }

    if (!formData.title.trim()) {
      toast.error('El título es requerido');
      return;
    }

    if (!formData.start_time) {
      toast.error('Debes seleccionar la fecha y hora del examen');
      return;
    }

    if (questions.length === 0) {
      toast.error('Debes agregar al menos una pregunta');
      return;
    }

    try {
      setLoading(true);

      // Create the exam
      const { data: examData, error: examError } = await supabase
        .from('exams')
        .insert({
          course_id: courseId,
          title: formData.title.trim(),
          description: formData.description.trim() || null,
          start_time: formData.start_time.toISOString(),
          duration_minutes: formData.duration_minutes,
          is_published: formData.is_published
        })
        .select()
        .single();

      if (examError) throw examError;

      // Create the quiz for the exam
      const { data: quizData, error: quizError } = await supabase
        .from('quizzes')
        .insert({
          course_id: courseId,
          title: formData.title.trim(),
          description: formData.description.trim() || null,
          time_limit_minutes: formData.duration_minutes,
          max_attempts: 1,
          is_published: formData.is_published,
          due_date: formData.start_time.toISOString()
        })
        .select()
        .single();

      if (quizError) throw quizError;

      // Create questions
      const questionsToInsert = questions.map((q, index) => ({
        quiz_id: quizData.id,
        question_text: q.question_text,
        question_type: q.question_type,
        options: q.options || null,
        correct_answer: q.correct_answer || null,
        position: index
      }));

      const { error: questionsError } = await supabase
        .from('quiz_questions')
        .insert(questionsToInsert);

      if (questionsError) throw questionsError;

      // Create course event for the exam
      const endTime = new Date(formData.start_time);
      endTime.setMinutes(endTime.getMinutes() + formData.duration_minutes);

      const { error: eventError } = await supabase
        .from('course_events')
        .insert({
          course_id: courseId,
          title: `Examen: ${formData.title}`,
          description: formData.description || `Examen de ${formData.duration_minutes} minutos`,
          event_type: 'exam',
          start_date: formData.start_time.toISOString(),
          end_date: endTime.toISOString(),
          is_published: formData.is_published,
          created_by: profile?.id
        });

      if (eventError) {
        console.error('Error creating event:', eventError);
        toast.error('Examen creado pero hubo un problema al crear el evento en el calendario');
      }

      toast.success('Examen creado exitosamente y agregado al calendario del curso');
      onSuccess();
    } catch (error) {
      console.error('Error creating exam:', error);
      toast.error('Error al crear el examen');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Crear Examen</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="title">Título del Examen *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Ej: Examen Final de Matemáticas"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="duration">Duración (minutos) *</Label>
              <Input
                id="duration"
                type="number"
                min="5"
                value={formData.duration_minutes}
                onChange={(e) => setFormData(prev => ({ ...prev, duration_minutes: parseInt(e.target.value) || 60 }))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descripción</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Instrucciones y detalles del examen..."
              rows={3}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Fecha y Hora del Examen *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.start_time ? format(formData.start_time, 'PPP p') : <span>Seleccionar fecha y hora</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={formData.start_time || undefined}
                    onSelect={(date) => {
                      if (date) {
                        const newDate = formData.start_time ? new Date(formData.start_time) : new Date();
                        date.setHours(newDate.getHours(), newDate.getMinutes());
                        setFormData(prev => ({ ...prev, start_time: date }));
                      }
                    }}
                    initialFocus
                  />
                  <div className="p-3 border-t">
                    <Label className="text-xs">Hora</Label>
                    <div className="flex gap-2 mt-1">
                      <Input
                        type="time"
                        value={formData.start_time ? format(formData.start_time, 'HH:mm') : ''}
                        onChange={(e) => {
                          if (formData.start_time && e.target.value) {
                            const [hours, minutes] = e.target.value.split(':');
                            const newDate = new Date(formData.start_time);
                            newDate.setHours(parseInt(hours), parseInt(minutes));
                            setFormData(prev => ({ ...prev, start_time: newDate }));
                          }
                        }}
                      />
                    </div>
                  </div>
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
            <Label htmlFor="is_published">Publicar inmediatamente (visible para estudiantes)</Label>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Preguntas del Examen</h3>
              <Button type="button" onClick={addQuestion} variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Agregar Pregunta
              </Button>
            </div>

            {questions.length === 0 && (
              <Card className="border-dashed">
                <CardContent className="text-center py-8">
                  <p className="text-muted-foreground">
                    No hay preguntas aún. Haz clic en "Agregar Pregunta" para comenzar.
                  </p>
                </CardContent>
              </Card>
            )}

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
                    <Label>Texto de la pregunta *</Label>
                    <Textarea
                      value={question.question_text}
                      onChange={(e) => updateQuestion(questionIndex, 'question_text', e.target.value)}
                      placeholder="Escribe tu pregunta aquí..."
                      rows={2}
                      required
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
                            {question.options?.filter(opt => opt.trim() !== '').map((option, index) => (
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

                  {question.question_type === 'short_answer' && (
                    <div className="space-y-2">
                      <Label>Respuesta esperada (opcional, para referencia del profesor)</Label>
                      <Input
                        value={question.correct_answer || ''}
                        onChange={(e) => updateQuestion(questionIndex, 'correct_answer', e.target.value)}
                        placeholder="Escribe la respuesta esperada..."
                      />
                    </div>
                  )}

                  {question.question_type === 'essay' && (
                    <div className="p-3 bg-muted rounded-md">
                      <p className="text-sm text-muted-foreground">
                        Las preguntas de ensayo se califican manualmente. Los estudiantes tendrán un cuadro de texto para escribir su respuesta.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="flex gap-2 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading} className="bg-gradient-primary shadow-glow">
              {loading ? 'Creando...' : 'Crear Examen'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
