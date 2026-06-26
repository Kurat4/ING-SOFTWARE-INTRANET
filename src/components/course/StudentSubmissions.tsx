import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileUpload } from '@/components/ui/file-upload';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Upload, Download, Check, X, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface StudentSubmissionsProps {
  resourceId: string;
  assignmentTitle: string;
  deadline?: string;
  maxScore?: number;
  canSubmit: boolean;
}

interface Submission {
  id: string;
  content?: string;
  file_path?: string;
  file_name?: string;
  score?: number;
  feedback?: string;
  submitted_at: string;
  graded_at?: string;
}

export function StudentSubmissions({ 
  resourceId, 
  assignmentTitle, 
  deadline, 
  maxScore,
  canSubmit 
}: StudentSubmissionsProps) {
  const { profile } = useAuth();
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [content, setContent] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  const isDeadlinePassed = deadline ? new Date() > new Date(deadline) : false;
  const canMakeSubmission = canSubmit && !isDeadlinePassed && !submission;

  useEffect(() => {
    fetchSubmission();
  }, [resourceId]);

  const fetchSubmission = async () => {
    if (!profile) return;
    
    try {
      setLoading(true);
      
      // First get assignment from resource
      const { data: resource, error: resourceError } = await supabase
        .from('course_weekly_resources')
        .select('*')
        .eq('id', resourceId)
        .single();

      if (resourceError) throw resourceError;

      // Look for existing assignment and submission
      const { data: assignment } = await supabase
        .from('assignments')
        .select(`
          id,
          assignment_submissions (
            id,
            content,
            file_path,
            file_name,
            file_size,
            score,
            feedback,
            submitted_at,
            graded_at
          )
        `)
        .eq('title', assignmentTitle)
        .maybeSingle();

      if (assignment?.assignment_submissions?.[0]) {
        setSubmission(assignment.assignment_submissions[0] as any);
      }
    } catch (error) {
      console.error('Error fetching submission:', error);
      toast.error('Error al cargar la entrega');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!profile || (!content.trim() && selectedFiles.length === 0)) {
      toast.error('Debes escribir contenido o subir un archivo');
      return;
    }

    try {
      setSubmitting(true);

      let filePath = null;
      let fileName = null;
      let fileSize = null;
      let mimeType = null;

      // Upload file if selected
      if (selectedFiles.length > 0) {
        const file = selectedFiles[0];
        const fileExt = file.name.split('.').pop();
        const uploadFileName = `${Math.random()}.${fileExt}`;
        const uploadPath = `${profile.user_id}/${uploadFileName}`;

        const { error: uploadError } = await supabase.storage
          .from('student-submissions')
          .upload(uploadPath, file);

        if (uploadError) throw uploadError;

        filePath = uploadPath;
        fileName = file.name;
        fileSize = file.size;
        mimeType = file.type;
      }

      // Get course_id from resource
      const { data: resource, error: resourceError } = await supabase
        .from('course_weekly_resources')
        .select('section:course_weekly_sections!inner(course_id)')
        .eq('id', resourceId)
        .single();

      if (resourceError) throw resourceError;

      const courseId = (resource.section as any).course_id;

      // Use edge function to handle assignment creation and submission
      const { data, error } = await supabase.functions.invoke('submit-assignment', {
        body: {
          resourceId,
          assignmentTitle,
          deadline,
          maxScore,
          content: content.trim(),
          filePath,
          fileName,
          fileSize,
          mimeType,
          courseId
        }
      });

      if (error) throw error;

      toast.success('Entrega realizada exitosamente');
      fetchSubmission();
      setContent('');
      setSelectedFiles([]);
    } catch (error) {
      console.error('Error submitting assignment:', error);
      toast.error('Error al realizar la entrega');
    } finally {
      setSubmitting(false);
    }
  };

  const getSubmissionStatus = () => {
    if (!submission) {
      if (isDeadlinePassed) return { label: 'No entregado', color: 'destructive' };
      return { label: 'Pendiente', color: 'secondary' };
    }
    
    if (submission.score !== null && submission.score !== undefined) {
      return { label: 'Calificado', color: 'default' };
    }
    
    return { label: 'Entregado', color: 'secondary' };
  };

  const handleDownloadSubmission = async () => {
    if (!submission?.file_path) return;

    try {
      const { data, error } = await supabase.functions.invoke('download-file', {
        body: {
          bucket: 'student-submissions',
          filePath: submission.file_path,
          fileName: submission.file_name
        }
      });

      if (error) throw error;

      // Download the file using the signed URL
      const link = document.createElement('a');
      link.href = data.signedUrl;
      link.download = data.fileName || submission.file_name || 'download';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error downloading file:', error);
      toast.error('Error al descargar el archivo');
    }
  };

  const status = getSubmissionStatus();

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-1/3"></div>
            <div className="h-20 bg-muted rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{assignmentTitle}</CardTitle>
          <Badge variant={status.color as any}>
            {status.label}
          </Badge>
        </div>
        {deadline && (
          <p className="text-sm text-muted-foreground">
            <Clock className="h-4 w-4 inline mr-1" />
            Fecha límite: {format(new Date(deadline), 'dd/MM/yyyy HH:mm')}
          </p>
        )}
        {maxScore && (
          <p className="text-sm text-muted-foreground">
            Puntaje máximo: {maxScore} puntos
          </p>
        )}
      </CardHeader>
      
      <CardContent className="space-y-4">
        {submission ? (
          <div className="space-y-4">
            <div>
              <h4 className="font-medium mb-2">Tu entrega:</h4>
              <div className="bg-muted p-4 rounded-lg">
                {submission.content && (
                  <p className="text-sm">{submission.content}</p>
                )}
                {submission.file_name && (
                  <div className="flex items-center gap-2 mt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleDownloadSubmission}
                      className="flex items-center gap-2"
                    >
                      <Download className="h-4 w-4" />
                      <span className="text-sm">{submission.file_name}</span>
                    </Button>
                  </div>
                )}
                <p className="text-xs text-muted-foreground mt-2">
                  Entregado el: {format(new Date(submission.submitted_at), 'dd/MM/yyyy HH:mm')}
                </p>
              </div>
            </div>

            {submission.score !== null && submission.score !== undefined && (
              <div>
                <h4 className="font-medium mb-2">Calificación:</h4>
                <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Check className="h-5 w-5 text-green-600" />
                    <span className="font-medium text-green-800">
                      {submission.score} / {maxScore || 100} puntos
                    </span>
                  </div>
                  {submission.feedback && (
                    <p className="text-sm text-green-700">{submission.feedback}</p>
                  )}
                  {submission.graded_at && (
                    <p className="text-xs text-green-600 mt-2">
                      Calificado el: {format(new Date(submission.graded_at), 'dd/MM/yyyy HH:mm')}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          canMakeSubmission ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="content">Contenido de la entrega</Label>
                <Textarea
                  id="content"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Escribe tu respuesta o explicación aquí..."
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label>Subir archivo (opcional)</Label>
                <FileUpload
                  onFileSelect={setSelectedFiles}
                  maxSize={10}
                  multiple={false}
                />
              </div>

              <Button 
                onClick={handleSubmit} 
                disabled={submitting}
                className="bg-gradient-primary shadow-glow"
              >
                <Upload className="h-4 w-4 mr-2" />
                {submitting ? 'Entregando...' : 'Realizar Entrega'}
              </Button>
            </div>
          ) : (
            <div className="text-center py-8">
              {isDeadlinePassed ? (
                <div className="text-muted-foreground">
                  <X className="h-12 w-12 mx-auto mb-2 text-red-500" />
                  <p>La fecha límite para esta tarea ha pasado</p>
                </div>
              ) : (
                <div className="text-muted-foreground">
                  <Clock className="h-12 w-12 mx-auto mb-2" />
                  <p>No puedes realizar entregas para esta tarea</p>
                </div>
              )}
            </div>
          )
        )}
      </CardContent>
    </Card>
  );
}