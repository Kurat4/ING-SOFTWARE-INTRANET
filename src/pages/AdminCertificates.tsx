import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Award, Send, Loader2, Search, CheckCircle2, CheckCircle, XCircle, Clock, Filter } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface Course {
  id: string;
  name: string;
  code: string;
  program: { name: string; code: string } | null;
}

interface CertificateEntry {
  log_id: string;
  student_id: string;
  status: 'pending' | 'sent' | 'failed';
  sent_at: string | null;
  error_message: string | null;
  first_name: string;
  last_name: string;
  paternal_surname: string;
  maternal_surname: string;
  email: string;
  student_code: string;
}

type StatusFilter = 'all' | 'pending' | 'sent' | 'failed';

const AdminCertificates = () => {
  const { toast } = useToast();
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<string>('');
  const [entries, setEntries] = useState<CertificateEntry[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [webhookUrl, setWebhookUrl] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [sending, setSending] = useState(false);
  const [updatingRowId, setUpdatingRowId] = useState<string | null>(null);
  const [updatingBulk, setUpdatingBulk] = useState(false);

  useEffect(() => {
    fetchCourses();
    const saved = localStorage.getItem('n8n_webhook_url');
    if (saved) setWebhookUrl(saved);
  }, []);

  useEffect(() => {
    if (selectedCourse) {
      fetchEntries(selectedCourse);
    } else {
      setEntries([]);
      setSelectedIds(new Set());
    }
  }, [selectedCourse]);

  const fetchCourses = async () => {
    try {
      const { data, error } = await supabase
        .from('courses')
        .select('id, name, code, program:program_id(name, code)')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      setCourses(data || []);
    } catch {
      toast({ title: 'Error', description: 'No se pudieron cargar los cursos', variant: 'destructive' });
    } finally {
      setLoadingCourses(false);
    }
  };

  const fetchEntries = async (courseId: string) => {
    setLoadingEntries(true);
    setSelectedIds(new Set());
    try {
      const { data: logs, error: logsError } = await (supabase as any)
        .from('certificate_logs')
        .select('id, student_id, status, sent_at, error_message')
        .eq('course_id', courseId)
        .order('sent_at', { ascending: false });

      if (logsError) throw logsError;
      if (!logs || logs.length === 0) { setEntries([]); return; }

      const studentIds = [...new Set(logs.map((l: any) => l.student_id))] as string[];
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, paternal_surname, maternal_surname, email, student_code')
        .in('id', studentIds);

      if (profilesError) throw profilesError;

      const profileMap = Object.fromEntries((profiles || []).map((p: any) => [p.id, p]));
      const combined: CertificateEntry[] = logs.map((log: any) => {
        const p = profileMap[log.student_id] || {};
        return {
          log_id: log.id, student_id: log.student_id, status: log.status,
          sent_at: log.sent_at, error_message: log.error_message,
          first_name: p.first_name || '', last_name: p.last_name || '',
          paternal_surname: p.paternal_surname || '', maternal_surname: p.maternal_surname || '',
          email: p.email || '', student_code: p.student_code || '',
        };
      });
      setEntries(combined);
    } catch (error: any) {
      toast({ title: 'Error', description: `No se pudieron cargar los datos: ${error.message}`, variant: 'destructive' });
    } finally {
      setLoadingEntries(false);
    }
  };

  const getFullName = (e: CertificateEntry) => {
    if (e.paternal_surname && e.maternal_surname)
      return `${e.paternal_surname} ${e.maternal_surname}, ${e.first_name}`;
    return `${e.last_name || e.paternal_surname || ''}, ${e.first_name}`.trim();
  };

  const handleMarkRowAsSent = async (entry: CertificateEntry) => {
    if (entry.status !== 'pending') return;
    setUpdatingRowId(entry.log_id);
    try {
      const { error } = await (supabase as any)
        .from('certificate_logs')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('id', entry.log_id);
      if (error) throw error;
      setEntries(prev => prev.map(e => e.log_id === entry.log_id ? { ...e, status: 'sent' as const, sent_at: new Date().toISOString() } : e));
      toast({ title: 'Actualizado', description: `Certificado de ${getFullName(entry)} marcado como Enviado.` });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally { setUpdatingRowId(null); }
  };

  const handleMarkBulkAsSent = async () => {
    const pendingSelected = entries.filter(e => selectedIds.has(e.student_id) && e.status === 'pending');
    if (pendingSelected.length === 0) {
      toast({ title: 'Sin cambios', description: 'Los seleccionados ya están marcados como Enviado.' });
      return;
    }
    setUpdatingBulk(true);
    try {
      const logIds = pendingSelected.map(e => e.log_id);
      const { error } = await (supabase as any)
        .from('certificate_logs')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .in('id', logIds);
      if (error) throw error;
      setEntries(prev => prev.map(e => logIds.includes(e.log_id) ? { ...e, status: 'sent' as const, sent_at: new Date().toISOString() } : e));
      setSelectedIds(new Set());
      toast({ title: 'Estado actualizado', description: `${pendingSelected.length} certificado${pendingSelected.length !== 1 ? 's' : ''} marcado${pendingSelected.length !== 1 ? 's' : ''} como Enviado.` });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally { setUpdatingBulk(false); }
  };

  const handleSendCertificates = async () => {
    if (!selectedCourse || selectedIds.size === 0 || !webhookUrl) return;
    localStorage.setItem('n8n_webhook_url', webhookUrl);
    setSending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No hay sesión activa');
      const response = await fetch('https://bnbtmubibnupttnnhijr.supabase.co/functions/v1/send-certificates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ course_id: selectedCourse, student_ids: Array.from(selectedIds), n8n_webhook_url: webhookUrl }),
      });
      if (!response.ok) { const e = await response.json(); throw new Error(e.error || 'Error enviando certificados'); }
      const result = await response.json();
      toast({ title: 'Éxito', description: result.message });
      setSelectedIds(new Set());
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'No se pudieron enviar los certificados', variant: 'destructive' });
    } finally { setSending(false); }
  };

  const toggleEntry = (studentId: string) => {
    const next = new Set(selectedIds);
    next.has(studentId) ? next.delete(studentId) : next.add(studentId);
    setSelectedIds(next);
  };

  const selectAllFiltered = () => setSelectedIds(new Set(filteredEntries.map(e => e.student_id)));
  const clearSelection = () => setSelectedIds(new Set());

  const filteredEntries = entries.filter(e => {
    if (statusFilter !== 'all' && e.status !== statusFilter) return false;
    if (!searchTerm) return true;
    const s = searchTerm.toLowerCase();
    return getFullName(e).toLowerCase().includes(s) || e.email.toLowerCase().includes(s) || e.student_code.toLowerCase().includes(s);
  });

  const countByStatus = (s: StatusFilter) => s === 'all' ? entries.length : entries.filter(e => e.status === s).length;
  const selectedCourseData = courses.find(c => c.id === selectedCourse);
  const pendingSelectedCount = entries.filter(e => selectedIds.has(e.student_id) && e.status === 'pending').length;

  const StatusBadge = ({ status }: { status: string }) => {
    if (status === 'sent') return <Badge className="bg-green-100 text-green-700 border-green-300 gap-1"><CheckCircle className="h-3 w-3" />Enviado</Badge>;
    if (status === 'failed') return <Badge className="bg-red-100 text-red-700 border-red-300 gap-1"><XCircle className="h-3 w-3" />Fallido</Badge>;
    return <Badge className="bg-yellow-100 text-yellow-700 border-yellow-300 gap-1"><Clock className="h-3 w-3" />Pendiente</Badge>;
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
            <Award className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Gestión de Certificados</h1>
            <p className="text-muted-foreground mt-1">Consulta y actualiza el estado de los certificados por curso</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>Configuración</CardTitle>
              <CardDescription>Selecciona el curso y configura el webhook</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="course">Curso</Label>
                <Select value={selectedCourse} onValueChange={setSelectedCourse}>
                  <SelectTrigger id="course"><SelectValue placeholder="Selecciona un curso" /></SelectTrigger>
                  <SelectContent>
                    {courses.map(course => (
                      <SelectItem key={course.id} value={course.id}>{course.code} - {course.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedCourseData?.program && (
                  <p className="text-xs text-muted-foreground">Programa: {selectedCourseData.program.name}</p>
                )}
              </div>

              {selectedCourse && entries.length > 0 && (
                <div className="pt-2 border-t space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Resumen</p>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2">
                      <div className="font-bold text-lg text-yellow-700">{countByStatus('pending')}</div>
                      <div className="text-xs text-yellow-600">Pendientes</div>
                    </div>
                    <div className="bg-green-50 border border-green-200 rounded-lg p-2">
                      <div className="font-bold text-lg text-green-700">{countByStatus('sent')}</div>
                      <div className="text-xs text-green-600">Enviados</div>
                    </div>
                    <div className="bg-red-50 border border-red-200 rounded-lg p-2">
                      <div className="font-bold text-lg text-red-700">{countByStatus('failed')}</div>
                      <div className="text-xs text-red-600">Fallidos</div>
                    </div>
                  </div>
                  <div className="flex justify-between text-sm pt-1">
                    <span className="text-muted-foreground">Seleccionados:</span>
                    <span className="font-medium text-primary">{selectedIds.size}</span>
                  </div>
                </div>
              )}

              <div className="space-y-2 pt-2 border-t">
                <Label htmlFor="webhook">URL Webhook n8n</Label>
                <Input id="webhook" type="url" placeholder="https://n8n.example.com/webhook/..." value={webhookUrl} onChange={e => setWebhookUrl(e.target.value)} />
              </div>

              <Button variant="outline" onClick={handleMarkBulkAsSent} disabled={updatingBulk || selectedIds.size === 0 || !selectedCourse} className="w-full border-green-300 text-green-700 hover:bg-green-50">
                {updatingBulk ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Actualizando...</> : <><CheckCircle className="w-4 h-4 mr-2" />Marcar {pendingSelectedCount > 0 ? pendingSelectedCount : selectedIds.size} como Enviado</>}
              </Button>

              <Button onClick={handleSendCertificates} disabled={sending || selectedIds.size === 0 || !selectedCourse || !webhookUrl} className="w-full">
                {sending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Enviando...</> : <><Send className="w-4 h-4 mr-2" />Enviar {selectedIds.size} Certificado{selectedIds.size !== 1 ? 's' : ''} vía n8n</>}
              </Button>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <CardTitle>Estudiantes</CardTitle>
                  <CardDescription>{selectedCourse ? `${filteredEntries.length} registro${filteredEntries.length !== 1 ? 's' : ''}` : 'Selecciona un curso'}</CardDescription>
                </div>
                {entries.length > 0 && (
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={selectAllFiltered} disabled={selectedIds.size === filteredEntries.length && filteredEntries.length > 0}>
                      <CheckCircle2 className="w-4 h-4 mr-1" />Seleccionar todos
                    </Button>
                    <Button variant="outline" size="sm" onClick={clearSelection} disabled={selectedIds.size === 0}>Limpiar</Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {!selectedCourse ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Award className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Selecciona un curso para ver los estudiantes</p>
                </div>
              ) : loadingEntries ? (
                <div className="text-center py-12">
                  <Loader2 className="w-8 h-8 mx-auto animate-spin text-primary" />
                  <p className="mt-4 text-muted-foreground">Cargando...</p>
                </div>
              ) : entries.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <p>No hay registros de certificados para este curso</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex gap-2 flex-wrap">
                    <div className="relative flex-1 min-w-[160px]">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input placeholder="Buscar por nombre, código o email..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10" />
                    </div>
                    <Select value={statusFilter} onValueChange={v => setStatusFilter(v as StatusFilter)}>
                      <SelectTrigger className="w-48">
                        <Filter className="w-4 h-4 mr-2 text-muted-foreground" />
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos ({countByStatus('all')})</SelectItem>
                        <SelectItem value="pending">Pendientes ({countByStatus('pending')})</SelectItem>
                        <SelectItem value="sent">Enviados ({countByStatus('sent')})</SelectItem>
                        <SelectItem value="failed">Fallidos ({countByStatus('failed')})</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10"></TableHead>
                          <TableHead>Código</TableHead>
                          <TableHead>Nombre</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Estado</TableHead>
                          <TableHead className="w-36">Acción</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredEntries.map(entry => (
                          <TableRow key={entry.log_id} className={entry.status === 'sent' ? 'opacity-60' : ''}>
                            <TableCell><Checkbox checked={selectedIds.has(entry.student_id)} onCheckedChange={() => toggleEntry(entry.student_id)} /></TableCell>
                            <TableCell className="font-mono text-sm">{entry.student_code || '-'}</TableCell>
                            <TableCell className="font-medium">{getFullName(entry)}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{entry.email}</TableCell>
                            <TableCell><StatusBadge status={entry.status} /></TableCell>
                            <TableCell>
                              {entry.status === 'pending' ? (
                                <Button variant="outline" size="sm" onClick={() => handleMarkRowAsSent(entry)} disabled={updatingRowId === entry.log_id} className="border-green-300 text-green-700 hover:bg-green-50 h-7 text-xs px-2">
                                  {updatingRowId === entry.log_id ? <Loader2 className="h-3 w-3 animate-spin" /> : <><CheckCircle className="h-3 w-3 mr-1" />Marcar enviado</>}
                                </Button>
                              ) : (
                                <span className="text-xs text-muted-foreground">
                                  {entry.sent_at ? new Date(entry.sent_at).toLocaleDateString('es', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '-'}
                                </span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                        {filteredEntries.length === 0 && (
                          <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No se encontraron registros con los filtros aplicados</TableCell></TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="bg-blue-50 border-blue-200">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2"><Award className="w-5 h-5" />Como funciona</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-white p-3 rounded-lg border border-blue-200">
              <p className="text-sm font-semibold text-blue-900 mb-2">Flujo del sistema:</p>
              <ol className="list-decimal list-inside text-sm text-muted-foreground space-y-1 ml-2">
                <li>El estudiante entrega su portafolio final</li>
                <li>Se registra automaticamente con estado Pendiente</li>
                <li>Filtra por estado: Todos / Pendientes / Enviados / Fallidos</li>
                <li>Marca individualmente con Marcar enviado en cada fila</li>
                <li>O selecciona varios y usa Marcar como Enviado en el panel izquierdo</li>
                <li>Tambien puedes enviar via webhook n8n para automatizar el envio del certificado</li>
              </ol>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default AdminCertificates;