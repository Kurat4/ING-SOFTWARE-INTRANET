import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { FileUpload } from '@/components/ui/file-upload';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Calendar, Clock, Target } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

// Helper para parsear fechas sin conversión UTC
const parseExamDate = (dateString: string): Date => {
  // Manejar tanto "YYYY-MM-DD HH:mm:ss" como "YYYY-MM-DDTHH:mm:ss"
  const match = dateString.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2}):(\d{2})/);
  if (match) {
    const [_, year, month, day, hour, minute, second] = match;
    return new Date(
      parseInt(year),
      parseInt(month) - 1,
      parseInt(day),
      parseInt(hour),
      parseInt(minute),
      parseInt(second)
    );
  }
  return new Date(dateString);
};

interface SubmitAssignmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assignment: {
    id: string;
    title: string;
    description: string;
    due_date: string;
    max_score: number;
    course_id: string;
  };
  onSubmitSuccess: () => void;
}

export const SubmitAssignmentDialog = ({ 
  open, 
  onOpenChange, 
  assignment,
  onSubmitSuccess 
}: SubmitAssignmentDialogProps) => {
  const { toast } = useToast();
  const [content, setContent] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!content.trim() && !selectedFile) {
      toast({
        title: "Error",
        description: "Debes escribir una respuesta o adjuntar un archivo",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      let fileUrl = null;
      let filePath = null;
      let fileName = null;
      let fileSize = null;
      let mimeType = null;

      // Upload file if selected
      if (selectedFile) {
        const fileExt = selectedFile.name.split('.').pop();
        const timestamp = new Date().getTime();
        const newFilePath = `assignment-submissions/${assignment.id}/${timestamp}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('course-files')
          .upload(newFilePath, selectedFile);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('course-files')
          .getPublicUrl(newFilePath);

        fileUrl = publicUrl;
        filePath = newFilePath;
        fileName = selectedFile.name;
        fileSize = selectedFile.size;
        mimeType = selectedFile.type;
      }

      // Call the edge function to create submission
      const { data, error } = await supabase.functions.invoke('submit-assignment', {
        body: {
          assignmentTitle: assignment.title,
          courseId: assignment.course_id,
          content: content.trim(),
          fileUrl,
          filePath,
          fileName,
          fileSize,
          mimeType,
        },
      });

      if (error) throw error;

      toast({
        title: "¡Tarea entregada!",
        description: "Tu tarea ha sido enviada correctamente",
      });

      onSubmitSuccess();
      onOpenChange(false);
      setContent('');
      setSelectedFile(null);
    } catch (error: any) {
      console.error('Error submitting assignment:', error);
      toast({
        title: "Error",
        description: error.message || "No se pudo entregar la tarea",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Entregar Tarea</DialogTitle>
          <DialogDescription>
            {assignment.title}
          </DialogDescription>
        </DialogHeader>

        {/* Assignment Details */}
        <div className="space-y-3 py-4 px-1 border-b border-border">
          <p className="text-sm text-muted-foreground">
            {assignment.description || 'Sin descripción'}
          </p>
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1 text-muted-foreground">
              <Calendar className="w-4 h-4" />
              <span>
                {format(parseExamDate(assignment.due_date), "d 'de' MMMM, yyyy", { locale: es })}
              </span>
            </div>
            <div className="flex items-center gap-1 text-muted-foreground">
              <Clock className="w-4 h-4" />
              <span>
                {format(parseExamDate(assignment.due_date), "HH:mm")}
              </span>
            </div>
            <div className="flex items-center gap-1 text-muted-foreground">
              <Target className="w-4 h-4" />
              <span>{assignment.max_score} pts</span>
            </div>
          </div>
        </div>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Respuesta *
            </label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Escribe tu respuesta aquí..."
              rows={6}
              className="resize-none"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Archivo adjunto (opcional)
            </label>
            <FileUpload
              accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png"
              onFileSelect={(files) => setSelectedFile(files[0] || null)}
              maxSize={10}
            />
            {selectedFile && (
              <p className="text-sm text-muted-foreground">
                Archivo seleccionado: {selectedFile.name}
              </p>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="bg-gradient-primary shadow-glow"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Entregando...
              </>
            ) : (
              'Entregar'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
