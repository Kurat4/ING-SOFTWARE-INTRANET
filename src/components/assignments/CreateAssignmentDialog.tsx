import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { FileUpload } from '@/components/ui/file-upload';
import { CalendarIcon, Clock, Upload, X, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface CreateAssignmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  moduleId: string; // ID del módulo donde se creará la tarea
}

interface UploadedFile {
  file_path: string;
  file_name: string;
  file_size: number;
  mime_type: string;
}

export function CreateAssignmentDialog({ open, onOpenChange, onSuccess, moduleId }: CreateAssignmentDialogProps) {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  
  // Inicializar con fecha/hora actual
  const initializeDateTime = () => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 0, 0);
  };
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    due_date: initializeDateTime(),
    max_score: 100,
    is_published: false
  });

  // No se necesitan useEffects ni funciones de carga de cursos/semanas

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    try {
      setUploading(true);
      const newFiles: UploadedFile[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
        const filePath = `assignments/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('course-documents')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        newFiles.push({
          file_path: filePath,
          file_name: file.name,
          file_size: file.size,
          mime_type: file.type || 'application/octet-stream'
        });
      }

      setUploadedFiles(prev => [...prev, ...newFiles]);
      toast.success(`${newFiles.length} archivo(s) subido(s) exitosamente`);
    } catch (error) {
      console.error('Error uploading files:', error);
      toast.error('Error al subir archivos');
    } finally {
      setUploading(false);
    }
  };

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      toast.error('El título es requerido');
      return;
    }

    try {
      setLoading(true);

      // Obtener información del módulo para el course_id (retrocompatibilidad)
      const { data: moduloData, error: moduloError } = await supabase
        .from('modulos')
        .select('course_id')
        .eq('id', moduleId)
        .single();

      if (moduloError) throw moduloError;

      // Guardar la hora tal cual fue ingresada (sin conversión de timezone)
      const formatDateForDB = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        
        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}+00`;
      };

      // Create the assignment
      const { data: assignmentData, error: assignmentError } = await supabase
        .from('assignments')
        .insert({
          modulo_id: moduleId,
          course_id: moduloData.course_id,
          title: formData.title.trim(),
          description: formData.description.trim() || null,
          due_date: formatDateForDB(formData.due_date),
          max_score: formData.max_score,
          is_published: formData.is_published
        })
        .select()
        .single();

      if (assignmentError) throw assignmentError;

      toast.success('Tarea creada exitosamente');
      
      // Reset form
      setFormData({
        title: '',
        description: '',
        due_date: initializeDateTime(),
        max_score: 100,
        is_published: false
      });
      setUploadedFiles([]);
      
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Error creating assignment:', error);
      toast.error('Error al crear la tarea');
    } finally {
      setLoading(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Crear Nueva Tarea</DialogTitle>
          <DialogDescription>
            Completa los datos para crear una tarea para tus estudiantes
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title" className="required">Título de la Tarea</Label>
            <Input
              id="title"
              placeholder="Ej: Resolver ejercicios de matemáticas"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              maxLength={200}
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Descripción e Instrucciones</Label>
            <Textarea
              id="description"
              placeholder="Describe la tarea y proporciona instrucciones claras para los estudiantes..."
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              rows={5}
            />
          </div>

          {/* Due Date and Time */}
          <div className="space-y-2">
            <Label className="required">Fecha y Hora Límite</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Fecha</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(formData.due_date, 'PPP', { locale: es })}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={formData.due_date}
                      onSelect={(date) => {
                        if (date) {
                          const hours = formData.due_date.getHours();
                          const minutes = formData.due_date.getMinutes();
                          const newDate = new Date(
                            date.getFullYear(),
                            date.getMonth(),
                            date.getDate(),
                            hours,
                            minutes,
                            0,
                            0
                          );
                          setFormData(prev => ({ ...prev, due_date: newDate }));
                        }
                      }}
                      disabled={(date) => {
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
                      value={formData.due_date.getHours()}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value === '') return;
                        const hours = parseInt(value);
                        if (!isNaN(hours) && hours >= 0 && hours <= 23) {
                          const current = formData.due_date;
                          const newDate = new Date(
                            current.getFullYear(),
                            current.getMonth(),
                            current.getDate(),
                            hours,
                            current.getMinutes(),
                            0,
                            0
                          );
                          setFormData(prev => ({ ...prev, due_date: newDate }));
                        }
                      }}
                      placeholder="23"
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
                      value={formData.due_date.getMinutes().toString().padStart(2, '0')}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value === '') return;
                        const minutes = parseInt(value);
                        if (!isNaN(minutes) && minutes >= 0 && minutes <= 59) {
                          const current = formData.due_date;
                          const newDate = new Date(
                            current.getFullYear(),
                            current.getMonth(),
                            current.getDate(),
                            current.getHours(),
                            minutes,
                            0,
                            0
                          );
                          setFormData(prev => ({ ...prev, due_date: newDate }));
                        }
                      }}
                      placeholder="59"
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="text-sm text-muted-foreground bg-muted p-2 rounded-md">
              <strong>Fecha límite:</strong> {format(formData.due_date, "EEEE, d 'de' MMMM 'de' yyyy 'a las' HH:mm", { locale: es })}
            </div>
          </div>

          {/* Max Score */}
          <div className="space-y-2">
            <Label htmlFor="max_score">Puntuación Máxima</Label>
            <Input
              id="max_score"
              type="number"
              min="1"
              max="1000"
              value={formData.max_score}
              onChange={(e) => setFormData(prev => ({ ...prev, max_score: parseInt(e.target.value) || 100 }))}
            />
            <p className="text-xs text-muted-foreground">
              Esta puntuación es referencial. La calificación final será en escala literal (AD, A, B, C).
            </p>
          </div>

          {/* File Upload */}
          <div className="space-y-2">
            <Label>Archivos de Apoyo (Opcional)</Label>
            <p className="text-sm text-muted-foreground mb-2">
              Sube documentos, PDFs, imágenes u otros archivos que ayuden a los estudiantes
            </p>
            
            <FileUpload
              onFileSelect={handleFileUpload}
              disabled={uploading}
              accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.jpg,.jpeg,.png,.gif,.zip,.rar"
              multiple
            />

            {uploading && (
              <div className="text-sm text-muted-foreground">
                Subiendo archivos...
              </div>
            )}

            {uploadedFiles.length > 0 && (
              <div className="space-y-2 mt-3">
                <Label className="text-sm">Archivos Subidos:</Label>
                {uploadedFiles.map((file, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-muted rounded">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <FileText className="w-4 h-4 flex-shrink-0" />
                      <span className="text-sm truncate">{file.file_name}</span>
                      <span className="text-xs text-muted-foreground flex-shrink-0">
                        ({formatFileSize(file.file_size)})
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(index)}
                      className="flex-shrink-0"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Publish Toggle */}
          <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center space-x-2">
              <Switch
                id="is_published"
                checked={formData.is_published}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_published: checked }))}
              />
              <Label htmlFor="is_published" className="cursor-pointer">
                Publicar inmediatamente
              </Label>
            </div>
            <p className="text-xs text-muted-foreground">
              {formData.is_published 
                ? 'La tarea será visible para los estudiantes inmediatamente' 
                : 'La tarea quedará en borrador. Podrás publicarla más tarde'}
            </p>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading || uploading}
              className="bg-gradient-primary shadow-glow"
            >
              {loading ? 'Creando...' : 'Crear Tarea'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
