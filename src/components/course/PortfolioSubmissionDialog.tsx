import { useState, useEffect } from 'react'; // Agregado useEffect
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, Upload, FileCheck, ExternalLink } from 'lucide-react'; // Agregado ExternalLink
import { useAuth } from '@/hooks/useAuth';

interface Props {
  portfolioId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const PortfolioSubmissionDialog = ({ portfolioId, isOpen, onClose, onSuccess }: Props) => {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [existingSubmission, setExistingSubmission] = useState<any>(null);

  // EFECTO PARA BUSCAR SI EL ALUMNO YA TIENE UNA ENTREGA
  useEffect(() => {
    const checkSubmission = async () => {
      if (!profile || !portfolioId) return;
      
      const { data } = await supabase
        .from('edition_portfolio_submissions')
        .select('*')
        .eq('portfolio_id', portfolioId)
        .eq('student_id', profile.id)
        .maybeSingle();

      if (data) {
        setExistingSubmission(data);
      } else {
        setExistingSubmission(null);
      }
    };

    if (isOpen) checkSubmission();
  }, [isOpen, portfolioId, profile]);

  const handleUpload = async () => {
    if (!file || !profile) return;

    try {
      setLoading(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `${profile.id}_${Date.now()}.${fileExt}`;
      const filePath = `submissions/${portfolioId}/${fileName}`;

      // 1. Subir al storage
      const { error: uploadError } = await supabase.storage
        .from('student-submissions')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // 2. Registrar o Actualizar con upsert
      const { error: dbError } = await supabase
        .from('edition_portfolio_submissions')
        .upsert({
          portfolio_id: portfolioId,
          student_id: profile.id,
          file_path: filePath,
          file_name: file.name,
          status: 'submitted',
          submitted_at: new Date().toISOString()
        }, { 
          onConflict: 'portfolio_id,student_id' 
        });

      if (dbError) throw dbError;

      toast.success('¡Portafolio entregado con éxito!');
      onSuccess(); 
      onClose(); 

    } catch (error: any) {
      console.error("Error completo:", error);
      toast.error('Error al entregar: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const isGraded = existingSubmission?.status === 'graded';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {isGraded ? 'Resultado de Calificación' : 'Subir Portafolio Final'}
          </DialogTitle>
        </DialogHeader>

        <div className="py-6 space-y-4">
          {isGraded ? (
            /* CASO 1: YA ESTÁ CALIFICADO */
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 text-center space-y-4 shadow-sm">
              <div className="flex justify-center">
                <div className="bg-blue-600 text-white w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold shadow-lg">
                  {existingSubmission.grade}
                </div>
              </div>
              <div>
                <h4 className="font-bold text-blue-900 text-lg">¡Trabajo Calificado!</h4>
                <p className="text-sm text-blue-700 mt-2 italic leading-relaxed">
                  "{existingSubmission.feedback || 'Sin comentarios adicionales'}"
                </p>
              </div>

              <div className="pt-4 border-t border-blue-100">
                <Button asChild variant="outline" className="w-full bg-white border-blue-300 text-blue-700 hover:bg-blue-100 gap-2">
                  <a 
                    href={supabase.storage.from('student-submissions').getPublicUrl(existingSubmission.file_path).data.publicUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <ExternalLink className="h-4 w-4" /> Ver mi PDF corregido
                  </a>
                </Button>
                <p className="text-[10px] text-blue-400 mt-2 uppercase tracking-wider font-semibold">
                  Incluye anotaciones del profesor
                </p>
              </div>
            </div>
          ) : (
            /* CASO 2: PENDIENTE DE ENTREGA O RE-ENTREGA */
            <>
              {existingSubmission && (
                <div className="space-y-3 mb-4">
                  <div className="bg-orange-50 border border-orange-100 text-orange-800 p-3 rounded-lg text-xs text-center">
                    <p className="font-semibold">⚠️ Ya tienes una entrega registrada.</p>
                    <p>Puedes actualizar tu envio volviendo a subir tu archivo.</p>
                  </div>
                  <div className="text-center">
                    <a 
                      href={supabase.storage.from('student-submissions').getPublicUrl(existingSubmission.file_path).data.publicUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-indigo-600 hover:underline inline-flex items-center gap-1 font-medium"
                    >
                      📄 Ver mi entrega actual en la nube
                    </a>
                  </div>
                </div>
              )}
              
              <div className="space-y-3">
                <Label className="text-sm font-medium text-gray-700">Selecciona tu archivo PDF final</Label>
                <div className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${file ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-indigo-400 bg-gray-50'}`}>
                  <input 
                    type="file" 
                    accept=".pdf" 
                    className="hidden" 
                    id="student-file"
                    onChange={e => setFile(e.target.files?.[0] || null)}
                  />
                  <label htmlFor="student-file" className="cursor-pointer flex flex-col items-center gap-2">
                    {file ? (
                      <>
                        <FileCheck className="h-10 w-10 text-green-600" />
                        <span className="font-medium text-green-700 truncate max-w-[250px]">{file.name}</span>
                        <span className="text-[10px] text-green-600">Listo para enviar</span>
                      </>
                    ) : (
                      <>
                        <Upload className="h-10 w-10 text-gray-400" />
                        <span className="text-sm text-gray-500 font-medium">Haz clic para buscar tu archivo</span>
                        <span className="text-[10px] text-gray-400 uppercase">Solo formato PDF</span>
                      </>
                    )}
                  </label>
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            {isGraded ? 'Cerrar' : 'Cancelar'}
          </Button>
          {!isGraded && (
            <Button 
              onClick={handleUpload} 
              disabled={!file || loading} 
              className="bg-indigo-600 hover:bg-indigo-700 text-white min-w-[140px]"
            >
              {loading ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : null} 
              {existingSubmission ? 'Re-enviar Trabajo' : 'Entregar Trabajo'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};