import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { formatDate } from '@/lib/dateUtils.ts';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { MONEDAS } from '@/integrations/supabase/peri-types';
import type { CompraGrabadaWithRelaciones } from '@/integrations/supabase/peri-types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import {
  Plus,
  ShoppingCart,
  Trash2,
  Eye,
  BookOpen,
  PackageCheck,
  CreditCard,
} from 'lucide-react';

// ─── Interfaces locales ──────────────────────────────────────────────────────

interface Profile {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  student_code?: string;
  document_number?: string;
}

interface CursoGrabado {
  id: string;
  name: string;
}

/** Item temporal del carrito en el formulario de nueva compra */
interface ItemCarrito {
  cursoId: string;
  cursoNombre: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function badgeEstado(estado: string) {
  switch (estado) {
    case 'pagado':
      return <Badge className="bg-green-500 hover:bg-green-600">Pagado</Badge>;
    case 'parcial':
      return <Badge className="bg-yellow-500 hover:bg-yellow-600 text-white">Parcial</Badge>;
    case 'pendiente':
      return <Badge variant="secondary">Pendiente</Badge>;
    case 'cancelado':
      return <Badge variant="destructive">Cancelado</Badge>;
    default:
      return <Badge variant="outline">{estado}</Badge>;
  }
}

// ─── Componente principal ────────────────────────────────────────────────────

export default function AdminVentasCursosGrabadosManagement() {
  // Estado principal
  const [compras, setCompras] = useState<CompraGrabadaWithRelaciones[]>([]);
  const [estudiantes, setEstudiantes] = useState<Profile[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<Profile[]>([]);
  const [cursosGrabados, setCursosGrabados] = useState<CursoGrabado[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Dialogs
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedCompra, setSelectedCompra] = useState<CompraGrabadaWithRelaciones | null>(null);

  // Búsqueda de estudiante en formulario
  const [studentSearch, setStudentSearch] = useState('');
  const [searchType, setSearchType] = useState<'nombre' | 'codigo' | 'dni'>('nombre');
  const [showStudentDropdown, setShowStudentDropdown] = useState(false);

  // Formulario nueva compra
  const [formData, setFormData] = useState({
    estudiante_id: '',
    estudianteNombre: '',
    valor_total: 0,
    moneda: 'PEN',
    observaciones: '',
  });
  const [carrito, setCarrito] = useState<ItemCarrito[]>([]);
  const [cursoSeleccionado, setCursoSeleccionado] = useState('');
  const [savingCompra, setSavingCompra] = useState(false);

  useEffect(() => {
    fetchData();
    getCurrentUser();
  }, []);

  useEffect(() => {
    if (!studentSearch.trim()) {
      setFilteredStudents(estudiantes);
      return;
    }
    const lower = studentSearch.toLowerCase();
    setFilteredStudents(
      estudiantes.filter((s: any) => {
        if (searchType === 'nombre')
          return `${s.first_name} ${s.last_name}`.toLowerCase().includes(lower);
        if (searchType === 'codigo')
          return s.student_code?.toLowerCase().includes(lower);
        return s.document_number?.toLowerCase().includes(lower);
      })
    );
  }, [studentSearch, searchType, estudiantes]);

  const getCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();
      setCurrentUser(profile);
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);

      // Compras con relaciones (items + estudiante)
      const { data: comprasData, error: comprasError } = await supabase
        .from('compra_cursos_grabados' as any)
        .select(`
          *,
          estudiante:profiles!compra_cursos_grabados_estudiante_id_fkey(
            id, first_name, last_name, email, student_code
          ),
          items:venta_cursos_grabados(
            id, codigo_venta, id_clases_grabadas, valor_venta, estado_pago,
            curso_grabado:cursos_grabados(id, name)
          )
        `)
        .order('created_at', { ascending: false });

      if (comprasError) throw comprasError;

      // Estudiantes
      const { data: estudiantesData, error: estudiantesErr } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email, student_code, document_number')
        .eq('role', 'student')
        .order('first_name');

      if (estudiantesErr) throw estudiantesErr;

      // Cursos grabados activos
      const { data: cursosData, error: cursosErr } = await supabase
        .from('cursos_grabados' as any)
        .select('id, name')
        .eq('is_active', true)
        .order('name');

      if (cursosErr) throw cursosErr;

      setCompras((comprasData as any) || []);
      setEstudiantes(estudiantesData || []);
      setFilteredStudents(estudiantesData || []);
      setCursosGrabados((cursosData as any) || []);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: `Error al cargar datos: ${error.message}`,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // ─── Lógica del formulario ────────────────────────────────────────────────

  const handleOpenCreate = () => {
    setFormData({ estudiante_id: '', estudianteNombre: '', valor_total: 0, moneda: 'PEN', observaciones: '' });
    setCarrito([]);
    setCursoSeleccionado('');
    setStudentSearch('');
    setShowStudentDropdown(false);
    setCreateDialogOpen(true);
  };

  const handleSelectEstudiante = (estudiante: Profile) => {
    setFormData(prev => ({
      ...prev,
      estudiante_id: estudiante.id,
      estudianteNombre: `${estudiante.first_name} ${estudiante.last_name}`,
    }));
    setStudentSearch(`${estudiante.first_name} ${estudiante.last_name}`);
    setShowStudentDropdown(false);
  };

  const handleAgregarCurso = () => {
    if (!cursoSeleccionado) return;
    if (carrito.some(item => item.cursoId === cursoSeleccionado)) {
      toast({ title: 'Aviso', description: 'Ese curso ya está en la compra.' });
      return;
    }
    const curso = cursosGrabados.find(c => c.id === cursoSeleccionado);
    if (!curso) return;
    setCarrito(prev => [...prev, { cursoId: curso.id, cursoNombre: curso.name }]);
    setCursoSeleccionado('');
  };

  const handleQuitarCurso = (cursoId: string) => {
    setCarrito(prev => prev.filter(item => item.cursoId !== cursoId));
  };

  const generarCodigoCompra = (): string => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = 'COC-';
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.estudiante_id) {
      toast({ title: 'Error', description: 'Seleccione un estudiante.', variant: 'destructive' });
      return;
    }
    if (carrito.length === 0) {
      toast({ title: 'Error', description: 'Agregue al menos un curso grabado.', variant: 'destructive' });
      return;
    }
    if (formData.valor_total <= 0) {
      toast({ title: 'Error', description: 'El valor total debe ser mayor a 0.', variant: 'destructive' });
      return;
    }
    if (!currentUser?.id) {
      toast({ title: 'Error', description: 'No se pudo identificar el usuario.', variant: 'destructive' });
      return;
    }

