import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDateInUserTimezone, getUserTimezone } from '@/lib/timezoneUtils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight, Plus, FileText, Link2, ClipboardList, Video, FileImage, Edit, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ResourceForm } from './ResourceForm';
import { ResourceDetailModal } from './ResourceDetailModal';
import { SectionEditForm } from './SectionEditForm';
import { ResourceEditForm } from './ResourceEditForm';

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
  settings?: any;
  assignment_id?: string;
  teacher_files?: Array<{ file_path: string; file_name: string; file_size: number; mime_type: string }>;
}

interface WeeklySection {
  id: string;
  week_number: number;
  title: string;
  description?: string;
  start_date?: string;
  end_date?: string;
  is_published: boolean;
  resources?: WeeklyResource[];
}

interface CourseWeeklySectionProps {
  section: WeeklySection;
  courseId: string;
  canEdit: boolean;
  onUpdateSection?: (section: WeeklySection) => void;
}

const getResourceIcon = (type: string) => {
  switch (type) {
    case 'material':
    case 'document':
      return <FileText className="h-4 w-4" />;
    case 'exam':
    case 'assignment':
      return <ClipboardList className="h-4 w-4" />;
    case 'link':
      return <Link2 className="h-4 w-4" />;
    case 'video':
      return <Video className="h-4 w-4" />;
    default:
      return <FileImage className="h-4 w-4" />;
  }
};

const getResourceTypeLabel = (type: string) => {
  switch (type) {
    case 'material': return 'Material';
    case 'exam': return 'Examen';
    case 'link': return 'Enlace';
    case 'assignment': return 'Tarea';
    case 'video': return 'Video';
    case 'document': return 'Documento';
    default: return 'Recurso';
  }
};

