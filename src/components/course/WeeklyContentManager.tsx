import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Calendar } from 'lucide-react'; 
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { CourseWeeklySection } from './CourseWeeklySection';
import { SectionForm } from './SectionForm';

// --- NUEVOS IMPORTS (SOLO ESTO SE AGREGA ARRIBA) ---
import { CourseGeneralResources } from './CourseGeneralResources';
import { CourseAnnouncements } from './CourseAnnouncements';
import { ModuloBookSection } from './ModuloBookSection';
// ----------------------------------------------------

// --- Interfaces (SIN CAMBIOS) ---
interface WeeklyResource {
  id: string;
  title: string;
  description: string;
  resource_type: 'material' | 'exam' | 'link' | 'assignment' | 'video' | 'document';
  resource_url?: string;
  is_published: boolean;
  position: number;
  settings: any;
  assignment_id?: string;
}

interface WeeklySection {
  id: string;
  module_id: string;
  week_number: number;
  title: string;
  description?: string;
  start_date?: string;
  end_date?: string;
  is_published: boolean;
  position: number;
  resources?: WeeklyResource[];
}

interface CourseModule {
  id: string;
  title: string;
  description: string;
  position: number;
  sections: WeeklySection[];
}

interface WeeklyContentManagerProps {
  courseId: string;
  canEdit: boolean;
}

export function WeeklyContentManager({ courseId, canEdit }: WeeklyContentManagerProps) {
  const [modules, setModules] = useState<CourseModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSectionForm, setShowSectionForm] = useState(false);
  const [moduloInfo, setModuloInfo] = useState<{ num_modulo: number; course_id: string } | null>(null);

  useEffect(() => {
    fetchModuloInfo();
    fetchModulesAndContent();
  }, [courseId]);

  const fetchModuloInfo = async () => {
    try {
      const { data, error } = await supabase
        .from('modulos')
        .select('num_modulo, course_id')
        .eq('id', courseId)
        .single();

      if (error) throw error;
      setModuloInfo(data as any);
    } catch (error) {
      console.error('Error al obtener info del módulo:', error);
    }
  };

  const fetchModulesAndContent = async () => {
    try {
      setLoading(true);

      // Ahora las secciones semanales están directamente asociadas al módulo
      const { data: sectionsData, error } = await supabase
        .from('course_weekly_sections')
        .select(`
          *,
          resources:course_weekly_resources(*)
        `)
        .eq('modulo_id', courseId)
        .order('position', { ascending: true });

      if (error) throw error;

      // Agrupar como un solo módulo para mantener compatibilidad con la UI
      const processedModules = sectionsData && sectionsData.length > 0 ? [{
        id: courseId,
        title: 'Contenido del Módulo',
        description: 'Material y recursos del módulo',
        position: 0,
        sections: (sectionsData || [])
          .map((section: any) => ({
            ...section,
            resources: (section.resources || []).sort((a: any, b: any) => a.position - b.position)
          }))
          .filter((section: any) => canEdit || section.is_published)
      }] : [];

      setModules(processedModules);

    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al cargar el contenido');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse h-10 bg-muted rounded w-1/3 mb-4"></div>
        {[1, 2].map((i) => (
          <Card key={i} className="animate-pulse mb-4">
            <CardContent className="p-6 h-32 bg-muted/20"></CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      
      {/* --- INICIO ZONA NUEVA --- */}
      {/* Aquí insertamos los componentes de Recursos y Avisos ANTES del contenido semanal */}
      
      <CourseGeneralResources 
         courseId={courseId} 
         canEdit={canEdit} 
      />

      <CourseAnnouncements
         courseId={courseId}
         canEdit={canEdit}
      />

      {/* Mostrar el Book solo si es Módulo 1 */}
      {moduloInfo?.num_modulo === 1 && moduloInfo?.course_id && (
        <ModuloBookSection
          courseId={moduloInfo.course_id}
          canEdit={canEdit}
        />
      )}
      
      {/* --- FIN ZONA NUEVA --- */}


      {/* Header General (SIN CAMBIOS) */}
      <div className="flex items-center justify-between mb-4 border-t pt-6"> {/* Agregué border-t para separar visualmente */}
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Calendar className="h-6 w-6" /> Contenido Semanal
        </h2>
        {canEdit && (
          <Button onClick={() => setShowSectionForm(true)} className="bg-blue-600 text-white shadow-sm">
            <Plus className="h-4 w-4 mr-2" /> Agregar Clase Manual
          </Button>
        )}
      </div>

      {modules.length > 0 ? (
        modules.map((module) => (
          <div key={module.id} className="space-y-4">
            
            {/* LISTA DE CLASES */}
            <div className="space-y-3">
              {module.sections.length > 0 ? (
                module.sections.map((section) => (
                  <CourseWeeklySection
                    key={section.id}
                    section={section}
                    courseId={courseId}
                    canEdit={canEdit}
                    onUpdateSection={() => fetchModulesAndContent()}
                  />
                ))
              ) : (
                // Mensaje sutil si el módulo existe pero está vacío
                canEdit && <p className="text-sm text-gray-400 italic p-2 border border-dashed rounded text-center">Sin clases generadas en este bloque.</p>
              )}
            </div>
          </div>
        ))
      ) : (
        // Estado vacío total
        <Card>
          <CardContent className="p-8 text-center">
            <Calendar className="h-16 w-16 mx-auto text-muted-foreground mb-4 opacity-50" />
            <h3 className="text-lg font-semibold mb-2">Aún no hay clases</h3>
            <p className="text-muted-foreground">
              {canEdit ? 'Configura las fechas en la edición del curso o agrega una clase manual.' : 'El profesor aún no ha publicado contenido.'}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Modal para crear clases manuales */}
      {showSectionForm && (
        <SectionForm
          courseId={courseId}
          onClose={() => setShowSectionForm(false)}
          onSuccess={() => {
            setShowSectionForm(false);
            fetchModulesAndContent();
          }}
        />
      )}
    </div>
  );
}
