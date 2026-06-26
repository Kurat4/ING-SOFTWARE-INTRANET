import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formatDateTimeInUserTimezone } from '@/lib/timezoneUtils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  FileText, 
  Link2, 
  ClipboardList, 
  Video, 
  FileImage, 
  Download, 
  ExternalLink, 
  Calendar,
  Clock,
  Target
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface WeeklyResource {
  id: string;
  title: string;
  description?: string;
  resource_type: 'material' | 'exam' | 'link' | 'assignment' | 'video' | 'document';
  resource_url?: string;
  file_path?: string;
  file_size?: number;
  mime_type?: string;
  is_published: boolean;
  position: number;
  allows_student_submissions?: boolean;
  assignment_deadline?: string;
  max_score?: number;
  assignment_id?: string;
  section_id?: string;
  settings?: any;
  teacher_files?: Array<{
    file_path: string;
    file_name: string;
    file_size: number;
    mime_type: string;
  }>;
}

interface ResourceDetailModalProps {
  resource: WeeklyResource;
  isOpen: boolean;
  onClose: () => void;
}

const getResourceIcon = (type: string) => {
  switch (type) {
    case 'material':
    case 'document':
      return <FileText className="h-6 w-6" />;
    case 'exam':
    case 'assignment':
      return <ClipboardList className="h-6 w-6" />;
    case 'link':
      return <Link2 className="h-6 w-6" />;
    case 'video':
      return <Video className="h-6 w-6" />;
    default:
      return <FileImage className="h-6 w-6" />;
  }
};

const getResourceTypeLabel = (type: string) => {
  switch (type) {
    case 'material':
      return 'Material de Estudio';
    case 'exam':
      return 'Examen';
    case 'link':
      return 'Enlace Web';
    case 'assignment':
      return 'Tarea/Actividad';
    case 'video':
      return 'Video';
    case 'document':
      return 'Documento';
    default:
      return 'Recurso';
  }
};

const formatFileSize = (bytes?: number) => {
  if (!bytes) return null;
  
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
};

