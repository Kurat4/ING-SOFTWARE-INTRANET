import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { BookOpen, Upload, Download, Trash2, AlertCircle, Lock } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
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

interface ModuloBookSectionProps {
  courseId: string; // Este es el course_id (edición)
  canEdit: boolean; // true solo si es admin
}

export function ModuloBookSection({ courseId, canEdit }: ModuloBookSectionProps) {
  const { profile } = useAuth();
  const [course, setCourse] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [bookFile, setBookFile] = useState<File | null>(null);
  const [hasAccess, setHasAccess] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  useEffect(() => {
    fetchCourseData();
    checkStudentAccess();
  }, [courseId, profile]);

  const fetchCourseData = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('courses')
        .select('id, name, code, book_url')
        .eq('id', courseId)
        .single();

      if (error) throw error;
      setCourse(data);
    } catch (error: any) {
      console.error('Error al cargar datos del curso:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkStudentAccess = async () => {
    if (!profile || profile.role !== 'student') {
      // Admin y profesores tienen acceso automáticamente
      setHasAccess(profile?.role === 'admin' || profile?.role === 'teacher');
      return;
    }

    try {
      // Verificar si el estudiante compró el book
      const { data, error } = await supabase
        .from('registro_compra_materiales')
        .select('id, estado_pago')
        .eq('course_id', courseId)
        .eq('estudiante_id', profile.id)
        .eq('tipo_material', 'book')
        .eq('estado_pago', 'pagado')
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;
      setHasAccess(!!data);
    } catch (error: any) {
      console.error('Error al verificar acceso:', error);
      setHasAccess(false);
    }
  };

  const handleUploadBook = async () => {
    if (!bookFile || !canEdit) return;

    try {
      setUploading(true);

      // Eliminar el book anterior si existe
      if (course?.book_url) {
        await handleDeleteBook(false); // false = no mostrar toast
      }

      const fileExt = bookFile.name.split('.').pop();
      const fileName = `${courseId}/book.${fileExt}`;

      // Subir a storage
      const { error: uploadError } = await supabase.storage
        .from('course-books')
        .upload(fileName, bookFile, {
          cacheControl: '3600',
          upsert: true,
        });

      if (uploadError) throw uploadError;

      // Obtener la URL pública
      const { data: urlData } = supabase.storage
        .from('course-books')
        .getPublicUrl(fileName);

      // Actualizar el campo book_url en la tabla courses
      const { error: updateError } = await supabase
        .from('courses')
        .update({ book_url: urlData.publicUrl })
        .eq('id', courseId);

      if (updateError) throw updateError;

      toast.success('Book subido correctamente');
      setBookFile(null);
      fetchCourseData();
    } catch (error: any) {
      console.error('Error al subir book:', error);
      toast.error(`Error al subir el book: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteBook = async (showToast = true) => {
    if (!course?.book_url || !canEdit) return;

    try {
      // Extraer el path del archivo desde la URL
      const fileName = `${courseId}/book.pdf`;

      // Eliminar del storage
      const { error: deleteError } = await supabase.storage
        .from('course-books')
        .remove([fileName]);

      // Continuar aunque falle (el archivo podría no existir)
      if (deleteError) console.warn('Advertencia al eliminar archivo:', deleteError);

      // Actualizar la base de datos
      const { error: updateError } = await supabase
        .from('courses')
        .update({ book_url: null })
        .eq('id', courseId);

      if (updateError) throw updateError;

      if (showToast) {
        toast.success('Book eliminado correctamente');
      }
      fetchCourseData();
      setShowDeleteDialog(false);
    } catch (error: any) {
      console.error('Error al eliminar book:', error);
      toast.error(`Error al eliminar el book: ${error.message}`);
    }
  };

  const handleDownloadBook = async () => {
    if (!course?.book_url) return;

    try {
      const fileName = `${courseId}/book.pdf`;
      
      const { data, error } = await supabase.storage
        .from('course-books')
        .download(fileName);

      if (error) throw error;

      // Crear URL temporal para descargar
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Book_${course.code}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('Descargando book...');
    } catch (error: any) {
      console.error('Error al descargar book:', error);
      toast.error(`Error al descargar el book: ${error.message}`);
    }
  };

  if (loading) {
    return (
      <Card className="animate-pulse">
        <CardContent className="p-6 h-32 bg-muted/20"></CardContent>
      </Card>
    );
  }

  // Si no hay book y no es admin, no mostrar nada
  if (!course?.book_url && !canEdit) {
    return null;
  }

  return (
    <>
      <Card className="border-l-4 border-l-blue-500">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <BookOpen className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <CardTitle className="text-lg">Book del Curso</CardTitle>
                <CardDescription>
                  Material de estudio en formato PDF
                </CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Vista para Administrador */}
          {canEdit && (
            <div className="space-y-4">
              {!course.book_url ? (
                <div className="space-y-3">
                  <Label htmlFor="book-upload">Subir Book (PDF)</Label>
                  <div className="flex gap-2">
                    <Input
                      id="book-upload"
                      type="file"
                      accept=".pdf"
                      onChange={(e) => setBookFile(e.target.files?.[0] || null)}
                      disabled={uploading}
                    />
                    <Button
                      onClick={handleUploadBook}
                      disabled={!bookFile || uploading}
                      className="whitespace-nowrap"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      {uploading ? 'Subiendo...' : 'Subir'}
                    </Button>
                  </div>
                  {bookFile && (
                    <p className="text-sm text-muted-foreground">
                      Archivo seleccionado: {bookFile.name}
                    </p>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center gap-3">
                    <BookOpen className="h-5 w-5 text-green-600" />
                    <div>
                      <p className="font-medium text-green-900">Book disponible</p>
                      <p className="text-sm text-green-700">
                        Los estudiantes que compraron el book pueden descargarlo
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleDownloadBook}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Descargar
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setShowDeleteDialog(true)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Eliminar
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Vista para Profesores */}
          {!canEdit && profile?.role === 'teacher' && course.book_url && (
            <div className="flex items-center justify-between p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-3">
                <BookOpen className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="font-medium text-blue-900">Book del Curso</p>
                  <p className="text-sm text-blue-700">Material disponible para descarga</p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadBook}
              >
                <Download className="h-4 w-4 mr-2" />
                Descargar
              </Button>
            </div>
          )}

          {/* Vista para Estudiantes */}
          {!canEdit && profile?.role === 'student' && (
            <>
              {hasAccess && course.book_url ? (
                <div className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center gap-3">
                    <BookOpen className="h-5 w-5 text-green-600" />
                    <div>
                      <p className="font-medium text-green-900">Book del Curso</p>
                      <p className="text-sm text-green-700">
                        Tienes acceso al material de estudio
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleDownloadBook}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Descargar
                  </Button>
                </div>
              ) : course.book_url ? (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="flex items-start gap-3">
                    <Lock className="h-5 w-5 text-amber-600 mt-0.5" />
                    <div>
                      <p className="font-medium text-amber-900">
                        Book no disponible
                      </p>
                      <p className="text-sm text-amber-700 mt-1">
                        Para acceder al material del curso, debes adquirir el book.
                        Consulta con administración.
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>

      {/* Diálogo de confirmación para eliminar */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-600" />
              ¿Eliminar Book?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará el book del curso. Los estudiantes ya no podrán
              descargarlo. ¿Estás seguro de continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleDeleteBook()}
              className="bg-red-600 hover:bg-red-700"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
