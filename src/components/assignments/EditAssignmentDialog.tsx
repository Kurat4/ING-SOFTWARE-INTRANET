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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CalendarIcon, Clock, X, FileText, AlertCircle, Download } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface EditAssignmentDialogProps {
  assignmentId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface Course {
  id: string;
  name: string;
  code: string;
}

interface UploadedFile {
  file_path: string;
  file_name: string;
  file_size: number;
  mime_type: string;
}

export function EditAssignmentDialog({ assignmentId, open, onOpenChange, onSuccess }: EditAssignmentDialogProps) {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [courses, setCourses] = useState<Course[]>([]);
  const [moduloName, setModuloName] = useState<string>('');
  const [existingFiles, setExistingFiles] = useState<UploadedFile[]>([]);
  const [newFiles, setNewFiles] = useState<UploadedFile[]>([]);
  const [deletedFiles, setDeletedFiles] = useState<string[]>([]);
  const [resourceId, setResourceId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    course_id: '',
    title: '',
    description: '',
    due_date: null as Date | null,
    max_score: 100,
    is_published: false
  });

  useEffect(() => {
    if (open && assignmentId) {
      fetchAssignmentData();
      fetchTeacherCourses();
    }
  }, [open, assignmentId]);

  const fetchAssignmentData = async () => {
    if (!assignmentId) return;

    try {
      setLoadingData(true);

      const { data: assignment, error } = await supabase
        .from('assignments')
        .select(`
          *,
          modulo:modulos (
            id,
            name,
            code
          )
        `)
        .eq('id', assignmentId)
        .single();

      if (error) throw error;

      if (assignment) {
        setFormData({
          course_id: assignment.modulo_id,
          title: assignment.title,
          description: assignment.description || '',
          due_date: new Date(assignment.due_date),
          max_score: assignment.max_score,
          is_published: assignment.is_published
        });
        
        // Set modulo name for display
        if (assignment.modulo) {
          setModuloName(`${assignment.modulo.code} - ${assignment.modulo.name}`);
        }

        const { data: resource } = await supabase
          .from('course_weekly_resources')
          .select('id, teacher_files')
          .eq('assignment_id', assignmentId)
          .maybeSingle();

        if (resource) {
          setResourceId(resource.id);
          setExistingFiles(resource.teacher_files || []);
        }
      }
    } catch (error) {
      console.error('Error fetching assignment:', error);
      toast.error('Error al cargar la tarea');
    } finally {
      setLoadingData(false);
    }
  };

  const fetchTeacherCourses = async () => {
    if (!profile?.id) return;

    try {
      // Fetch modulos where the teacher is assigned
      const { data, error } = await supabase
        .from('modulos')
        .select('id, name, code')
        .or(`teacher_principal_id.eq.${profile.id},aditional_teachers.cs.{${profile.id}}`)
        .order('name');

      if (error) throw error;
      setCourses(data || []);
    } catch (error) {
      console.error('Error fetching courses:', error);
    }
  };

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    try {
      setUploading(true);
      const uploadedFiles: UploadedFile[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
        const filePath = `assignments/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('course_files')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        uploadedFiles.push({
          file_path: filePath,
          file_name: file.name,
          file_size: file.size,
          mime_type: file.type || 'application/octet-stream'
        });
      }

      setNewFiles(prev => [...prev, ...uploadedFiles]);
      toast.success(`${uploadedFiles.length} archivo(s) subido(s)`);
    } catch (error) {
      console.error('Error uploading files:', error);
      toast.error('Error al subir archivos');
    } finally {
      setUploading(false);
    }
  };

  const removeExistingFile = (filePath: string) => {
    setExistingFiles(prev => prev.filter(f => f.file_path !== filePath));
    setDeletedFiles(prev => [...prev, filePath]);
  };

  const removeNewFile = (index: number) => {
    setNewFiles(prev => prev.filter((_, i) => i !== index));
  };

  const downloadFile = async (filePath: string, fileName: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('course-documents')
        .download(filePath);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading file:', error);
      toast.error('Error al descargar el archivo');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!assignmentId) return;

    if (!formData.title.trim()) {
      toast.error('El título es requerido');
      return;
    }

    if (!formData.due_date) {
      toast.error('Debes seleccionar una fecha límite');
      return;
    }

    try {
      setLoading(true);

      const { error: assignmentError } = await supabase
        .from('assignments')
        .update({
          title: formData.title.trim(),
          description: formData.description.trim() || null,
          due_date: formData.due_date.toISOString(),
          max_score: formData.max_score,
          is_published: formData.is_published
        })
        .eq('id', assignmentId);

      if (assignmentError) throw assignmentError;

      for (const filePath of deletedFiles) {
        await supabase.storage
          .from('course-documents')
          .remove([filePath]);
      }

      const allFiles = [...existingFiles, ...newFiles];
      
      if (resourceId) {
        const { error: resourceError } = await supabase
          .from('course_weekly_resources')
          .update({
            title: formData.title.trim(),
            description: formData.description.trim() || null,
            assignment_deadline: formData.due_date.toISOString(),
            is_published: formData.is_published,
            teacher_files: allFiles
          })
          .eq('id', resourceId);

        if (resourceError) throw resourceError;
      } else if (allFiles.length > 0) {
        const { data: sections } = await supabase
          .from('course_weekly_sections')
          .select('id')
          .eq('course_id', formData.course_id)
          .order('week_number', { ascending: false })
          .limit(1);

        if (sections && sections.length > 0) {
          await supabase
            .from('course_weekly_resources')
            .insert({
              section_id: sections[0].id,
              title: formData.title.trim(),
              description: formData.description.trim() || null,
              resource_type: 'assignment',
              assignment_id: assignmentId,
              assignment_deadline: formData.due_date.toISOString(),
              is_published: formData.is_published,
              position: 0,
              teacher_files: allFiles
            });
        }
      }

      toast.success('Tarea actualizada exitosamente');
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Error updating assignment:', error);
      toast.error('Error al actualizar la tarea');
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
          <DialogTitle>Editar Tarea</DialogTitle>
          <DialogDescription>
            Modifica los datos de la tarea
          </DialogDescription>
        </DialogHeader>

        {loadingData ? (
          <div className="space-y-4 py-8">
            <div className="h-10 bg-muted rounded animate-pulse" />
            <div className="h-10 bg-muted rounded animate-pulse" />
            <div className="h-32 bg-muted rounded animate-pulse" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {formData.is_published && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Esta tarea está publicada. Los estudiantes verán los cambios inmediatamente.
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="modulo">Módulo</Label>
              <Input
                id="modulo"
                value={moduloName}
                disabled
                className="bg-muted"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Título</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descripción</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                rows={5}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Fecha Límite</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={`w-full justify-start text-left font-normal h-auto py-3 ${
                        !formData.due_date && 'text-muted-foreground'
                      }`}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4 flex-shrink-0" />
                      <div className="flex flex-col items-start">
                        {formData.due_date ? (
                          <>
                            <span className="font-semibold">
                              {format(formData.due_date, "EEEE, d 'de' MMMM", { locale: es })}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {format(formData.due_date, "yyyy 'a las' HH:mm", { locale: es })}
                            </span>
                          </>
                        ) : (
                          <span>Selecciona fecha</span>
                        )}
                      </div>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <div className="p-3 border-b bg-muted/50">
                      <p className="text-sm font-medium">Fecha límite</p>
                    </div>
                    <Calendar
                      mode="single"
                      selected={formData.due_date || undefined}
                      onSelect={(date) => {
                        if (date) {
                          const newDate = formData.due_date ? new Date(formData.due_date) : new Date();
                          newDate.setFullYear(date.getFullYear());
                          newDate.setMonth(date.getMonth());
                          newDate.setDate(date.getDate());
                          setFormData(prev => ({ ...prev, due_date: newDate }));
                        }
                      }}
                      initialFocus
                    />
                    <div className="p-3 border-t bg-muted/50">
                      <Label className="text-sm font-medium mb-2 block">Hora</Label>
                      <div className="flex gap-2 items-center">
                        <Clock className="w-4 h-4 text-muted-foreground" />
                        <Input
                          type="time"
                          className="flex-1"
                          value={formData.due_date ? format(formData.due_date, 'HH:mm') : '23:59'}
                          onChange={(e) => {
                            if (e.target.value && formData.due_date) {
                              const [hours, minutes] = e.target.value.split(':');
                              const newDate = new Date(formData.due_date);
                              newDate.setHours(parseInt(hours), parseInt(minutes));
                              setFormData(prev => ({ ...prev, due_date: newDate }));
                            }
                          }}
                        />
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label htmlFor="max_score">Puntuación Máxima</Label>
                <Input
                  id="max_score"
                  type="number"
                  value={formData.max_score}
                  onChange={(e) => setFormData(prev => ({ ...prev, max_score: parseInt(e.target.value) || 100 }))}
                />
              </div>
            </div>

            <div className="space-y-3">
              <Label>Archivos</Label>

              {existingFiles.length > 0 && (
                <div className="space-y-2">
                  {existingFiles.map((file, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border">
                      <div className="flex items-center gap-2 flex-1">
                        <FileText className="w-4 h-4" />
                        <div className="flex-1">
                          <p className="text-sm font-medium truncate">{file.file_name}</p>
                          <p className="text-xs text-muted-foreground">{formatFileSize(file.file_size)}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => downloadFile(file.file_path, file.file_name)}
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeExistingFile(file.file_path)}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {newFiles.length > 0 && (
                <div className="space-y-2">
                  {newFiles.map((file, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-primary/5 rounded-lg border border-primary/20">
                      <div className="flex items-center gap-2 flex-1">
                        <FileText className="w-4 h-4 text-primary" />
                        <div>
                          <p className="text-sm font-medium">{file.file_name}</p>
                          <p className="text-xs text-muted-foreground">{formatFileSize(file.file_size)}</p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeNewFile(index)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <FileUpload
                onFileSelect={handleFileUpload}
                disabled={uploading}
                multiple
              />
            </div>

            <div className="flex items-center space-x-2 p-4 bg-muted/50 rounded-lg">
              <Switch
                id="is_published"
                checked={formData.is_published}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_published: checked }))}
              />
              <Label htmlFor="is_published">Publicar tarea</Label>
            </div>

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
                className="bg-gradient-primary"
              >
                {loading ? 'Guardando...' : 'Guardar'}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
