import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Star, MessageSquare, ClipboardList, Loader2, Users } from "lucide-react";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/AppSidebar";

export default function AdminSatisfaccion() {
  const [reportData, setReportData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  const [selectedComments, setSelectedComments] = useState<{nombre: string, lista: string[]}>({nombre: '', lista: []});

  useEffect(() => {
    fetchSurveyReports();
  }, []);

  

  const fetchSurveyReports = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('teacher_surveys')
        .select(`
          course_id,
          answers,
          comment,
          modulos:course_id (
            name
          )
        `);

      if (error) throw error;

      if (data) {
        const grouped = data.reduce((acc: any, curr: any) => {
          const id = curr.course_id;
          
          // Usamos 'name' porque el error anterior nos confirmó que esa columna SÍ existe
          const modName = curr.modulos?.name || 'Curso Desconocido';
          
          if (!acc[id]) {
            acc[id] = { nombre: modName, total: 0, sumaPuntos: 0, comentarios: [] };
          }
          
          const values: number[] = Object.values(curr.answers || {});
          const avg = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
          
          acc[id].total += 1;
          acc[id].sumaPuntos += avg;
          if (curr.comment?.trim()) acc[id].comentarios.push(curr.comment);
          
          return acc;
        }, {});

        setReportData(Object.values(grouped));
      }
    } catch (error) {
      console.error("Error cargando reportes:", error);
    } finally {
      setLoading(false);
    }
  };

  const openComments = (nombre: string, comentarios: string[]) => {
    setSelectedComments({ nombre, lista: comentarios });
    setIsCommentsOpen(true);
  };

  if (loading) return (
    <div className="flex h-screen items-center justify-center">
      <Loader2 className="animate-spin h-10 w-10 text-blue-600" />
    </div>
  );

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-slate-50/50">
        <AppSidebar />
        <SidebarInset>
          <main className="p-4 md:p-8 pt-6 w-full">
            <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
              
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-bold flex items-center gap-2 text-slate-800">
                    <ClipboardList className="text-orange-500 h-7 w-7" /> Satisfacción Estudiantil
                  </h2>
                  <p className="text-slate-500 text-sm">Reportes detallados de la encuesta docente de Peri</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-white border-slate-200 shadow-sm">
                  <CardContent className="pt-6">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-xs text-slate-500 font-bold uppercase">Encuestas Recibidas</p>
                        <p className="text-4xl font-black text-slate-900">
                          {reportData.reduce((a,b) => a + b.total, 0)}
                        </p>
                      </div>
                      <div className="p-2 bg-blue-50 rounded-lg text-blue-600"><Users className="h-5 w-5" /></div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card className="overflow-hidden border-slate-200 shadow-sm bg-white">
                <Table>
                  <TableHeader className="bg-slate-50/50">
                    <TableRow>
                      <TableHead>Curso / Módulo</TableHead>
                      <TableHead className="text-center">Alumnos</TableHead>
                      <TableHead className="text-center">Promedio</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reportData.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-20 text-slate-400 italic">
                          No hay datos disponibles. Revisa las políticas RLS en Supabase.
                        </TableCell>
                      </TableRow>
                    ) : (
                      reportData.map((item, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-medium">{item.nombre}</TableCell>
                          <TableCell className="text-center">
                            <Badge variant="secondary">{item.total}</Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-1 font-bold">
                              <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                              {(item.sumaPuntos / item.total).toFixed(1)}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={() => openComments(item.nombre, item.comentarios)}
                            >
                              Ver comentarios ({item.comentarios.length})
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </Card>
            </div>
          </main>
        </SidebarInset>
      </div>

      <Dialog open={isCommentsOpen} onOpenChange={setIsCommentsOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Sugerencias: {selectedComments.nombre}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-4 max-h-[60vh] overflow-y-auto">
            {selectedComments.lista.map((txt, i) => (
              <div key={i} className="p-3 bg-slate-50 rounded border text-sm text-slate-600">
                "{txt}"
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
}