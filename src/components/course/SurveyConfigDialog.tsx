import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Save, Loader2, Settings2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function SurveyConfigDialog({ isOpen, onClose, moduloId }: any) {
  const [questions, setQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) fetchConfig();
  }, [isOpen, moduloId]);

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('survey_configurations')
        .select('questions')
        .eq('modulo_id', moduloId)
        .maybeSingle();
      
      if (error) throw error;
      if (data) setQuestions(data.questions);
      else setQuestions([]); // Si no hay, empezar vacío
    } catch (error: any) {
      console.error("Error al cargar config:", error.message);
    } finally {
      setLoading(false);
    }
  };

  const addQuestion = () => {
    const newQ = { 
      id: crypto.randomUUID(), 
      text: "", 
      type: "rating" // Por defecto tipo escala
    };
    setQuestions([...questions, newQ]);
  };

  const removeQuestion = (id: string) => {
    setQuestions(questions.filter(q => q.id !== id));
  };

  const updateQuestion = (id: string, field: string, value: string) => {
    setQuestions(questions.map(q => q.id === id ? { ...q, [field]: value } : q));
  };

  const handleSave = async () => {
    // Validar que no haya preguntas vacías
    if (questions.some(q => q.text.trim() === "")) {
      toast.error("Todas las preguntas deben tener un enunciado");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('survey_configurations')
        .upsert({ 
          modulo_id: moduloId, 
          questions: questions,
          is_active: true 
        }, { onConflict: 'modulo_id' });

      if (error) throw error;
      
      toast.success("Encuesta configurada correctamente");
      onClose();
    } catch (error: any) {
      toast.error("Error al guardar: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-blue-600" />
            Configurar Encuesta Docente
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-2 py-4 space-y-6">
          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="animate-spin h-8 w-8 text-blue-600" /></div>
          ) : (
            <>
              {questions.length === 0 && (
                <div className="text-center py-10 border-2 border-dashed rounded-xl text-muted-foreground">
                  No hay preguntas configuradas. Haz clic abajo para agregar la primera.
                </div>
              )}
              
              {questions.map((q, index) => (
                <div key={q.id} className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-4 relative group animate-in fade-in zoom-in-95">
                  <div className="flex justify-between items-center">
                    <Badge variant="secondary">Pregunta #{index + 1}</Badge>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="text-red-500 hover:text-red-700 hover:bg-red-50" 
                      onClick={() => removeQuestion(q.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase text-slate-500">Enunciado</Label>
                    <Input 
                      value={q.text} 
                      onChange={(e) => updateQuestion(q.id, "text", e.target.value)}
                      placeholder="Ej: ¿El docente domina los temas tratados?" 
                      className="bg-white"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase text-slate-500">Tipo de Respuesta</Label>
                    <Select 
                      value={q.type} 
                      onValueChange={(val) => updateQuestion(q.id, "type", val)}
                    >
                      <SelectTrigger className="bg-white">
                        <SelectValue placeholder="Seleccionar tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="rating">🔢 Escala (1 al 5)</SelectItem>
                        <SelectItem value="text">📝 Texto Abierto (Comentario)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ))}
            </>
          )}

          <Button variant="outline" className="w-full border-dashed py-6 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-all" onClick={addQuestion}>
            <Plus className="h-4 w-4 mr-2" /> Agregar Nueva Pregunta
          </Button>
        </div>

        <DialogFooter className="pt-4 border-t">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving || loading} className="bg-blue-600 hover:bg-blue-700 text-white px-8">
            {saving ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Save className="mr-2 h-4 w-4" />} 
            Guardar Estructura
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}