    try {
      setSavingCompra(true);

      const codigoCompra = generarCodigoCompra();

      const { data: compraData, error: compraError } = await supabase
        .from('compra_cursos_grabados' as any)
        .insert({
          codigo_compra: codigoCompra,
          estudiante_id: formData.estudiante_id,
          usuario_id: currentUser.id,
          valor_total: formData.valor_total,
          moneda: formData.moneda,
          estado_pago: 'pendiente',
          monto_pagado: 0,
          observaciones: formData.observaciones || null,
        })
        .select('id')
        .single();

      if (compraError) throw compraError;
      const compraId = (compraData as any).id;

      for (const item of carrito) {
        const { data: dup } = await supabase
          .from('venta_cursos_grabados' as any)
          .select('id')
          .eq('estudiante_id', formData.estudiante_id)
          .eq('id_clases_grabadas', item.cursoId)
          .limit(1);

        if ((dup?.length ?? 0) > 0) {
          toast({
            title: 'Aviso',
            description: `El estudiante ya tiene registrada una compra de "${item.cursoNombre}". Se omitió ese curso.`,
          });
          continue;
        }

        await supabase
          .from('venta_cursos_grabados' as any)
          .insert({
            estudiante_id: formData.estudiante_id,
            id_clases_grabadas: item.cursoId,
            valor_venta: 0,
            moneda_venta: formData.moneda,
            usuario_id: currentUser.id,
            matricula_id: null,
            compra_id: compraId,
            estado_pago: 'pendiente',
          });
      }

      toast({ title: 'Éxito', description: `Compra ${codigoCompra} registrada correctamente.` });
      setCreateDialogOpen(false);
      fetchData();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: `Error al registrar compra: ${error.message}`,
        variant: 'destructive',
      });
    } finally {
      setSavingCompra(false);
    }
  };

  const cursosDisponibles = cursosGrabados.filter(
    c => !carrito.some(item => item.cursoId === c.id)
  );



  return (
    <DashboardLayout>
      <div className="container mx-auto py-8 space-y-6">

        {/* ── Encabezado ─────────────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl flex items-center gap-2">
                  <ShoppingCart className="h-6 w-6" />
                  Ventas de Cursos Grabados
                </CardTitle>
                <CardDescription>
                  Registro de compras de cursos grabados — una compra puede incluir múltiples cursos y pagos parciales
                </CardDescription>
              </div>
              <Button onClick={handleOpenCreate}>
                <Plus className="mr-2 h-4 w-4" />
                Nueva Compra
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Cargando...</div>
            ) : compras.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <PackageCheck className="mx-auto h-12 w-12 mb-3 opacity-30" />
                <p>No hay compras registradas aún.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Estudiante</TableHead>
                    <TableHead>Cursos</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Pagado</TableHead>
                    <TableHead className="text-orange-600">Saldo Pendiente</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {compras.map((compra) => {
                    const saldo = compra.valor_total - compra.monto_pagado;
                    return (
                      <TableRow key={compra.id}>
                        <TableCell className="font-mono text-xs font-semibold">
                          {compra.codigo_compra}
                        </TableCell>
                        <TableCell className="font-medium">
                          {compra.estudiante
                            ? `${compra.estudiante.first_name} ${compra.estudiante.last_name}`
                            : '—'}
                          {compra.estudiante?.student_code && (
                            <div className="text-xs text-muted-foreground">
                              {compra.estudiante.student_code}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            {(compra.items ?? []).length === 0 ? (
                              <span className="text-xs text-muted-foreground">Sin items</span>
                            ) : (
                              (compra.items ?? []).map(item => (
                                <Badge key={item.id} variant="outline" className="text-xs">
                                  <BookOpen className="h-3 w-3 mr-1" />
                                  {(item as any).curso_grabado?.name ?? '—'}
                                </Badge>
                              ))
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{formatDate(compra.created_at)}</TableCell>
                        <TableCell className="font-semibold whitespace-nowrap">
                          {compra.moneda} {compra.valor_total.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-green-700 font-medium whitespace-nowrap">
                          {compra.moneda} {compra.monto_pagado.toFixed(2)}
                        </TableCell>
                        <TableCell
                          className={`font-semibold whitespace-nowrap ${
                            saldo > 0 ? 'text-orange-600' : 'text-green-600'
                          }`}
                        >
                          {saldo > 0 ? `${compra.moneda} ${saldo.toFixed(2)}` : '—'}
                        </TableCell>
                        <TableCell>{badgeEstado(compra.estado_pago)}</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedCompra(compra);
                              setDetailDialogOpen(true);
                            }}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            Ver detalle
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* ════════════════════════════════════════════════════════════
            Dialog: NUEVA COMPRA
        ════════════════════════════════════════════════════════════ */}
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                Nueva Compra de Cursos Grabados
              </DialogTitle>
              <DialogDescription>
                Registre una compra con uno o más cursos grabados. El pago puede realizarse en abonos.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-5">

              {/* ── Búsqueda de estudiante ──────────────────────── */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">1. Seleccionar Estudiante</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex gap-2">
                    <Select value={searchType} onValueChange={(v: any) => setSearchType(v)}>
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="nombre">Nombre</SelectItem>
                        <SelectItem value="codigo">Código</SelectItem>
                        <SelectItem value="dni">DNI</SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="relative flex-1">
                      <Input
                        placeholder={`Buscar por ${searchType}...`}
                        value={studentSearch}
                        onChange={e => {
                          setStudentSearch(e.target.value);
                          setShowStudentDropdown(true);
                          if (!e.target.value) {
                            setFormData(prev => ({ ...prev, estudiante_id: '', estudianteNombre: '' }));
                          }
                        }}
                        onFocus={() => setShowStudentDropdown(true)}
                      />
                      {showStudentDropdown && studentSearch && filteredStudents.length > 0 && (
                        <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-52 overflow-auto">
                          {filteredStudents.slice(0, 10).map(est => (
                            <div
                              key={est.id}
                              onClick={() => handleSelectEstudiante(est)}
                              className="px-3 py-2 hover:bg-gray-100 cursor-pointer border-b last:border-b-0"
                            >
                              <div className="font-medium text-sm">
                                {est.first_name} {est.last_name}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {est.student_code && `Cód: ${est.student_code} · `}
                                {est.document_number && `DNI: ${est.document_number}`}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  {formData.estudiante_id && (
                    <p className="text-xs text-green-600 font-medium">
                      ✓ Estudiante seleccionado: {formData.estudianteNombre}
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* ── Cursos en la compra (carrito) ──────────────── */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">2. Cursos a incluir en la compra</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex gap-2">
                    <Select value={cursoSeleccionado} onValueChange={setCursoSeleccionado}>
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Seleccione un curso grabado..." />
                      </SelectTrigger>
                      <SelectContent>
                        {cursosDisponibles.length === 0 ? (
                          <div className="p-2 text-sm text-muted-foreground">No hay más cursos disponibles</div>
                        ) : (
                          cursosDisponibles.map(c => (
                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleAgregarCurso}
                      disabled={!cursoSeleccionado}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Agregar
                    </Button>
                  </div>

                  {carrito.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-2">
                      Seleccione cursos para agregar a la compra
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {carrito.map(item => (
                        <div
                          key={item.cursoId}
                          className="flex items-center justify-between p-2 bg-gray-50 rounded-lg border"
                        >
                          <div className="flex items-center gap-2">
                            <BookOpen className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium">{item.cursoNombre}</span>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleQuitarCurso(item.cursoId)}
                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                      <p className="text-xs text-muted-foreground">
                        {carrito.length} curso{carrito.length !== 1 ? 's' : ''} en la compra
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* ── Precio total y moneda ─────────────────────── */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">3. Precio y condiciones de pago</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label>Moneda *</Label>
                      <Select
                        value={formData.moneda}
                        onValueChange={v => setFormData(prev => ({ ...prev, moneda: v }))}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {MONEDAS.map(m => (
                            <SelectItem key={m} value={m}>{m}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label>Valor Total de la Compra *</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={formData.valor_total || ''}
                        onChange={e =>
                          setFormData(prev => ({
                            ...prev,
                            valor_total: parseFloat(e.target.value) || 0,
                          }))
                        }
                        placeholder="0.00"
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label>Observaciones</Label>
                    <Textarea
                      value={formData.observaciones}
                      onChange={e => setFormData(prev => ({ ...prev, observaciones: e.target.value }))}
                      rows={2}
                      placeholder="Notas internas sobre esta compra..."
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    <CreditCard className="inline h-3 w-3 mr-1" />
                    El pago se registrará desde <strong>Gestión de Pagos</strong> (categoría: Clases Grabadas).
                    Pueden realizarse abonos parciales y el saldo pendiente se calculará automáticamente.
                  </p>
                </CardContent>
              </Card>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCreateDialogOpen(false)}
                  disabled={savingCompra}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={savingCompra}>
                  {savingCompra ? 'Registrando...' : 'Registrar Compra'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* ════════════════════════════════════════════════════════════
            Dialog: DETALLE DE COMPRA
        ════════════════════════════════════════════════════════════ */}
        <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <PackageCheck className="h-5 w-5" />
                Detalle de Compra — {selectedCompra?.codigo_compra}
              </DialogTitle>
              <DialogDescription>Información completa de la compra y estado de pagos</DialogDescription>
            </DialogHeader>

            {selectedCompra && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-muted/40 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground uppercase font-semibold mb-1">Estudiante</p>
                    <p className="font-semibold">
                      {selectedCompra.estudiante?.first_name} {selectedCompra.estudiante?.last_name}
                    </p>
                    {selectedCompra.estudiante?.student_code && (
                      <p className="text-xs text-muted-foreground">{selectedCompra.estudiante.student_code}</p>
                    )}
                  </div>
                  <div className="bg-muted/40 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground uppercase font-semibold mb-1">Fecha</p>
                    <p className="font-medium">{formatDate(selectedCompra.created_at)}</p>
                    <div className="mt-1">{badgeEstado(selectedCompra.estado_pago)}</div>
                  </div>
                </div>

                {/* Resumen financiero */}
                <div className="rounded-lg border overflow-hidden">
                  <div className="grid grid-cols-3 divide-x">
                    <div className="p-3 text-center">
                      <p className="text-xs text-muted-foreground">Total</p>
                      <p className="font-bold text-lg text-primary">
                        {selectedCompra.moneda} {selectedCompra.valor_total.toFixed(2)}
                      </p>
                    </div>
                    <div className="p-3 text-center">
                      <p className="text-xs text-muted-foreground">Pagado</p>
                      <p className="font-bold text-lg text-green-600">
                        {selectedCompra.moneda} {selectedCompra.monto_pagado.toFixed(2)}
                      </p>
                    </div>
                    <div className="p-3 text-center">
                      <p className="text-xs text-muted-foreground">Saldo pendiente</p>
                      {(() => {
                        const saldo = selectedCompra.valor_total - selectedCompra.monto_pagado;
                        return (
                          <p className={`font-bold text-lg ${
                            saldo > 0 ? 'text-orange-600' : 'text-green-600'
                          }`}>
                            {saldo > 0 ? `${selectedCompra.moneda} ${saldo.toFixed(2)}` : '—'}
                          </p>
                        );
                      })()}
                    </div>
                  </div>
                </div>

                {/* Lista de cursos */}
                <div>
                  <p className="text-sm font-semibold mb-2">Cursos incluidos</p>
                  {(selectedCompra.items ?? []).length === 0 ? (
                    <p className="text-sm text-muted-foreground">Sin items registrados</p>
                  ) : (
                    <div className="space-y-2">
                      {(selectedCompra.items ?? []).map(item => (
                        <div
                          key={item.id}
                          className="flex items-center gap-2 p-2 bg-gray-50 rounded border"
                        >
                          <BookOpen className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <span className="text-sm flex-1">
                            {(item as any).curso_grabado?.name ?? '—'}
                          </span>
                          <span className="text-xs font-mono text-muted-foreground">
                            {item.codigo_venta}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {selectedCompra.observaciones && (
                  <div className="bg-muted/40 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground uppercase font-semibold mb-1">Observaciones</p>
                    <p className="text-sm">{selectedCompra.observaciones}</p>
                  </div>
                )}
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setDetailDialogOpen(false)}>Cerrar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </div>
    </DashboardLayout>
  );
}
