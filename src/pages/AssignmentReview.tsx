import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import {
  FileText,
  Calendar,
  Download,
  ArrowLeft,
  User,
  CheckCircle,
  Edit,
  Trash2,
  X,
  Eye
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { EditAssignmentDialog } from '@/components/assignments/EditAssignmentDialog';
import { FileUpload } from '@/components/ui/file-upload';
import PdfAnnotator from '@/components/assignments/PdfAnnotator';

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

const VALID_GRADES = ['AD', 'A', 'B', 'C'] as const;
type Grade = typeof VALID_GRADES[number];

interface Assignment {
  id: string;
  title: string;
  description: string;
  due_date: string;
  max_score: number;
  modulo_id: string;
  modulo: {
    id: string;
    name: string;
    course_id: string;
  };
}

interface FileInfo {
  file_path: string;
  file_name: string;
  file_size: number;
  mime_type: string;
}

interface Submission {
  id: string;
  student_id: string;
  content: string | null;
  file_path: string | null;
  file_name: string | null;
  file_size: number | null;
  mime_type: string | null;
  student_files: any;
  score: string | null;
  feedback: string | null;
  feedback_files: any;
  submitted_at: string;
  graded_at: string | null;
  student: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  };
}

type PreviewFile = {
  filePath: string;
  fileName: string;
  mimeType?: string | null;
  fileSize?: number | null;
};

