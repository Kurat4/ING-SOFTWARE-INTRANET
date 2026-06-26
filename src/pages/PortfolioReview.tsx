import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
// Agregamos el icono 'Users' para el botón de mostrar alumnos
import { ArrowLeft, Loader2, CheckCircle, Clock, User, Save, Download, Users } from 'lucide-react';
import { toast } from 'sonner';
import PdfAnnotator from '@/components/assignments/PdfAnnotator';

export default function PortfolioReview() {
  const { portfolioId } = useParams();
  const navigate = useNavigate();
  const annotatorRef = useRef<any>(null);

  const [portfolio, setPortfolio] = useState<any>(null);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSubmission, setSelectedSubmission] = useState<any>(null);
  
  // NUEVO: Estado para controlar si el menú de alumnos está abierto o cerrado
  const [showStudents, setShowStudents] = useState(true);
  
  // Estados para calificar
  const [score, setScore] = useState("");
  const [feedback, setFeedback] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, [portfolioId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const { data: portData, error: portError } = await supabase
        .from('edition_portfolios')
        .select('*')
        .eq('id', portfolioId)
        .single();

      if (portError) throw portError;
      setPortfolio(portData);

      const { data: subsData, error: subsError } = await supabase
        .from('edition_portfolio_submissions')
        .select(`
          *,
          student:profiles (id, first_name, last_name, email)
        `)
        .eq('portfolio_id', portfolioId)
        .order('submitted_at', { ascending: false });

      if (subsError) throw subsError;
      setSubmissions(subsData || []);
    } catch (error: any) {
      toast.error("Error al cargar entregas: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectSubmission = (sub: any) => {
    setSelectedSubmission(sub);
    setScore(sub.grade || "");
    setFeedback(sub.feedback || "");
    // NUEVO: Cerrar el panel automáticamente al seleccionar un alumno
    setShowStudents(false);
  };

  const handleSaveGrade = async () => {
    if (!selectedSubmission || !score) {
      toast.error("Selecciona una calificación");
      return;
    }

    try {
      setIsSaving(true);
      
      if (annotatorRef.current) {
        await annotatorRef.current.savePdfOnly();
      }

      const { error } = await supabase
        .from('edition_portfolio_submissions')
        .update({
          grade: score,
          feedback: feedback,
          status: 'graded',
          submitted_at: new Date().toISOString()
        })
        .eq('id', selectedSubmission.id);

      if (error) throw error;

      toast.success("Calificación guardada correctamente");

      setSubmissions(prev => prev.map(sub => 
        sub.id === selectedSubmission.id 
          ? { ...sub, grade: score, feedback: feedback, status: 'graded' } 
          : sub
      ));

      setSelectedSubmission(prev => ({ ...prev, grade: score, feedback: feedback, status: 'graded' }));

    } catch (error: any) {
      console.error(error);
      toast.error("Error: " + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>;

  return (
    <DashboardLayout>
      <div className="flex flex-col h-[calc(100vh-64px)] overflow-hidden w-full max-w-full">
        
        {/* Header */}
        <div className="bg-white border-b p-3 flex items-center justify-between shadow-sm flex-shrink-0 z-20 relative">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Volver
            </Button>
            
            {/* NUEVO: Botón para volver a abrir la lista de alumnos si está cerrada */}
            <Button 
              variant={showStudents ? "default" : "outline"} 
              size="sm" 
              className={showStudents ? "bg-blue-600" : "border-blue-200 text-blue-700"}
              onClick={() => setShowStudents(!showStudents)}
            >
              <Users className="h-4 w-4 mr-2" /> 
              {showStudents ? "Ocultar Alumnos" : "Ver Alumnos"}
            </Button>

            <div className="hidden md:block border-l pl-4 ml-2">
              <h1 className="text-sm font-bold truncate max-w-[300px]">{portfolio?.title}</h1>
            </div>
          </div>
          <div className="flex gap-2 text-xs">
            <Badge variant="outline" className="flex gap-1 bg-green-50"><CheckCircle className="h-3 w-3 text-green-500"/> {submissions.filter(s => s.status === 'graded').length}</Badge>
            <Badge variant="outline" className="flex gap-1 bg-yellow-50"><Clock className="h-3 w-3 text-yellow-500"/> {submissions.filter(s => s.status === 'submitted').length}</Badge>
          </div>
        </div>

        {/* CONTENEDOR PRINCIPAL */}
        <div className="flex-1 flex overflow-hidden w-full max-w-full relative">
          
          {/* COLUMNA IZQUIERDA: Lista de Alumnos (Ahora colapsable y un poco más angosta: w-72) */}
          {showStudents && (
            <div className="w-72 flex-shrink-0 border-r bg-slate-50 overflow-y-auto p-3 space-y-2 z-10 shadow-[4px_0_15px_-3px_rgba(0,0,0,0.1)]">
              <h3 className="font-semibold text-xs mb-3 text-gray-500 uppercase tracking-wider px-1">Estudiantes ({submissions.length})</h3>
              {submissions.map((sub) => (
                <button
                  key={sub.id}
                  onClick={() => handleSelectSubmission(sub)}
                  className={`w-full flex items-center gap-3 p-2.5 rounded-lg transition-all border ${
                    selectedSubmission?.id === sub.id 
                    ? 'bg-blue-600 border-blue-600 text-white shadow-md' 
                    : 'bg-white border-gray-200 hover:border-blue-300'
                  }`}
                >
                  <Avatar className="h-8 w-8 border flex-shrink-0">
                    <AvatarFallback className={`text-xs ${selectedSubmission?.id === sub.id ? 'text-blue-600' : ''}`}>
                      {sub.student.first_name[0]}{sub.student.last_name[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="text-left overflow-hidden min-w-0 flex-1">
                    <p className="text-sm font-bold truncate">{sub.student.first_name} {sub.student.last_name}</p>
                    <p className={`text-[10px] ${selectedSubmission?.id === sub.id ? 'text-blue-100' : 'text-gray-400'}`}>
                      {sub.status === 'graded' ? '✅ Calificado' : '⏳ Pendiente'}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* ÁREA DERECHA: PDF + Calificación */}
          {selectedSubmission ? (
            /* NUEVO: Redujimos la columna derecha de 320px a 260px */
            <div className="flex-1 grid grid-cols-[1fr_260px] overflow-hidden">
              
              {/* ZONA DEL PDF */}
              <div className="relative bg-gray-200 overflow-hidden">
                <div className="absolute inset-0">
                  {selectedSubmission.file_path ? (
                    <PdfAnnotator 
                      ref={annotatorRef}
                      pdfUrl={selectedSubmission.file_path}
                      fileName={selectedSubmission.file_name || "portafolio.pdf"}
                      submissionId={selectedSubmission.id}
                      storageBucket="student-submissions"
                      storagePath={selectedSubmission.file_path}
                      isPortfolio={true}
                    />
                  ) : (
                    <div className="h-full flex items-center justify-center text-gray-500">
                      Este alumno no ha subido el archivo PDF.
                    </div>
                  )}
                </div>
              </div>

              {/* COLUMNA DERECHA: Panel de Calificación (Más angosto y optimizado) */}
              <div className="bg-white p-4 overflow-y-auto flex flex-col gap-4 border-l z-10 shadow-[-4px_0_15px_-3px_rgba(0,0,0,0.05)]">
                
                <div className="flex flex-col gap-2 pb-3 border-b border-gray-100">
                  <Label className="text-xs text-gray-500 font-semibold uppercase">Archivo Original</Label>
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="w-full gap-2 text-blue-700 border-blue-200 hover:bg-blue-50 bg-blue-50/50 shadow-sm"
                    onClick={() => {
                      const { data } = supabase.storage
                        .from('student-submissions')
                        .getPublicUrl(selectedSubmission.file_path);
                      window.open(data.publicUrl, '_blank');
                    }}
                  >
                    <Download className="h-3.5 w-3.5" /> 
                    Descargar
                  </Button>
                </div>

                <div>
                  <Label className="text-sm font-bold">Calificación</Label>
                  <Select value={score} onValueChange={setScore}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Nota" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AD">AD - Excelente</SelectItem>
                      <SelectItem value="A">A - Muy Bueno</SelectItem>
                      <SelectItem value="B">B - Regular</SelectItem>
                      <SelectItem value="C">C - Desaprobado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex-1 flex flex-col min-h-0">
                  <Label className="text-sm font-semibold mb-1">Feedback</Label>
                  <Textarea 
                    className="flex-1 resize-none min-h-[120px] text-sm" 
                    placeholder="Comentarios para el alumno..."
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                  />
                </div>

                <Button 
                  className="w-full flex-shrink-0 bg-blue-600 hover:bg-blue-700 shadow-md"
                  onClick={handleSaveGrade}
                  disabled={isSaving}
                >
                  {isSaving ? <Loader2 className="animate-spin h-4 w-4 mr-2"/> : <Save className="h-4 w-4 mr-2"/>}
                  Guardar
                </Button>
              </div>

            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400 bg-slate-50 min-w-0 border-l">
              <User className="h-16 w-16 mb-4 opacity-20" />
              <p>Selecciona un estudiante para empezar la revisión</p>
            </div>
          )}
        </div>

      </div>
    </DashboardLayout>
  );
}
