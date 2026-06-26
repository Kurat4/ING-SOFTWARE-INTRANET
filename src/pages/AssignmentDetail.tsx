import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { FileUpload } from '@/components/ui/file-upload';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { format, isAfter } from 'date-fns';
import { es } from 'date-fns/locale';
import { 
  FileText, 
  Calendar, 
  Clock, 
  Target, 
  AlertCircle, 
  CheckCircle2, 
  ArrowLeft,
  Loader2,
  Download,
  Edit,
  Trash2
} from 'lucide-react';
import { EditAssignmentDialog } from '@/components/assignments/EditAssignmentDialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

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

interface Assignment {
  id: string;
  title: string;
  description: string;
  due_date: string;
  max_score: number;
  course_id: string;
  modulo_id?: string;
  course: {
    id: string;
    name: string;
    code: string;
  };
  teacher_files?: Array<{
    file_path: string;
    file_name: string;
    file_size: number;
    mime_type: string;
  }>;
}

interface Submission {
  id: string;
  content: string;
  file_url: string | null;
  file_name: string | null;
  file_path: string | null;
  submitted_at: string;
  score: string | null;  // Ahora es texto (AD, A, B, C)
  feedback: string | null;
  feedback_files?: Array<{
    file_path: string;
    file_name: string;
    file_size: number;
    mime_type: string;
  }>;
  student_files?: Array<{
    file_path: string;
    file_name: string;
    file_size: number;
    mime_type: string;
    file_url: string;
  }>;
}

const AssignmentDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [existingFiles, setExistingFiles] = useState<Array<{
    file_path: string;
    file_name: string;
    file_size: number;
    mime_type: string;
    file_url: string;
  }>>([]);
  const [filesToDelete, setFilesToDelete] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isEditingSubmission, setIsEditingSubmission] = useState(false);

  useEffect(() => {
    fetchAssignmentDetails();
  }, [id]);

  const fetchAssignmentDetails = async () => {
    if (!id || !profile) return;

    try {
      // Fetch assignment details
      const { data: assignmentData, error: assignmentError } = await supabase
        .from('assignments')
        .select(`
          *,
          course:courses (
            id,
            name,
            code
          )
        `)
        .eq('id', id)
        .single();

      if (assignmentError) throw assignmentError;

      // Fetch teacher's files if this assignment is linked to a course_weekly_resource
      const { data: resourceData } = await supabase
        .from('course_weekly_resources')
        .select('teacher_files')
        .eq('assignment_id', id)
        .maybeSingle();

      setAssignment({
        ...assignmentData,
        teacher_files: Array.isArray(resourceData?.teacher_files) ? resourceData.teacher_files as any : []
      });

      // Fetch student's submission if exists
      const { data: submissionData, error: submissionError } = await supabase
        .from('assignment_submissions')
        .select('*')
        .eq('assignment_id', id)
        .eq('student_id', profile.id)
        .maybeSingle();

      if (submissionError && submissionError.code !== 'PGRST116') {
        throw submissionError;
      }

      setSubmission(submissionData ? {
        ...submissionData,
        student_files: Array.isArray(submissionData.student_files) ? submissionData.student_files as any : [],
        feedback_files: Array.isArray(submissionData.feedback_files) ? submissionData.feedback_files as any : []
      } : null);
    } catch (error) {
      console.error('Error fetching assignment details:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los detalles de la tarea",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!content.trim() && selectedFiles.length === 0) {
      toast({
        title: "Error",
        description: "Debes escribir una respuesta o adjuntar al menos un archivo",
        variant: "destructive",
      });
      return;
    }

    // Validar tamaño total de archivos
    const totalSize = selectedFiles.reduce((sum, file) => sum + file.size, 0);
    const maxTotalSize = 5 * 1024 * 1024; // 5MB en bytes

    if (totalSize > maxTotalSize) {
      toast({
        title: "Archivos muy pesados",
        description: "El tamaño total de los archivos supera los 5MB. Por favor, comprime tus archivos antes de subirlos.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const uploadedFiles = [];

      // Upload multiple files if selected
      if (selectedFiles.length > 0) {
        for (const file of selectedFiles) {
          const fileExt = file.name.split('.').pop();
          const timestamp = new Date().getTime();
          const randomId = Math.random().toString(36).substring(7);
          const newFilePath = `${profile?.id}/${id}/${timestamp}_${randomId}.${fileExt}`;
          
          const { error: uploadError } = await supabase.storage
            .from('student-submissions')
            .upload(newFilePath, file);

          if (uploadError) throw uploadError;

          const { data: { publicUrl } } = supabase.storage
            .from('student-submissions')
            .getPublicUrl(newFilePath);

          uploadedFiles.push({
            file_url: publicUrl,
            file_path: newFilePath,
            file_name: file.name,
            file_size: file.size,
            mime_type: file.type,
          });
        }
      }

      if (isEditingSubmission && submission) {
        // Delete files marked for deletion from storage
        for (const filePath of filesToDelete) {
          const { error: deleteError } = await supabase.storage
            .from('student-submissions')
            .remove([filePath]);
          
          if (deleteError) {
            console.error('Error deleting file:', deleteError);
          }
        }

        // Combine existing files (not deleted) with new uploaded files
        const remainingExistingFiles = existingFiles.filter(
          file => !filesToDelete.includes(file.file_path)
        );
        const updatedFiles = [...remainingExistingFiles, ...uploadedFiles];

        // Update existing submission
        const { error } = await supabase
          .from('assignment_submissions')
          .update({
            content: content.trim(),
            student_files: updatedFiles,
            submitted_at: new Date().toISOString(),
          })
          .eq('id', submission.id);

        if (error) throw error;

        toast({
          title: "¡Entrega actualizada!",
          description: "Tu tarea ha sido actualizada correctamente",
        });
      } else {
        // Call the edge function to create new submission
        const { error } = await supabase.functions.invoke('submit-assignment', {
          body: {
            assignmentTitle: assignment?.title,
            courseId: assignment?.course_id,
            moduloId: assignment?.modulo_id,
            content: content.trim(),
            files: uploadedFiles,
          },
        });

        if (error) throw error;

        toast({
          title: "¡Tarea entregada!",
          description: "Tu tarea ha sido enviada correctamente",
        });
      }

      // Refresh to show submission
      fetchAssignmentDetails();
      setContent('');
      setSelectedFiles([]);
      setExistingFiles([]);
      setFilesToDelete([]);
      setIsEditingSubmission(false);
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

  const handleEditSubmission = () => {
    if (!submission || isOverdue) {
      toast({
        title: "No se puede editar",
        description: "No puedes editar una entrega después de la fecha límite",
        variant: "destructive",
      });
      return;
    }
    setContent(submission.content || '');
    setSelectedFiles([]);
    setExistingFiles(submission.student_files || []);
    setFilesToDelete([]);
    setIsEditingSubmission(true);
  };

  const handleCancelEdit = () => {
    setContent('');
    setSelectedFiles([]);
    setExistingFiles([]);
    setFilesToDelete([]);
    setIsEditingSubmission(false);
  };

  const handleDeleteExistingFile = (filePath: string) => {
    setFilesToDelete(prev => [...prev, filePath]);
  };

  const handleUndoDeleteFile = (filePath: string) => {
    setFilesToDelete(prev => prev.filter(path => path !== filePath));
  };

  const handleDelete = async () => {
    if (!assignment) return;
    
    setIsDeleting(true);
    
    try {
      const { error } = await supabase
        .from('assignments')
        .delete()
        .eq('id', assignment.id);

      if (error) throw error;

      toast({
        title: "Tarea eliminada",
        description: "La tarea ha sido eliminada correctamente",
      });

      navigate('/assignments');
    } catch (error: any) {
      console.error('Error deleting assignment:', error);
      toast({
        title: "Error",
        description: error.message || "No se pudo eliminar la tarea",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
    }
  };

  const handleDownloadTeacherFile = async (filePath: string, fileName: string) => {
    setIsDownloading(true);
    try {
      const { data, error } = await supabase.functions.invoke('download-file', {
        body: {
          bucket: 'course-documents',
          filePath: filePath,
          fileName: fileName
        }
      });

      if (error) throw error;

      // Download the file using the signed URL
      const link = document.createElement('a');
      link.href = data.signedUrl;
      link.download = data.fileName || fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: "Descarga iniciada",
        description: "El archivo se está descargando",
      });
    } catch (error) {
      console.error('Error downloading file:', error);
      toast({
        title: "Error",
        description: "No se pudo descargar el archivo",
        variant: "destructive",
      });
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDownloadStudentFile = async (filePath: string, fileName: string) => {
    setIsDownloading(true);
    try {
      const { data, error } = await supabase.functions.invoke('download-file', {
        body: {
          bucket: 'student-submissions',
          filePath: filePath,
          fileName: fileName
        }
      });

      if (error) throw error;

      // Download the file using the signed URL
      const link = document.createElement('a');
      link.href = data.signedUrl;
      link.download = data.fileName || fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: "Descarga iniciada",
        description: "El archivo se está descargando",
      });
    } catch (error) {
      console.error('Error downloading file:', error);
      toast({
        title: "Error",
        description: "No se pudo descargar el archivo",
        variant: "destructive",
      });
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDownloadFeedbackFile = async (filePath: string, fileName: string) => {
    setIsDownloading(true);
    try {
      // 1. Validación de seguridad
      if (!filePath) {
        throw new Error("La ruta del archivo no es válida.");
      }

      // 2. Usamos Storage Directo (createSignedUrl) en lugar de invoke
      const { data, error } = await supabase.storage
        .from('student-submissions') // Asegúrate que este sea el bucket correcto
        .createSignedUrl(filePath, 60);

      if (error) throw error;

      // 3. Forzar la descarga
      const link = document.createElement('a');
      link.href = data.signedUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: "Descarga iniciada",
        description: "El archivo se está descargando...",
      });
    } catch (error: any) {
      console.error('Error downloading feedback file:', error);
      toast({
        title: "Error",
        description: "No se pudo descargar: " + (error.message || "Error desconocido"),
        variant: "destructive",
      });
    } finally {
      setIsDownloading(false);
    }
  };

  const isOverdue = assignment ? isAfter(new Date(), parseExamDate(assignment.due_date)) : false;
  const canSubmit = (!submission && !isOverdue) || (isEditingSubmission && !isOverdue);
  const isTeacherOrAdmin = profile?.role === 'teacher' || profile?.role === 'admin';
  const canEditSubmission = submission && submission.score === null && !isOverdue;

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (!assignment) {
    return (
      <DashboardLayout>
        <div className="p-6">
          <Card className="bg-gradient-card shadow-card border-0">
            <CardContent className="p-8 text-center">
              <AlertCircle className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">
                Tarea no encontrada
              </h3>
              <Button onClick={() => navigate('/assignments')} className="mt-4">
                Volver a Tareas
              </Button>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/assignments')}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-foreground">{assignment.title}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              <Link 
                to={`/courses/${assignment.course_id}`}
                className="hover:text-primary transition-colors"
              >
                {assignment.course.code} - {assignment.course.name}
              </Link>
            </p>
          </div>
          
          {/* Teacher/Admin Actions */}
          {isTeacherOrAdmin && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditDialogOpen(true)}
              >
                <Edit className="w-4 h-4 mr-2" />
                Editar
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setDeleteDialogOpen(true)}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Eliminar
              </Button>
            </div>
          )}
        </div>

        {/* Assignment Details */}
        <Card className="bg-gradient-card shadow-card border-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              Detalles de la Tarea
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-2">Descripción</h3>
              <p className="text-foreground whitespace-pre-wrap">
                {assignment.description || 'Sin descripción'}
              </p>
            </div>

            <Separator />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Fecha de entrega</p>
                  <p className="text-sm font-medium text-foreground">
                    {format(parseExamDate(assignment.due_date), "d 'de' MMMM, yyyy", { locale: es })}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Hora límite</p>
                  <p className="text-sm font-medium text-foreground">
                    {format(parseExamDate(assignment.due_date), "HH:mm")}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Puntos</p>
                  <p className="text-sm font-medium text-foreground">
                    {assignment.max_score} pts
                  </p>
                </div>
              </div>
            </div>

            {/* Archivos adjuntos del profesor */}
            {assignment.teacher_files && assignment.teacher_files.length > 0 && (
              <>
                <Separator />
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-3">
                    Archivos de instrucciones del profesor ({assignment.teacher_files.length})
                  </h3>
                  <div className="space-y-2">
                    {assignment.teacher_files.map((file, index) => (
                      <div key={index} className="p-4 rounded-lg bg-muted/50 border border-border">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <FileText className="w-5 h-5 text-primary flex-shrink-0" />
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">
                                {file.file_name}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {file.file_size ? (file.file_size / 1024).toFixed(2) : '0.00'} KB
                              </p>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDownloadTeacherFile(file.file_path, file.file_name)}
                            disabled={isDownloading}
                            className="flex-shrink-0"
                          >
                            <Download className="w-4 h-4 mr-2" />
                            {isDownloading ? 'Descargando...' : 'Descargar'}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {isOverdue && !submission && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-destructive">
                    Esta tarea está vencida
                  </p>
                  <p className="text-xs text-destructive/80">
                    Ya no se pueden realizar entregas
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Submission Status */}
        {submission && !isEditingSubmission && (
          <Card className="bg-gradient-card shadow-card border-0">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                  Tu Entrega
                </CardTitle>
                {canEditSubmission && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleEditSubmission}
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Editar Entrega
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Fecha de entrega</p>
                <p className="text-sm font-medium text-foreground">
                  {format(new Date(submission.submitted_at), "d 'de' MMMM, yyyy 'a las' HH:mm", { locale: es })}
                </p>
              </div>

              {submission.content && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Respuesta</p>
                  <p className="text-sm text-foreground whitespace-pre-wrap">
                    {submission.content}
                  </p>
                </div>
              )}

              {/* Mostrar múltiples archivos adjuntos del estudiante */}
              {submission.student_files && submission.student_files.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-3">
                    Archivos adjuntos ({submission.student_files.length})
                  </p>
                  <div className="space-y-2">
                    {submission.student_files.map((file, index) => (
                      <div key={index} className="p-3 rounded-lg bg-muted/50 border border-border">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <FileText className="w-5 h-5 text-primary flex-shrink-0" />
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">
                                {file.file_name}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {file.file_size ? (file.file_size / 1024).toFixed(2) : '0.00'} KB
                              </p>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDownloadStudentFile(file.file_path, file.file_name)}
                            disabled={isDownloading}
                            className="flex-shrink-0"
                          >
                            <Download className="w-4 h-4 mr-2" />
                            {isDownloading ? 'Descargando...' : 'Descargar'}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Fallback para entregas antiguas con un solo archivo */}
              {(!submission.student_files || submission.student_files.length === 0) && 
               submission.file_url && submission.file_name && submission.file_path && (
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Archivo adjunto</p>
                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 text-primary flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {submission.file_name}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownloadStudentFile(submission.file_path!, submission.file_name!)}
                      disabled={isDownloading}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      {isDownloading ? 'Descargando...' : 'Descargar'}
                    </Button>
                  </div>
                </div>
              )}

              <Separator />

              {/* Grading Section */}
              {submission.score !== null ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-foreground">Calificación</p>
                    <Badge variant="default" className="text-lg px-4 py-1">
                      {submission.score}
                    </Badge>
                  </div>

                  {submission.feedback && (
                    <div className="mt-4 p-4 rounded-lg bg-muted/50 border border-border">
                      <p className="text-xs font-medium text-muted-foreground mb-2">
                        Retroalimentación del Profesor
                      </p>
                      <p className="text-sm text-foreground whitespace-pre-wrap">
                        {submission.feedback}
                      </p>
                    </div>
                  )}

                  {/* Archivos de feedback del profesor */}
                  {submission.feedback_files && submission.feedback_files.length > 0 && (
                    <div className="mt-4 space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">
                        Archivos adjuntos del profesor ({submission.feedback_files.length})
                      </p>
                      <div className="space-y-2">
                        {submission.feedback_files.map((file: any, index: number) => {
                          // 🔥 ESTA ES LA CLAVE: Detectamos cualquier nombre de variable
                          const filePath = file.path || file.file_path || file.filePath;
                          const fileName = file.name || file.file_name || file.fileName;
                          const fileSize = file.size || file.fileSize || file.file_size;

                          return (
                            <div 
                              key={index} 
                              className="flex items-center justify-between p-3 rounded-lg border bg-muted/50 border-border"
                            >
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                <FileText className="w-4 h-4 flex-shrink-0 text-primary" />
                                <div className="min-w-0">
                                  <p className="text-xs font-medium truncate text-foreground">
                                    {fileName || "Archivo sin nombre"}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {fileSize ? (fileSize / 1024).toFixed(2) : '0.00'} KB
                                  </p>
                                </div>
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                // Llamamos a la función con los datos detectados
                                onClick={() => handleDownloadFeedbackFile(filePath, fileName)}
                                disabled={isDownloading}
                                className="flex-shrink-0"
                              >
                                <Download className="w-4 h-4 mr-2" />
                                {isDownloading ? '...' : 'Descargar'}
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                  <p className="text-sm text-yellow-700 dark:text-yellow-300">
                    Tu tarea ha sido entregada y está pendiente de calificación
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Submission Form */}
        {canSubmit && (
          <Card className="bg-gradient-card shadow-card border-0">
            <CardHeader>
              <CardTitle>
                {isEditingSubmission ? 'Editar Entrega' : 'Entregar Tarea'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Respuesta *
                </label>
                <Textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Escribe tu respuesta aquí..."
                  className="min-h-[150px]"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Archivos adjuntos (opcional)
                </label>
                
                {/* Archivos existentes en modo edición */}
                {isEditingSubmission && existingFiles.length > 0 && (
                  <div className="mb-4 space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">
                      Archivos actuales ({existingFiles.filter(f => !filesToDelete.includes(f.file_path)).length}):
                    </p>
                    {existingFiles.map((file, index) => {
                      const isMarkedForDeletion = filesToDelete.includes(file.file_path);
                      return (
                        <div 
                          key={index} 
                          className={`flex items-center justify-between p-3 rounded-lg border ${
                            isMarkedForDeletion 
                              ? 'bg-destructive/10 border-destructive/30 opacity-50' 
                              : 'bg-muted/50 border-border'
                          }`}
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <FileText className={`w-4 h-4 flex-shrink-0 ${isMarkedForDeletion ? 'text-destructive' : 'text-primary'}`} />
                            <div className="min-w-0">
                              <p className={`text-xs font-medium truncate ${isMarkedForDeletion ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                                {file.file_name}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {file.file_size ? (file.file_size / 1024).toFixed(2) : '0.00'} KB
                              </p>
                            </div>
                          </div>
                          {isMarkedForDeletion ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleUndoDeleteFile(file.file_path)}
                              className="flex-shrink-0"
                            >
                              Restaurar
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDeleteExistingFile(file.file_path)}
                              className="flex-shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                <FileUpload
                  onFileSelect={(files) => setSelectedFiles(files)}
                  accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.zip,.rar"
                  maxSize={5}
                  multiple={true}
                />
                {selectedFiles.length > 0 && (
                  <div className="space-y-2 mt-3">
                    <p className="text-xs font-medium text-foreground">
                      {isEditingSubmission ? 'Nuevos archivos a agregar' : 'Archivos a entregar'} ({selectedFiles.length}):
                    </p>
                    {selectedFiles.map((file, index) => (
                      <div key={index} className="flex items-center justify-between p-2 rounded-md bg-muted/50 border border-border">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-foreground truncate">
                            {file.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {(file.size / 1024).toFixed(2)} KB
                          </p>
                        </div>
                      </div>
                    ))}
                    <div className="pt-2 border-t border-border">
                      <p className="text-xs font-medium text-foreground">
                        Tamaño total de nuevos archivos: {(selectedFiles.reduce((sum, f) => sum + f.size, 0) / 1024).toFixed(2)} KB
                      </p>
                      {isEditingSubmission && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Archivos existentes que se mantendrán: {existingFiles.filter(f => !filesToDelete.includes(f.file_path)).length}
                        </p>
                      )}
                      {selectedFiles.reduce((sum, f) => sum + f.size, 0) > 5 * 1024 * 1024 && (
                        <p className="text-xs text-destructive mt-1">
                          (Supera los 5MB - Por favor comprime los archivos)
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  onClick={handleSubmit}
                  disabled={isSubmitting || (!content.trim() && selectedFiles.length === 0)}
                  className="bg-gradient-primary shadow-glow"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {isEditingSubmission ? 'Actualizando...' : 'Enviando...'}
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      {isEditingSubmission ? 'Actualizar Entrega' : 'Entregar Tarea'}
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={isEditingSubmission ? handleCancelEdit : () => navigate('/assignments')}
                >
                  Cancelar
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Edit Dialog */}
      {assignment && (
        <EditAssignmentDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          assignment={{
            id: assignment.id,
            title: assignment.title,
            description: assignment.description,
            due_date: assignment.due_date,
            max_score: assignment.max_score,
          }}
          onEditSuccess={fetchAssignmentDetails}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará permanentemente esta tarea
              y todas las entregas asociadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Eliminando...
                </>
              ) : (
                'Eliminar'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
};

export default AssignmentDetail;
