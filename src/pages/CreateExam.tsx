import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Plus, Trash2, CalendarIcon, ArrowLeft } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

interface Question {
  question_text: string;
  question_type: 'multiple_choice' | 'true_false' | 'short_answer' | 'essay';
  options?: string[];
  correct_answer?: string;
}

export default function CreateExam() {
  const { moduloId } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  
  // Inicializar con fecha/hora actual en zona horaria local
  const initializeDateTime = () => {
    const now = new Date();
    // Crear fecha sin conversión de zona horaria
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0, 0, 0);
  };
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    start_time: initializeDateTime(),
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
    
    if (!profile?.id || !moduloId) {
      toast.error('No se pudo obtener la información necesaria');
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

    // Validar que la fecha/hora sea futura
    if (formData.start_time <= new Date()) {
      toast.error('La fecha y hora del examen debe ser futura');
      return;
    }

    if (questions.length === 0) {
      toast.error('Debes agregar al menos una pregunta');
      return;
    }

    // Validar que todas las preguntas estén completas
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      
      if (!q.question_text.trim()) {
        toast.error(`La pregunta ${i + 1} debe tener texto`);
        return;
      }

      if (q.question_type === 'multiple_choice') {
        if (!q.options || q.options.some(opt => !opt.trim())) {
          toast.error(`La pregunta ${i + 1} debe tener todas las opciones completadas`);
          return;
        }
        if (!q.correct_answer) {
          toast.error(`La pregunta ${i + 1} debe tener una respuesta correcta seleccionada`);
          return;
        }
      }

      if (q.question_type === 'true_false' && !q.correct_answer) {
        toast.error(`La pregunta ${i + 1} debe tener una respuesta correcta (Verdadero/Falso)`);
        return;
      }
    }

    try {
      setLoading(true);

      // Primero, obtener información del módulo para el course_id (para tablas relacionadas)
      const { data: moduloData, error: moduloError } = await supabase
        .from('modulos')
        .select('course_id')
        .eq('id', moduloId)
        .single();

      if (moduloError) throw moduloError;

      // Guardar la hora tal cual fue ingresada (sin conversión de timezone)
      // Extraemos los componentes y formateamos como UTC
      const formatDateForDB = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        
        // Formato: YYYY-MM-DD HH:MM:SS (PostgreSQL lo interpretará como UTC)
        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}+00`;
      };

      const startTimeFormatted = formatDateForDB(formData.start_time);

      // Create the exam
      const { data: examData, error: examError } = await supabase
        .from('exams')
        .insert({
          modulo_id: moduloId,
          course_id: moduloData.course_id, // Mantener para retrocompatibilidad
          title: formData.title.trim(),
          description: formData.description.trim() || null,
          start_time: startTimeFormatted,
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
          modulo_id: moduloId,
          course_id: moduloData.course_id,
          title: formData.title.trim(),
          description: formData.description.trim() || null,
          time_limit_minutes: formData.duration_minutes,
          max_attempts: 1,
          is_published: formData.is_published,
          due_date: startTimeFormatted
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
      const endTimeFormatted = formatDateForDB(endTime);

      const { error: eventError } = await supabase
        .from('course_events')
        .insert({
          course_id: moduloData.course_id,
          title: `Examen: ${formData.title}`,
          description: formData.description || `Examen de ${formData.duration_minutes} minutos`,
          event_type: 'exam',
          start_date: startTimeFormatted,
          end_date: endTimeFormatted,
          is_published: formData.is_published,
          created_by: profile?.id
        });

      if (eventError) {
        console.error('Error creating event:', eventError);
        toast.error('Examen creado pero hubo un problema al crear el evento en el calendario');
      }

      toast.success('Examen creado exitosamente');
      navigate(`/courses/${moduloId}`);
    } catch (error) {
      console.error('Error creating exam:', error);
      toast.error('Error al crear el examen');
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Crear Examen</h1>
            <p className="text-muted-foreground">Define las preguntas y configuración del examen</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Información General</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
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

              <div className="space-y-2">
                <Label>Fecha y Hora del Examen *</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">Fecha</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className="w-full justify-start text-left font-normal"
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {format(formData.start_time, 'PPP', { locale: es })}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={formData.start_time}
                          onSelect={(date) => {
                            if (date) {
                              // Crear nueva fecha preservando hora y minuto, sin conversión de zona horaria
                              const hours = formData.start_time.getHours();
                              const minutes = formData.start_time.getMinutes();
                              const newDate = new Date(
                                date.getFullYear(), 
                                date.getMonth(), 
                                date.getDate(), 
                                hours, 
                                minutes, 
                                0, 
                                0
                              );
                              setFormData(prev => ({ ...prev, start_time: newDate }));
                            }
                          }}
                          disabled={(date) => {
                            // Normalizar ambas fechas a medianoche para comparar solo el día
                            const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
                            const todayOnly = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
                            return dateOnly < todayOnly;
                          }}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">Hora</Label>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <Label className="text-xs">Horas (0-23)</Label>
                        <Input
                          type="number"
                          min="0"
                          max="23"
                          value={formData.start_time.getHours()}
                          onChange={(e) => {
                            const value = e.target.value;
                            if (value === '') return;
                            const hours = parseInt(value);
                            if (!isNaN(hours) && hours >= 0 && hours <= 23) {
                              // Crear nueva fecha sin usar new Date() para evitar conversión de zona horaria
                              const current = formData.start_time;
                              const newDate = new Date(
                                current.getFullYear(),
                                current.getMonth(),
                                current.getDate(),
                                hours,
                                current.getMinutes(),
                                0,
                                0
                              );
                              setFormData(prev => ({ ...prev, start_time: newDate }));
                            } else {
                              toast.error('Las horas deben estar entre 0 y 23');
                            }
                          }}
                          onBlur={(e) => {
                            const value = e.target.value;
                            if (value === '') {
                              const current = formData.start_time;
                              const newDate = new Date(
                                current.getFullYear(),
                                current.getMonth(),
                                current.getDate(),
                                9,
                                current.getMinutes(),
                                0,
                                0
                              );
                              setFormData(prev => ({ ...prev, start_time: newDate }));
                            }
                          }}
                          placeholder="09"
                        />
                      </div>
                      <div className="flex items-end justify-center pb-2">
                        <span className="text-2xl font-bold">:</span>
                      </div>
                      <div className="flex-1">
                        <Label className="text-xs">Minutos (0-59)</Label>
                        <Input
                          type="number"
                          min="0"
                          max="59"
                          step="5"
                          value={formData.start_time.getMinutes().toString().padStart(2, '0')}
                          onChange={(e) => {
                            const value = e.target.value;
                            if (value === '') return;
                            const minutes = parseInt(value);
                            if (!isNaN(minutes) && minutes >= 0 && minutes <= 59) {
                              // Crear nueva fecha sin usar new Date() para evitar conversión de zona horaria
                              const current = formData.start_time;
                              const newDate = new Date(
                                current.getFullYear(),
                                current.getMonth(),
                                current.getDate(),
                                current.getHours(),
                                minutes,
                                0,
                                0
                              );
                              setFormData(prev => ({ ...prev, start_time: newDate }));
                            } else {
                              toast.error('Los minutos deben estar entre 0 y 59');
                            }
                          }}
                          onBlur={(e) => {
                            const value = e.target.value;
                            if (value === '') {
                              const current = formData.start_time;
                              const newDate = new Date(
                                current.getFullYear(),
                                current.getMonth(),
                                current.getDate(),
                                current.getHours(),
                                0,
                                0,
                                0
                              );
                              setFormData(prev => ({ ...prev, start_time: newDate }));
                            }
                          }}
                          placeholder="00"
                        />
                      </div>
                    </div>
                  </div>
                </div>
                {formData.start_time && (
                  <div className="text-sm text-muted-foreground bg-muted p-2 rounded-md">
                    <strong>Examen programado para:</strong> {format(formData.start_time, "EEEE, d 'de' MMMM 'de' yyyy 'a las' HH:mm", { locale: es })}
                  </div>
                )}
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="is_published"
                  checked={formData.is_published}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_published: checked }))}
                />
                <Label htmlFor="is_published">Publicar inmediatamente (visible para estudiantes)</Label>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Preguntas del Examen</CardTitle>
                <Button type="button" onClick={addQuestion} variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  Agregar Pregunta
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {questions.length === 0 && (
                <div className="text-center py-8 border-2 border-dashed rounded-lg">
                  <p className="text-muted-foreground">
                    No hay preguntas aún. Haz clic en "Agregar Pregunta" para comenzar.
                  </p>
                </div>
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
                        <div className="space-y-2 mt-3">
                          <Label>Respuesta correcta</Label>
                          <Select
                            value={question.correct_answer}
                            onValueChange={(value) => updateQuestion(questionIndex, 'correct_answer', value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccionar respuesta correcta" />
                            </SelectTrigger>
                            <SelectContent>
                              {question.options?.map((_, optionIndex) => (
                                <SelectItem key={optionIndex} value={String.fromCharCode(65 + optionIndex)}>
                                  Opción {String.fromCharCode(65 + optionIndex)}
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
            </CardContent>
          </Card>

          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={() => navigate(-1)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading} className="bg-gradient-primary shadow-glow">
              {loading ? 'Creando...' : 'Crear Examen'}
            </Button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}