const AssignmentReview = () => {
  const { assignmentId } = useParams();
  const { profile } = useAuth();
  const navigate = useNavigate();

  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);

  const [score, setScore] = useState<string>('');
  const [feedback, setFeedback] = useState<string>('');
  const [grading, setGrading] = useState(false);

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [feedbackFiles, setFeedbackFiles] = useState<File[]>([]);

  // Preview
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [previewFile, setPreviewFile] = useState<PreviewFile | null>(null);

  useEffect(() => {
    if (profile?.role !== 'teacher' && profile?.role !== 'admin') {
      navigate('/');
      return;
    }
    fetchAssignmentData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignmentId, profile]);

  // Manejar navegación cuando hay error (fuera del render)
  useEffect(() => {
    if (hasError && !loading) {
      const timer = setTimeout(() => navigate('/'), 1000);
      return () => clearTimeout(timer);
    }
  }, [hasError, loading, navigate]);

  const fetchAssignmentData = async () => {
    if (!assignmentId) return;

    try {
      setLoading(true);

      const { data: assignmentData, error: assignmentError } = await supabase
        .from('assignments')
        .select(`
          *,
          modulo:modulos (id, name, course_id)
        `)
        .eq('id', assignmentId)
        .single();

      if (assignmentError) {
        console.error('Error loading assignment:', assignmentError);
        toast.error('No se pudo cargar la tarea. Verifica los permisos.');
        setHasError(true);
        return;
      }
      
      if (!assignmentData) {
        toast.error('Tarea no encontrada');
        setHasError(true);
        return;
      }
      
      setAssignment(assignmentData);

      const { data: submissionsData, error: submissionsError } = await supabase
        .from('assignment_submissions')
        .select(`
          id, student_id, content, file_path, file_name, file_size, mime_type,
          student_files, score, feedback, feedback_files, submitted_at, graded_at,
          student:profiles!assignment_submissions_student_id_fkey (id, first_name, last_name, email)
        `)
        .eq('assignment_id', assignmentId)
        .order('submitted_at', { ascending: false });

      if (submissionsError) throw submissionsError;
      setSubmissions(submissionsData || []);
    } catch (error) {
      console.error('Error fetching assignment data:', error);
      toast.error('Error al cargar la información de la tarea');
      setHasError(true);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectSubmission = (submission: Submission) => {
    setSelectedSubmission(submission);
    setScore(submission.score || '');
    setFeedback(submission.feedback || '');
    setFeedbackFiles([]);
  };

  const formatKB = (bytes?: number | null) => {
    if (!bytes || Number.isNaN(bytes)) return '0.00 KB';
    return `${(bytes / 1024).toFixed(2)} KB`;
  };

  const canPreview = (mimeType?: string | null, fileName?: string | null) => {
    const mt = (mimeType || '').toLowerCase();
    const fn = (fileName || '').toLowerCase();

    if (mt.startsWith('image/')) return true;
    if (mt.includes('pdf')) return true;
    if (fn.endsWith('.png') || fn.endsWith('.jpg') || fn.endsWith('.jpeg') || fn.endsWith('.webp') || fn.endsWith('.gif')) return true;
    if (fn.endsWith('.pdf')) return true;

    return false;
  };

  // 🔥 CORRECCIÓN: Usamos storage.createSignedUrl en vez de la Edge Function
  const handleDownloadFile = async (filePath: string, fileName: string) => {
    try {
      if (!filePath) {
          toast.error("Error: No se encontró la ruta del archivo");
          return;
      }

      // Método directo de Supabase Storage (Más robusto)
      const { data, error } = await supabase.storage
        .from('student-submissions')
        .createSignedUrl(filePath, 60); // URL válida por 60 segundos

      if (error) throw error;

      const link = document.createElement('a');
      link.href = data.signedUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('Descarga iniciada');
    } catch (error: any) {
      console.error('Error downloading file:', error);
      toast.error('No se pudo descargar: ' + error.message);
    }
  };

  // 🔥 CORRECCIÓN: También en Preview
  const handlePreviewFile = async (file: PreviewFile) => {
    try {
      setPreviewLoading(true);
      setPreviewFile(file);
      setPreviewUrl('');
      setPreviewOpen(true);

      const { data, error } = await supabase.storage
        .from('student-submissions')
        .createSignedUrl(file.filePath, 60);

      if (error) throw error;
      setPreviewUrl(data.signedUrl);
    } catch (error) {
      console.error('Error previewing file:', error);
      toast.error('No se pudo abrir la vista previa');
      setPreviewOpen(false);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleGradeSubmission = async () => {
    if (!selectedSubmission) return;

    if (!score) {
      toast.error('Debes seleccionar una calificación');
      return;
    }

    const maxSize = 5 * 1024 * 1024; // 5MB
    const oversizedFiles = feedbackFiles.filter((file) => file.size > maxSize);
    if (oversizedFiles.length > 0) {
      toast.error('Algunos archivos superan los 5MB.');
      return;
    }

    try {
      setGrading(true);
      let feedbackFilesData: FileInfo[] = [];

      if (selectedSubmission.feedback_files && Array.isArray(selectedSubmission.feedback_files)) {
        feedbackFilesData = [...selectedSubmission.feedback_files];
      }

      if (feedbackFiles.length > 0) {
        for (const file of feedbackFiles) {
          const fileExt = file.name.split('.').pop();
          const fileName = `${Date.now()}-${Math.random()}.${fileExt}`;
          const filePath = `feedback/${selectedSubmission.id}/${fileName}`;

          const { error: uploadError } = await supabase.storage.from('student-submissions').upload(filePath, file);

          if (uploadError) throw new Error(`Error al subir el archivo ${file.name}`);

          feedbackFilesData.push({
            file_path: filePath,
            file_name: file.name,
            file_size: file.size,
            mime_type: file.type
          });
        }
      }

      const { error } = await supabase
        .from('assignment_submissions')
        .update({
          score: score,
          feedback: feedback.trim() || null,
          feedback_files: feedbackFilesData as any,
          graded_at: new Date().toISOString()
        })
        .eq('id', selectedSubmission.id);

      if (error) throw error;

      toast.success('Calificación guardada exitosamente');
      fetchAssignmentData();
      setSelectedSubmission(null);
      setScore('');
      setFeedback('');
      setFeedbackFiles([]);
    } catch (error) {
      console.error('Error grading submission:', error);
      toast.error('Error al guardar la calificación');
    } finally {
      setGrading(false);
    }
  };

  const handleDelete = async () => {
    if (!assignmentId) return;
    try {
      setDeleting(true);
      const { error } = await supabase.from('assignments').delete().eq('id', assignmentId);
      if (error) throw error;
      toast.success('Tarea eliminada exitosamente');
      if (assignment?.modulo_id) {
        navigate(`/courses/${assignment.modulo_id}`);
      } else {
        navigate('/');
      }
    } catch (error) {
      console.error('Error deleting assignment:', error);
      toast.error('Error al eliminar la tarea');
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
    }
  };

  const removeFeedbackFile = (index: number) => {
    setFeedbackFiles((prev) => prev.filter((_, i) => i !== index));
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="p-6 space-y-6">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-1/4"></div>
            <div className="h-24 bg-muted rounded"></div>
            <div className="h-64 bg-muted rounded"></div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!assignment) {
    return (
      <DashboardLayout>
        <div className="p-6">
          <Card>
            <CardContent className="p-8 text-center">
              <FileText className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                {hasError ? 'Error al cargar la tarea' : 'Tarea no encontrada'}
              </h3>
              <p className="text-muted-foreground mb-4">
                {hasError 
                  ? 'No tienes permisos para ver esta tarea o ha ocurrido un error.' 
                  : 'La tarea que buscas no existe.'}
              </p>
              <Button onClick={() => navigate('/')}>Volver al inicio</Button>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  const gradedCount = submissions.filter((s) => s.score !== null).length;
  const pendingCount = submissions.length - gradedCount;

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate('/assignments')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-foreground">{assignment.title}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="secondary">Módulo</Badge>
              <span className="text-sm text-muted-foreground">{assignment.modulo.name}</span>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setEditDialogOpen(true)}>
              <Edit className="w-4 h-4 mr-2" />
              Editar
            </Button>
            <Button variant="destructive" onClick={() => setDeleteDialogOpen(true)}>
              <Trash2 className="w-4 h-4 mr-2" />
              Eliminar
            </Button>
          </div>
        </div>

        {/* Assignment Info */}
        <Card className="bg-gradient-card shadow-card border-0">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Fecha de entrega</p>
                  <p className="text-sm font-medium">
                    {format(parseExamDate(assignment.due_date), "d 'de' MMMM, yyyy HH:mm", { locale: es })}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Entregas</p>
                  <p className="text-sm font-medium">{submissions.length} estudiantes</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Estado</p>
                  <p className="text-sm font-medium">
                    {gradedCount} calificadas, {pendingCount} pendientes
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Submissions List */}
          <div className="lg:col-span-1 space-y-4">
            <Card className="bg-gradient-card shadow-card border-0">
              <CardHeader>
                <CardTitle>Entregas de Estudiantes</CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                {submissions.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No hay entregas aún</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {submissions.map((submission) => (
                      <button
                        key={submission.id}
                        onClick={() => handleSelectSubmission(submission)}
                        className={`w-full p-3 rounded-lg border text-left transition-all ${
                          selectedSubmission?.id === submission.id
                            ? 'border-primary bg-accent'
                            : 'border-border hover:bg-accent/50'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarFallback>
                              {submission.student.first_name[0]}
                              {submission.student.last_name[0]}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {submission.student.first_name} {submission.student.last_name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(submission.submitted_at), 'd MMM, HH:mm', { locale: es })}
                            </p>
                            {submission.score !== null ? (
                              <Badge variant="default" className="text-xs mt-1">
                                {submission.score}
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="text-xs mt-1">
                                Sin calificar
                              </Badge>
                            )}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Submission Detail & Grading */}
          <div className="lg:col-span-2">
            {selectedSubmission ? (
              <Card className="bg-gradient-card shadow-card border-0">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle>
                        {selectedSubmission.student.first_name} {selectedSubmission.student.last_name}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">{selectedSubmission.student.email}</p>
                    </div>
                    <Badge variant={selectedSubmission.score !== null ? 'default' : 'secondary'}>
                      {selectedSubmission.score !== null ? 'Calificada' : 'Pendiente'}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="space-y-6">
                  {/* Submission Content */}
                  <div>
                    <Label className="text-base font-semibold">Contenido de la entrega</Label>
                    <div className="mt-2 p-4 bg-muted/50 rounded-lg">
                      <p className="text-sm text-foreground whitespace-pre-wrap">
                        {selectedSubmission.content || 'Sin contenido de texto'}
                      </p>
                    </div>
                  </div>

                  {/* File Attachments (multi) */}
                  {selectedSubmission.student_files && selectedSubmission.student_files.length > 0 && (
                    <div>
                      <Label className="text-base font-semibold">Archivos adjuntos del estudiante</Label>
                      <div className="mt-2 space-y-2">
                        {selectedSubmission.student_files.map((file: any, index: number) => {
                          
                          // 🔥 CORRECCIÓN: Buscamos en todas las propiedades posibles
                          const filePath = file.file_path || file.filePath || file.path;
                          const fileName = file.file_name || file.fileName;
                          const fileSize = file.file_size || file.fileSize;
                          const mimeType = file.mime_type || file.mimeType;

                          return (
                            <div key={index} className="flex items-center gap-3 p-3 border rounded-lg">
                              <FileText className="w-5 h-5 text-muted-foreground" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{fileName}</p>
                                <p className="text-xs text-muted-foreground">{formatKB(fileSize)}</p>
                              </div>

                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  if (canPreview(mimeType, fileName) && (mimeType?.toLowerCase().includes('pdf') || fileName?.toLowerCase().endsWith('.pdf'))) {
                                    navigate(`/grading/${selectedSubmission.id}`);
                                  } else if (canPreview(mimeType, fileName)) {
                                    handlePreviewFile({ filePath, fileName, mimeType, fileSize });
                                  } else {
                                    toast.message('Este tipo de archivo no se puede previsualizar. Usa Descargar.');
                                  }
                                }}
                              >
                                <Eye className="w-4 h-4 mr-1" />
                                {(mimeType?.includes('pdf') || fileName?.endsWith('.pdf')) ? "Calificar" : "Ver"}
                              </Button>

                              <Button variant="outline" size="sm" onClick={() => handleDownloadFile(filePath, fileName)}>
                                <Download className="w-4 h-4 mr-1" />
                                Descargar
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Grading Section */}
                  <div className="space-y-4 border-t pt-6">
                    <Label className="text-base font-semibold">Calificación</Label>

                    <div>
                      <Label htmlFor="score">Calificación</Label>
                      <Select value={score} onValueChange={setScore}>
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Selecciona una calificación" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="AD">AD - Logro Destacado</SelectItem>
                          <SelectItem value="A">A - Logro Esperado</SelectItem>
                          <SelectItem value="B">B - En Proceso</SelectItem>
                          <SelectItem value="C">C - En Inicio</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="feedback">Retroalimentación</Label>
                      <Textarea
                        id="feedback"
                        value={feedback}
                        onChange={(e) => setFeedback(e.target.value)}
                        placeholder="Escribe comentarios para el estudiante..."
                        rows={4}
                        className="mt-1"
                      />
                    </div>

                    {/* File Upload for Feedback */}
                    <div>
                      <Label>Archivos adjuntos (opcional)</Label>
                      <p className="text-xs text-muted-foreground mt-1 mb-2">
                        Máximo 5MB por archivo.
                      </p>

                      <div className="mt-2 space-y-2">
                        {/* Mostrar archivos existentes guardados */}
                        {selectedSubmission.feedback_files && selectedSubmission.feedback_files.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-xs font-medium text-muted-foreground">Archivos ya guardados:</p>
                            {selectedSubmission.feedback_files.map((file: any, index: number) => {
                              
                              // 🔥 CORRECCIÓN: Aquí también buscamos todas las propiedades
                              const filePath = file.file_path || file.filePath || file.path;
                              const fileName = file.file_name || file.fileName;
                              const fileSize = file.file_size || file.fileSize;

                              return (
                                <div key={`existing-${index}`} className="flex items-center gap-2 p-2 border rounded-lg bg-green-50 dark:bg-green-950/20">
                                  <FileText className="w-4 h-4 text-green-600 dark:text-green-400" />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">{fileName}</p>
                                    {fileSize && <p className="text-xs text-muted-foreground">{formatKB(fileSize)}</p>}
                                  </div>
                                  <Button variant="outline" size="sm" onClick={() => handleDownloadFile(filePath, fileName)}>
                                    <Download className="w-4 h-4" />
                                  </Button>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>

                    {selectedSubmission.graded_at && (
                      <p className="text-xs text-muted-foreground">
                        Última calificación:{' '}
                        {format(new Date(selectedSubmission.graded_at), "d 'de' MMMM, yyyy HH:mm", { locale: es })}
                      </p>
                    )}

                    <Button
                      onClick={handleGradeSubmission}
                      disabled={grading || !score}
                      className="w-full bg-gradient-primary shadow-glow"
                    >
                      {grading ? 'Guardando...' : 'Guardar Calificación'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="bg-gradient-card shadow-card border-0">
                <CardContent className="p-12 text-center">
                  <User className="w-16 h-16 mx-auto text-muted-foreground mb-4 opacity-50" />
                  <h3 className="text-lg font-semibold text-foreground mb-2">Selecciona una entrega</h3>
                  <p className="text-muted-foreground">Selecciona un estudiante de la lista para ver su entrega y calificarla</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* MODAL DE PREVISUALIZACIÓN */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between gap-3">
              <span className="truncate">
                Vista previa: {previewFile?.fileName || 'Archivo'}
              </span>

              {previewFile?.filePath && previewFile?.fileName && (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => handleDownloadFile(previewFile.filePath, previewFile.fileName)}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Descargar
                  </Button>
                </div>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="w-full">
            {previewLoading && (
              <div className="py-10 text-center text-muted-foreground">
                Cargando vista previa...
              </div>
            )}

            {!previewLoading && previewUrl && previewFile && (
              <div className="w-full">
                {canPreview(previewFile.mimeType || null, previewFile.fileName) &&
                ((previewFile.mimeType || '').toLowerCase().startsWith('image/') ||
                  previewFile.fileName.toLowerCase().match(/\.(png|jpg|jpeg|webp|gif)$/)) ? (
                  <div className="w-full flex justify-center">
                    <img
                      src={previewUrl}
                      alt={previewFile.fileName}
                      className="max-h-[70vh] w-auto rounded border"
                    />
                  </div>
                ) : null}

                {!canPreview(previewFile.mimeType || null, previewFile.fileName) ? (
                  <div className="py-10 text-center text-muted-foreground">
                    Este tipo de archivo no se puede previsualizar. Usa “Descargar”.
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Assignment Dialog */}
      {assignment && (
        <EditAssignmentDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          assignment={assignment}
          onEditSuccess={() => {
            fetchAssignmentData();
            setEditDialogOpen(false);
          }}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Esto eliminará permanentemente la tarea y todas las entregas de los estudiantes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? 'Eliminando...' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
};

export default AssignmentReview;