export function ResourceDetailModal({ resource, isOpen, onClose }: ResourceDetailModalProps) {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [isCreatingAssignment, setIsCreatingAssignment] = useState(false);

  const handleAssignmentNavigation = async () => {
    try {
      let assignmentId = resource.assignment_id;
      
      // Si no existe assignment_id, crear el assignment
      if (!assignmentId && resource.resource_type === 'assignment') {
        setIsCreatingAssignment(true);
        
        // Obtener el course_id de la sección
        const { data: sectionData, error: sectionError } = await supabase
          .from('course_weekly_sections')
          .select('course_id')
          .eq('id', resource.section_id)
          .single();

        if (sectionError) throw sectionError;

        // Crear el assignment
        const { data: newAssignment, error: assignmentError } = await supabase
          .from('assignments')
          .insert({
            title: resource.title,
            description: resource.description,
            due_date: resource.assignment_deadline,
            max_score: resource.max_score || 100,
            course_id: sectionData.course_id,
            is_published: resource.is_published
          })
          .select()
          .single();

        if (assignmentError) throw assignmentError;

        // Actualizar el resource con el assignment_id
        const { error: updateError } = await supabase
          .from('course_weekly_resources')
          .update({ assignment_id: newAssignment.id })
          .eq('id', resource.id);

        if (updateError) throw updateError;

        assignmentId = newAssignment.id;
        toast.success('Tarea configurada correctamente');
      }

      onClose();
      
      if (assignmentId) {
        if (profile?.role === 'student') {
          navigate(`/assignments/${assignmentId}`);
        } else if (profile?.role === 'teacher' || profile?.role === 'admin') {
          navigate(`/assignments/${assignmentId}/review`);
        }
      }
    } catch (error) {
      console.error('Error al navegar a la tarea:', error);
      toast.error('Error al abrir la tarea');
    } finally {
      setIsCreatingAssignment(false);
    }
  };

  const handleDownload = async () => {
    try {
      if (resource.file_path) {
        // Use edge function for secure downloads
        const { data, error } = await supabase.functions.invoke('download-file', {
          body: {
            bucket: 'course-documents',
            filePath: resource.file_path,
            fileName: resource.title
          }
        });

        if (error) throw error;

        // Download the file using the signed URL
        const link = document.createElement('a');
        link.href = data.signedUrl;
        link.download = data.fileName || resource.title;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else if (resource.resource_url) {
        // For external URLs, open in new tab
        window.open(resource.resource_url, '_blank');
      }
    } catch (error) {
      console.error('Error downloading file:', error);
      toast.error('Error al descargar el archivo');
    }
  };

  const handleDownloadTeacherFile = async (filePath: string, fileName: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('download-file', {
        body: {
          bucket: 'course-documents',
          filePath: filePath,
          fileName: fileName
        }
      });

      if (error) throw error;

      const link = document.createElement('a');
      link.href = data.signedUrl;
      link.download = data.fileName || fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success('Descarga iniciada');
    } catch (error) {
      console.error('Error downloading file:', error);
      toast.error('Error al descargar el archivo');
    }
  };

  const handleOpenLink = () => {
    if (resource.resource_url) {
      window.open(resource.resource_url, '_blank');
    }
  };

  const isDownloadable = resource.file_path || (resource.resource_type !== 'link' && resource.resource_url);
  const isExternalLink = resource.resource_type === 'link' || (!resource.file_path && resource.resource_url);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader className="space-y-4">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-lg bg-muted">
              {getResourceIcon(resource.resource_type)}
            </div>
            <div className="flex-1 space-y-2">
              <DialogTitle className="text-xl font-semibold">
                {resource.title}
              </DialogTitle>
              <Badge variant="outline" className="w-fit">
                {getResourceTypeLabel(resource.resource_type)}
              </Badge>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Description */}
          {resource.description && (
            <div className="space-y-2">
              <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                Descripción
              </h3>
              <p className="text-sm leading-relaxed">
                {resource.description}
              </p>
            </div>
          )}

          <Separator />

          {/* File Information */}
          {(resource.file_size || resource.mime_type) && (
            <>
              <div className="space-y-3">
                <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                  Información del Archivo
                </h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {resource.file_size && (
                    <div>
                      <span className="text-muted-foreground">Tamaño:</span>
                      <p className="font-medium">{formatFileSize(resource.file_size)}</p>
                    </div>
                  )}
                  {resource.mime_type && (
                    <div>
                      <span className="text-muted-foreground">Tipo:</span>
                      <p className="font-medium">{resource.mime_type}</p>
                    </div>
                  )}
                </div>
              </div>
              <Separator />
            </>
          )}

          {/* Assignment Details */}
          {resource.resource_type === 'assignment' && (
            <>
              <div className="space-y-3">
                <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                  Detalles de la Tarea
                </h3>
                <div className="grid gap-4 text-sm">
                  {resource.assignment_deadline && (
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Fecha límite:</span>
                      <p className="font-medium">
                        {formatDateTimeInUserTimezone(resource.assignment_deadline)}
                      </p>
                    </div>
                  )}
                  {resource.max_score && (
                    <div className="flex items-center gap-2">
                      <Target className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Puntuación máxima:</span>
                      <p className="font-medium">{resource.max_score} puntos</p>
                    </div>
                  )}
                  {resource.allows_student_submissions && (
                    <div className="flex items-center gap-2">
                      <ClipboardList className="h-4 w-4 text-muted-foreground" />
                      <p className="text-sm text-primary font-medium">
                        Permite envío de entregas
                      </p>
                    </div>
                  )}
                </div>

                {/* Archivos adjuntos del profesor para la tarea */}
                {resource.teacher_files && resource.teacher_files.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">
                      Archivos de instrucciones del profesor ({resource.teacher_files.length})
                    </p>
                    {resource.teacher_files.map((file, index) => (
                      <div key={index} className="p-4 rounded-lg bg-muted/50 border border-border">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <FileText className="h-5 h-5 text-primary flex-shrink-0" />
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">
                                {file.file_name}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {formatFileSize(file.file_size)}
                              </p>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDownloadTeacherFile(file.file_path, file.file_name)}
                            className="flex-shrink-0"
                          >
                            <Download className="h-4 w-4 mr-2" />
                            Descargar
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <Separator />
            </>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            {/* For non-assignment resources, show download/link buttons */}
            {resource.resource_type !== 'assignment' && (
              <>
                {isDownloadable && (
                  <Button 
                    onClick={handleDownload}
                    className="flex-1"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Descargar
                  </Button>
                )}
                
                {isExternalLink && (
                  <Button 
                    onClick={handleOpenLink}
                    variant={isDownloadable ? "outline" : "default"}
                    className={isDownloadable ? "" : "flex-1"}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Abrir Enlace
                  </Button>
                )}
              </>
            )}
            
            {/* For assignments, only show the assignment action button */}
            {resource.resource_type === 'assignment' && resource.allows_student_submissions && (
              <Button 
                className="flex-1"
                onClick={handleAssignmentNavigation}
                disabled={isCreatingAssignment}
              >
                <ClipboardList className="h-4 w-4 mr-2" />
                {isCreatingAssignment ? 'Cargando...' : (profile?.role === 'student' ? 'Ver/Enviar Tarea' : 'Ver Entregas')}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}