export function CourseWeeklySection({ section, courseId, canEdit, onUpdateSection }: CourseWeeklySectionProps) {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  
  // DEBUG: Verificar zona horaria y conversión
  console.log('=== CourseWeeklySection Debug ===');
  console.log('Zona horaria actual:', getUserTimezone());
  console.log('Fecha de sesión (solo día):', section.start_date);
  
  // Debug de recursos con hora
  if (section.resources) {
    section.resources.forEach(resource => {
      if (resource.assignment_deadline) {
        console.log('Tarea:', resource.title);
        console.log('  - Deadline original:', resource.assignment_deadline);
        console.log('  - Debe mostrar hora convertida');
      }
    });
  }
  
  // Estado para controlar el modo edición de la SECCIÓN (La fecha, título, etc.)
  const [isEditingSection, setIsEditingSection] = useState(false);

  // Estados para recursos
  const [showResourceForm, setShowResourceForm] = useState(false);
  const [selectedResource, setSelectedResource] = useState<WeeklyResource | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [editingResource, setEditingResource] = useState<WeeklyResource | null>(null);

  const handleResourceClick = (resource: WeeklyResource) => {
    if (resource.resource_type === 'assignment' && resource.assignment_id) {
      if (canEdit) {
        navigate(`/assignment-review/${resource.assignment_id}`);
      } else {
        navigate(`/assignments/${resource.assignment_id}`);
      }
    } else {
      setSelectedResource(resource);
    }
  };

  const handleToggleSectionPublish = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Importante para que no abra el acordeón
    try {
      setIsUpdating(true);
      const newPublishState = !section.is_published;
      const { error } = await supabase
        .from('course_weekly_sections')
        .update({ is_published: newPublishState })
        .eq('id', section.id);

      if (error) throw error;
      toast.success(newPublishState ? 'Semana publicada' : 'Semana despublicada');
      onUpdateSection?.({ ...section, is_published: newPublishState });
    } catch (error) {
      console.error('Error updating section:', error);
      toast.error('Error al actualizar la semana');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteResource = async (resource: WeeklyResource, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`¿Eliminar el recurso "${resource.title}"? Esta acción no se puede deshacer.`)) return;

    try {
      // 1. Eliminar archivos del storage
      const bucket = resource.resource_type === 'video' ? 'course-videos' : 'course-documents';
      const filesToDelete: string[] = [];

      // Recopilar todos los archivos (teacher_files puede tener múltiples)
      if (resource.teacher_files && resource.teacher_files.length > 0) {
        resource.teacher_files.forEach(f => filesToDelete.push(f.file_path));
      } else if (resource.file_path) {
        filesToDelete.push(resource.file_path);
      }

      if (filesToDelete.length > 0) {
        const { error: storageError } = await supabase.storage
          .from(bucket)
          .remove(filesToDelete);
        if (storageError) console.warn('Advertencia al eliminar archivos del storage:', storageError);
      }

      // 2. Eliminar el registro de la base de datos
      const { error: dbError } = await supabase
        .from('course_weekly_resources')
        .delete()
        .eq('id', resource.id);

      if (dbError) throw dbError;

      toast.success('Recurso eliminado correctamente');
      onUpdateSection?.(section);
    } catch (error: any) {
      console.error('Error al eliminar recurso:', error);
      toast.error(`Error al eliminar el recurso: ${error.message}`);
    }
  };

  const handleToggleResourcePublish = async (resource: WeeklyResource, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const newPublishState = !resource.is_published;
      const { error } = await supabase
        .from('course_weekly_resources')
        .update({ is_published: newPublishState })
        .eq('id', resource.id);

      if (error) throw error;
      toast.success(newPublishState ? 'Recurso publicado' : 'Recurso despublicado');
      onUpdateSection?.(section); // Recargar la sección completa
    } catch (error) {
      console.error('Error updating resource:', error);
      toast.error('Error al actualizar el recurso');
    }
  };

  // --- MODO EDICIÓN: Si estamos editando, mostramos el formulario DIRECTAMENTE ---
  // Esto asegura que el formulario se vea y funcione al 100%
  if (isEditingSection) {
    return (
        <Card className="mb-4 border-2 border-blue-500 shadow-lg">
            <CardContent className="pt-6">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-blue-800 text-lg">Editar Datos de la Clase</h3>
                    <Button variant="ghost" size="sm" onClick={() => setIsEditingSection(false)}>Cancelar</Button>
                </div>
                {/* Aquí cargamos tu formulario existente */}
                <SectionEditForm 
                    section={section} 
                    courseId={courseId}
                    onClose={() => setIsEditingSection(false)} 
                    onSuccess={() => {
                        setIsEditingSection(false);
                        if (onUpdateSection) onUpdateSection(section);
                        // Forzamos una recarga extra por si acaso
                        window.location.reload(); 
                    }} 
                />
            </CardContent>
        </Card>
    );
  }

  // --- MODO VISUALIZACIÓN (Tu vista normal) ---
  return (
    <Card className="mb-4 transition-all hover:shadow-md">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-4">
            <div className="flex items-center justify-between">
              
              {/* Lado Izquierdo: Título y Descripción */}
              <div className="flex items-center gap-3">
                {isOpen ? <ChevronDown className="h-5 w-5 text-gray-400" /> : <ChevronRight className="h-5 w-5 text-gray-400" />}
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    {/* Muestra: Semana 1: Clase 1 */}
                    <span className="font-bold text-gray-800">Semana {section.week_number}:</span> 
                    <span className="font-normal">{section.title}</span>
                  </CardTitle>
                  
                  {section.description && (
                    <p className="text-sm text-muted-foreground mt-1">
                      Sesión del {section.start_date 
                        ? formatDateInUserTimezone(section.start_date)
                        : 'Fecha por definir'}</p>
                  )}
                </div>
              </div>

              {/* Lado Derecho: Badges y Botones */}
              <div className="flex items-center gap-3">
                {section.start_date && (
                  <Badge variant="outline" className="text-xs font-mono bg-blue-50 text-blue-700 border-blue-100">
                    {formatDateInUserTimezone(section.start_date)}
                  </Badge>
                )}
                
                <Badge variant={section.is_published ? "default" : "secondary"} className={section.is_published ? "bg-green-600" : ""}>
                  {section.is_published ? "Publicado" : "Borrador"}
                </Badge>

                {canEdit && (
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    {/* BOTÓN EDITAR REPARADO */}
                    <Button
                      variant="default" // Cambiado a default para que resalte
                      size="sm"
                      className="bg-orange-500 hover:bg-orange-600 text-white h-8"
                      onClick={(e) => {
                        e.stopPropagation(); // Detiene el click del acordeón
                        e.preventDefault();
                        setIsEditingSection(true); // Activa el modo edición
                      }}
                    >
                      <Edit className="h-3 w-3 mr-1" />
                      Editar
                    </Button>

                    <div className="flex items-center gap-2 ml-2 border-l pl-2">
                        <Label htmlFor={`publish-section-${section.id}`} className="text-xs cursor-pointer select-none">
                        Publicar
                        </Label>
                        <Switch
                        id={`publish-section-${section.id}`}
                        checked={section.is_published}
                        onCheckedChange={() => {}} // Controlado por onClick
                        onClick={handleToggleSectionPublish}
                        disabled={isUpdating}
                        />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <CardContent className="pt-0 pb-6 px-6">
            <div className="space-y-4 border-t pt-4 mt-2">
              <div className="min-h-[50px] space-y-3">
                {section.resources && section.resources.length > 0 ? (
                  section.resources
                    .filter(resource => canEdit || resource.is_published)
                    .sort((a, b) => a.position - b.position)
                    .map((resource) => (
                      <div
                        key={resource.id}
                        className="flex items-start gap-4 p-3 border rounded-lg hover:bg-gray-50 transition-colors cursor-pointer group bg-white"
                        onClick={() => handleResourceClick(resource)}
                      >
                        <div className="flex items-center gap-2 text-blue-600 mt-1 p-2 bg-blue-50 rounded-full">
                          {getResourceIcon(resource.resource_type)}
                        </div>
                        <div className="flex-1 space-y-1">
                          <h4 className="font-medium text-base text-gray-900 group-hover:text-blue-700 transition-colors">{resource.title}</h4>
                          {resource.description && (
                            <p className="text-sm text-muted-foreground">{resource.description}</p>
                          )}
                          <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground mt-1">
                            <Badge variant="secondary" className="text-[10px] h-5">
                              {getResourceTypeLabel(resource.resource_type)}
                            </Badge>
                            {!resource.is_published && canEdit && (
                              <Badge variant="destructive" className="text-[10px] h-5">Borrador</Badge>
                            )}
                            {resource.resource_type === 'assignment' && resource.assignment_deadline && (
                              <Badge variant="outline" className="text-[10px] h-5">
                                Entrega: {formatDateInUserTimezone(resource.assignment_deadline)}
                              </Badge>
                            )}
                          </div>
                        </div>
                        
                        {canEdit && (
                          <div className="flex items-center gap-2 ml-4 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 hover:bg-gray-200"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingResource(resource);
                              }}
                            >
                              <Edit className="h-4 w-4 text-gray-500" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 hover:bg-red-100 text-red-500"
                              onClick={(e) => handleDeleteResource(resource, e)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                            <Switch
                              className="scale-75"
                              checked={resource.is_published}
                              onCheckedChange={() => {}}
                              onClick={(e) => handleToggleResourcePublish(resource, e)}
                            />
                          </div>
                        )}
                      </div>
                    ))
                ) : (
                  <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg bg-gray-50/50">
                    <FileText className="h-10 w-10 mx-auto mb-3 opacity-30" />
                    <p className="text-sm font-medium">No hay recursos en esta clase.</p>
                    {canEdit && <p className="text-xs mt-1">Dale click a "Agregar Recurso" para subir contenido.</p>}
                  </div>
                )}
              </div>
              
              {canEdit && (
                <Button variant="outline" onClick={() => setShowResourceForm(true)} className="w-full border-dashed text-blue-600 hover:text-blue-700 hover:bg-blue-50">
                  <Plus className="h-5 w-5 mr-2" /> Agregar Recurso
                </Button>
              )}

              {/* Modales Auxiliares */}
              {showResourceForm && (
                <ResourceForm
                  sectionId={section.id}
                  onClose={() => setShowResourceForm(false)}
                  onSuccess={() => { setShowResourceForm(false); onUpdateSection?.(section); }}
                />
              )}
              {selectedResource && (
                <ResourceDetailModal
                  resource={selectedResource}
                  isOpen={!!selectedResource}
                  onClose={() => setSelectedResource(null)}
                />
              )}
              {editingResource && (
                <ResourceEditForm
                  resource={editingResource}
                  sectionId={section.id}
                  onClose={() => setEditingResource(null)}
                  onSuccess={() => { setEditingResource(null); onUpdateSection?.(section); }}
                />
              )}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}