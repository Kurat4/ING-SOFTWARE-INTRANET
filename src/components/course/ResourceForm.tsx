import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { FileUpload } from '@/components/ui/file-upload';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { FileText, Video, ExternalLink, BookOpen, Upload } from 'lucide-react';

interface ResourceFormProps {
  sectionId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function ResourceForm({ sectionId, onClose, onSuccess }: ResourceFormProps) {
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<Array<{file_path: string; file_name: string; file_size: number; mime_type: string}>>([]);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    resource_type: 'material' as 'material' | 'document' | 'video' | 'link',
    resource_url: '',
    file_path: '',
    is_published: false,
    assignment_deadline: '',
    allows_student_submissions: false
  });

  const resourceTypes = [
    { value: 'material', label: 'Material de Estudio', icon: BookOpen, description: 'Contenido educativo como PDFs, presentaciones' },
    { value: 'document', label: 'Archivo', icon: FileText, description: 'Documentos, hojas de trabajo, referencias' },
    { value: 'video', label: 'Video/Audio', icon: Video, description: 'Contenido multimedia educativo' },
    { value: 'link', label: 'Enlace Web', icon: ExternalLink, description: 'Enlaces a recursos externos' },
  ];

  const handleFileUpload = async (files: File[]) => {
    if (files.length === 0) return;
    
    setUploading(true);
    try {
      const bucketName = formData.resource_type === 'video' ? 'course-videos' : 'course-documents';
      const newFiles: Array<{file_path: string; file_name: string; file_size: number; mime_type: string}> = [];
      
      for (const file of files) {
        // Validar tamaño de archivo (5MB)
        if (file.size > 5 * 1024 * 1024) {
          toast.error(`${file.name} excede el límite de 5MB. Usa Google Drive para archivos más grandes.`);
          continue;
        }

        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        
        const { data, error } = await supabase.storage
          .from(bucketName)
          .upload(`${sectionId}/${fileName}`, file);

        if (error) throw error;

        newFiles.push({
          file_path: data.path,
          file_name: file.name,
          file_size: file.size,
          mime_type: file.type
        });
      }
      
      setUploadedFiles(prev => [...prev, ...newFiles]);
      
      // Si es el primer archivo y no hay título, usar el nombre del primer archivo
      if (!formData.title && newFiles.length > 0) {
        setFormData(prev => ({ 
          ...prev, 
          title: newFiles[0].file_name.replace(/\.[^/.]+$/, "")
        }));
      }
      
      toast.success(`${newFiles.length} archivo(s) subido(s) exitosamente`);
    } catch (error) {
      console.error('Error uploading file:', error);
      toast.error('Error al subir el archivo');
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

    setLoading(true);
    try {
      // Convertir la fecha al formato ISO con zona horaria
      let deadlineISO = null;
      if (formData.assignment_deadline) {
        // El datetime-local devuelve "YYYY-MM-DDTHH:mm", lo convertimos a ISO con zona horaria
        deadlineISO = new Date(formData.assignment_deadline).toISOString();
      }

      let assignmentId = null;

      // Si es una tarea, crear el registro en la tabla assignments
      if (formData.resource_type === 'assignment') {
        // Obtener el course_id de la sección
        const { data: sectionData, error: sectionError } = await supabase
          .from('course_weekly_sections')
          .select('course_id')
          .eq('id', sectionId)
          .single();

        if (sectionError) throw sectionError;

        // Crear el assignment
        const { data: assignmentData, error: assignmentError } = await supabase
          .from('assignments')
          .insert({
            course_id: sectionData.course_id,
            title: formData.title.trim(),
            description: formData.description.trim() || null,
            due_date: deadlineISO,
            is_published: formData.is_published
          })
          .select()
          .single();

        if (assignmentError) throw assignmentError;
        assignmentId = assignmentData.id;
      }

      const insertData = {
        section_id: sectionId,
        title: formData.title.trim(),
        description: formData.description.trim() || null,
        resource_type: formData.resource_type,
        resource_url: formData.resource_url.trim() || null,
        file_path: uploadedFiles.length > 0 ? uploadedFiles[0].file_path : (formData.file_path || null),
        is_published: formData.is_published,
        position: 0,
        assignment_deadline: deadlineISO,
        allows_student_submissions: (formData.resource_type === 'assignment' || formData.resource_type === 'exam') ? formData.allows_student_submissions : false,
        assignment_id: assignmentId,
        teacher_files: uploadedFiles
      };

      console.log('📤 Intentando crear recurso:', insertData);

      const { error } = await supabase
        .from('course_weekly_resources')
        .insert(insertData);

      if (error) {
        console.error('❌ Error de Supabase:', error);
        console.error('❌ Detalles completos:', JSON.stringify(error, null, 2));
        throw error;
      }

      console.log('✅ Recurso creado exitosamente');
      toast.success('Recurso creado exitosamente');
      onSuccess();
    } catch (error) {
      console.error('❌ Error creating resource:', error);
      toast.error('Error al crear el recurso. Revisa la consola para más detalles.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Agregar Nuevo Recurso
          </DialogTitle>
          <DialogDescription>
            Sube archivos o crea actividades para tus estudiantes. Inspirado en Moodle para una experiencia familiar.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-3">
            <Label>Tipo de Recurso *</Label>
            <div className="grid grid-cols-3 gap-2">
              {resourceTypes.map((type) => {
                const Icon = type.icon;
                return (
                  <Button
                    key={type.value}
                    type="button"
                    variant={formData.resource_type === type.value ? "default" : "outline"}
                    className="h-20 flex flex-col gap-1 p-2"
                    onClick={() => setFormData(prev => ({ ...prev, resource_type: type.value as any }))}
                  >
                    <Icon className="h-6 w-6" />
                    <span className="text-xs text-center leading-tight">{type.label}</span>
                  </Button>
                );
              })}
            </div>
            {/* Descripción contextual del tipo seleccionado */}
            <div className="bg-muted/50 p-3 rounded-lg text-sm">
              {formData.resource_type === 'material' && (
                <p><strong>Material de Estudio:</strong> Documentos, presentaciones o recursos educativos para consulta.</p>
              )}
              {formData.resource_type === 'document' && (
                <p><strong>Documento:</strong> Archivos PDF, Word, Excel u otros documentos descargables.</p>
              )}
              {formData.resource_type === 'video' && (
                <p><strong>Video:</strong> Contenido multimedia para clases o explicaciones.</p>
              )}
              {formData.resource_type === 'link' && (
                <p><strong>Enlace Web:</strong> Enlaces a sitios web externos o recursos online.</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">Título *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Nombre del recurso"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descripción</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Descripción opcional del recurso"
              rows={3}
            />
          </div>

          {/* --- AQUÍ ESTÁ LA CORRECCIÓN: ZONA DINÁMICA DE URL vs ARCHIVO --- */}
          {formData.resource_type === 'link' ? (
             <div className="space-y-2">
               <Label htmlFor="resource_url">URL del Enlace *</Label>
               <Input
                 id="resource_url"
                 type="url"
                 value={formData.resource_url}
                 onChange={(e) => setFormData(prev => ({ ...prev, resource_url: e.target.value }))}
                 placeholder="https://ejemplo.com/recurso"
                 required
               />
               <p className="text-xs text-muted-foreground">
                 Pega aquí la dirección completa del sitio web.
               </p>
             </div>
          ) : (
            <div className="space-y-2">
              <Label>📁 Subir Archivos (máximo 5MB por archivo)</Label>
              <div className="border-2 border-dashed border-muted rounded-lg p-4">
                <FileUpload
                  onFileSelect={handleFileUpload}
                  multiple={true}
                  accept={
                    formData.resource_type === 'video' ? 'video/*' : 
                    formData.resource_type === 'document' ? '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx' : 
                    undefined
                  }
                />
                {uploading && (
                  <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                    Subiendo archivo(s)...
                  </div>
                )}
                {uploadedFiles.length > 0 && (
                  <div className="mt-3 space-y-2">
                    <p className="text-sm font-medium">Archivos adjuntos ({uploadedFiles.length}):</p>
                    {uploadedFiles.map((file, index) => (
                      <div key={index} className="flex items-center justify-between gap-2 p-2 bg-muted rounded-lg">
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText className="h-4 w-4 flex-shrink-0 text-primary" />
                          <div className="min-w-0">
                            <p className="text-sm truncate">{file.file_name}</p>
                            <p className="text-xs text-muted-foreground">{(file.file_size / 1024).toFixed(2)} KB</p>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFile(index)}
                          className="flex-shrink-0"
                        >
                          ✕
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Switch
                id="is_published"
                checked={formData.is_published}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_published: checked }))}
              />
              <Label htmlFor="is_published">Hacer visible para estudiantes</Label>
            </div>
            <p className="text-xs text-muted-foreground">
              Si no está marcado, solo tú podrás ver este recurso hasta que lo publiques
            </p>
          </div>

          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading || uploading}>
              {loading ? 'Creando...' : 'Crear Recurso'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}