import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, ClipboardCheck } from 'lucide-react';

interface Question {
  id: string;
  text: string;
  type: 'rating' | 'text';
}

export function TeacherSurveyDialog({ isOpen, onClose, onSuccess, studentId, courseId }: any) {
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [comment, setComment] = useState("");

  // Preguntas por defecto por si no hay configuración en la DB
  const defaultQuestions: Question[] = [
    { id: 'q1', text: "¿El docente demostró dominio de los temas tratados?", type: 'rating' },
    { id: 'q2', text: "¿Las explicaciones fueron claras y facilitaron el aprendizaje?", type: 'rating' },
    { id: 'q3', text: "¿El docente cumplió con los horarios de clase?", type: 'rating' },
    { id: 'q4', text: "¿Los materiales (PDFs, enlaces) fueron útiles?", type: 'rating' }
  ];

  useEffect(() => {
    if (isOpen) {
      fetchConfigAndReset();
    }
  }, [isOpen, courseId]);

  const fetchConfigAndReset = async () => {
    setIsLoading(true);
    setAnswers({});
    setComment("");
    try {
      const { data, error } = await supabase
        .from('survey_configurations')
        .select('questions')
        .eq('modulo_id', courseId)
        .maybeSingle();

      if (data && data.questions && data.questions.length > 0) {
        setQuestions(data.questions);
      } else {
        setQuestions(defaultQuestions);
      }
    } catch (err) {
      console.error("Error cargando encuesta:", err);
      setQuestions(defaultQuestions);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    // Validar que todas las preguntas tengan respuesta (ya sean rating o text)
    const unanswered = questions.filter(q => !answers[q.id] || (typeof answers[q.id] === 'string' && answers[q.id].trim() === ""));
    
    if (unanswered.length > 0) {
      toast.error("Por favor, responde todas las preguntas antes de enviar.");
      return;
    }

    try {
      setIsSaving(true);
      const { error } = await supabase.from('teacher_surveys').insert({
        student_id: studentId,
        course_id: courseId,
        answers: answers,
        comment: comment // Comentario general del final
      });

      if (error) throw error;

      toast.success("¡Gracias! Encuesta enviada correctamente.");
      if (onSuccess) onSuccess();
      onClose();
    } catch (error: any) {
      console.error(error);
      toast.error("Error al enviar la encuesta: " + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[550px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-orange-100 rounded-lg text-orange-600">
              <ClipboardCheck className="h-5 w-5" />
            </div>
            <DialogTitle className="text-xl font-bold">Encuesta Docente</DialogTitle>
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            Tus respuestas son fundamentales para mantener la calidad educativa en Peri Institute.
          </p>
        </DialogHeader>

        {isLoading ? (
          <div className="py-10 flex justify-center">
            <Loader2 className="animate-spin text-orange-500 h-8 w-8" />
          </div>
        ) : (
          <div className="space-y-8 py-6">
            {questions.map((q, index) => (
              <div key={q.id} className="space-y-4 animate-in fade-in slide-in-from-bottom-2" style={{ animationDelay: `${index * 50}ms` }}>
                <Label className="text-base font-semibold text-gray-800 leading-tight block">
                  {index + 1}. {q.text}
                </Label>
                
                {/* LÓGICA DINÁMICA SEGÚN EL TIPO DE PREGUNTA */}
                {q.type === 'rating' ? (
                  <div className="space-y-2">
                    <div className="flex justify-between items-center gap-2 px-1">
                      {[1, 2, 3, 4, 5].map((val) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setAnswers({ ...answers, [q.id]: val })}
                          className={`flex-1 py-3 rounded-xl border-2 transition-all font-bold text-lg ${
                            answers[q.id] === val 
                              ? 'bg-orange-500 border-orange-500 text-white shadow-md scale-105' 
                              : 'bg-white border-gray-100 text-gray-400 hover:border-orange-200 hover:text-orange-400'
                          }`}
                        >
                          {val}
                        </button>
                      ))}
                    </div>
                    <div className="flex justify-between text-[10px] uppercase tracking-wider font-bold text-gray-400 px-2">
                      <span>Muy Deficiente</span>
                      <span>Excelente</span>
                    </div>
                  </div>
                ) : (
                  <Textarea 
                    placeholder="Escriba su respuesta detallada aquí..."
                    className="min-h-[80px] focus:border-orange-400 focus:ring-orange-400"
                    value={answers[q.id] || ""}
                    onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                  />
                )}
              </div>
            ))}

            {/* Comentario final general (opcional o fijo) */}
            <div className="space-y-3 pt-4 border-t">
              <Label className="font-bold text-gray-700 italic">¿Tienes algún otro comentario o sugerencia para la institución?</Label>
              <Textarea 
                placeholder="Tus comentarios nos ayudan a mejorar..." 
                value={comment} 
                onChange={(e) => setComment(e.target.value)}
                className="min-h-[100px] border-gray-200 focus:border-orange-400"
              />
            </div>
          </div>
        )}

        <DialogFooter className="sticky bottom-0 bg-white pt-4 border-t">
          <Button variant="ghost" onClick={onClose} disabled={isSaving}>Cancelar</Button>
          <Button 
            onClick={handleSave} 
            disabled={isSaving || isLoading} 
            className="bg-orange-600 hover:bg-orange-700 text-white px-8 font-bold"
          >
            {isSaving ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : null}
            Enviar Encuesta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}