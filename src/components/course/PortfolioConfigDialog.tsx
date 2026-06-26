import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Loader2, Upload, Calendar, FileCheck } from 'lucide-react';

interface Props {
  editionId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialData?: any; // Agregado para soportar edición
}

export const PortfolioConfigDialog = ({ editionId, isOpen, onClose, onSuccess, initialData }: Props) => {
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [formData, setFormData] = useState({
    title: 'Portafolio Final',
    description: '',
    due_date: ''
  });

  // EFECTO PARA CARGAR DATOS AL EDITAR
  useEffect(() => {
    if (initialData && isOpen) {
      setFormData({
        title: initialData.title || 'Portafolio Final',
        description: initialData.description || '',
        due_date: initialData.due_date ? new Date(initialData.due_date).toISOString().slice(0, 16) : ''
      });
      setFile(null); // Reset del archivo nuevo
    } else if (isOpen) {
      // Reset para creación nueva
      setFormData({ title: 'Portafolio Final', description: '', due_date: '' });
      setFile(null);
    }
  }, [initialData, isOpen]);

  const handleSave = async () => {
    if (!formData.title || !formData.due_date) {
      toast.error('Título, fecha límite y plantilla PDF son obligatorios');
      return;
    }

    try {
      setLoading(true);
      let filePath = initialData?.template_file_path || null;

      // 1. Subida de archivo (solo si hay uno nuevo)
      if (file) {
        const fileExt = file.name.split('.').pop();
        const fileName = `template_${Date.now()}.${fileExt}`;
        const uploadPath = `portfolios/${editionId}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('course-documents')
          .upload(uploadPath, file);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('course-documents')
          .getPublicUrl(uploadPath);
        
        filePath = urlData.publicUrl;
      }

      // 2. BUSCAR EL ID DEL PADRE (COURSE) SI SE RECIBIÓ UN ID DE MÓDULO
      let realCourseId = editionId;
      const { data: moduloCheck } = await supabase
        .from('modulos')
        .select('course_id')
        .eq('id', editionId)
        .maybeSingle();

      if (moduloCheck?.course_id) {
        realCourseId = moduloCheck.course_id;
      }

      // 3. Guardado con UPSERT (Sirve para Crear y Editar)
      const dataToSave = {
        edition_id: realCourseId,
        title: formData.title,
        description: formData.description,
        due_date: formData.due_date,
        template_file_path: filePath,
        is_active: true
      };

      let dbError;
      if (initialData?.id) {
        // ACTUALIZAR
        const { error } = await supabase
          .from('edition_portfolios')
          .update(dataToSave)
          .eq('id', initialData.id);
        dbError = error;
      } else {
        // INSERTAR
        const { error } = await supabase
          .from('edition_portfolios')
          .insert(dataToSave);
        dbError = error;
      }

      if (dbError) throw dbError;

      toast.success(initialData ? 'Portafolio actualizado' : 'Portafolio configurado');
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error("Error detallado:", error);
      toast.error('Error al guardar: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold flex items-center gap-2">
            📁 Configurar Portafolio Final
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-4">
          <div className="space-y-2">
            <Label>Título de la Entrega</Label>
            <Input 
              value={formData.title}
              onChange={e => setFormData({...formData, title: e.target.value})}
              placeholder="Ej: Portafolio Final de Módulo"
            />
          </div>

          <div className="space-y-2">
            <Label>Instrucciones / Descripción</Label>
            <Textarea 
              value={formData.description}
              onChange={e => setFormData({...formData, description: e.target.value})}
              placeholder="Detalla qué debe contener el portafolio..."
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Calendar className="h-4 w-4" /> Fecha Límite de Entrega
            </Label>
            <Input 
              type="datetime-local"
              value={formData.due_date}
              onChange={e => setFormData({...formData, due_date: e.target.value})}
            />
          </div>

          <div className="space-y-2">

            <Label className="flex items-center gap-2">
              <Upload className="h-4 w-4" /> Plantilla del Portafolio (Opcional)
            </Label>
            <div className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors ${file ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-blue-400'}`}>
              <input 
                type="file" 
                accept=".pdf" 
                className="hidden" 
                id="portfolio-file"
                onChange={e => setFile(e.target.files?.[0] || null)}
              />
              <label htmlFor="portfolio-file" className="cursor-pointer block">
                {file ? (
                  <span className="text-sm font-medium text-green-700">{file.name}</span>
                ) : initialData?.template_file_path ? (
                  <div className="flex items-center justify-center gap-2 text-blue-600">
                    <FileCheck className="h-5 w-5" />
                    <span className="text-sm">Ya existe un archivo. Click para cambiarlo.</span>
                  </div>
                ) : (
                  <span className="text-sm text-gray-500">Haz clic para subir la plantilla PDF</span>
                )}
              </label>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button onClick={handleSave} disabled={loading} className="bg-indigo-600 hover:bg-indigo-700 text-white">
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {initialData ? 'Guardar Cambios' : 'Guardar Configuración'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};