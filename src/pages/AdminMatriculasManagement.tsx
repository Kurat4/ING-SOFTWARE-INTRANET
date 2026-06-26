import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { formatDate, formatDateTime, formatSimpleDate } from '@/lib/dateUtils.ts';
import { MatriculaWithRelations } from '@/integrations/supabase/peri-types';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { Plus, Eye, Search, FileText, DollarSign, Filter, Loader2 } from 'lucide-react';

export default function AdminMatriculasManagement() {
  const navigate = useNavigate();
  const [matriculas, setMatriculas] = useState<MatriculaWithRelations[]>([]);
  const [cursos, setCursos] = useState<Array<{ id: string; name: string; code: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCourseId, setSelectedCourseId] = useState<string>('all');
  const [courseModuloIds, setCourseModuloIds] = useState<Set<string> | null>(null);
  const [loadingCourseFilter, setLoadingCourseFilter] = useState(false);
  const [selectedMatricula, setSelectedMatricula] = useState<MatriculaWithRelations | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [redistribuyendo, setRedistribuyendo] = useState(false);
  const [filterEstadoPago, setFilterEstadoPago] = useState<'all' | 'parcial' | 'pagado'>('all');

  useEffect(() => {
    fetchMatriculas();
    fetchCursos();
  }, []);

  // Cuando cambia el curso seleccionado, cargar los IDs de módulos reales desde BD
  useEffect(() => {
    if (selectedCourseId === 'all') {
      setCourseModuloIds(null);
      return;
    }
    const loadModuloIds = async () => {
      setLoadingCourseFilter(true);
      try {
        const { data, error } = await supabase
          .from('modulos' as any)
          .select('id')
          .eq('course_id', selectedCourseId);
        if (!error && data) {
          const ids = new Set((data as any[]).map(m => m.id));
          setCourseModuloIds(ids);
        } else {
          setCourseModuloIds(new Set());
        }
      } catch (e) {
        setCourseModuloIds(new Set());
      } finally {
        setLoadingCourseFilter(false);
      }
    };
    loadModuloIds();
  }, [selectedCourseId]);

  const redistribuirExcedentes = async (cuotas: any[]) => {
    if (!cuotas || cuotas.length === 0) return;
    setRedistribuyendo(true);
    try {
      // Ordenar cuotas por número
      const ordenadas = [...cuotas].sort((a, b) => a.numero_cuota - b.numero_cuota);

      // Acumular excedentes y repartirlos en las cuotas siguientes
      let excedente = 0;
      for (let i = 0; i < ordenadas.length; i++) {
        const c = ordenadas[i];
        let nuevoMontoPagado = Math.round((c.monto_pagado + excedente) * 100) / 100;
        excedente = 0;

        if (nuevoMontoPagado > c.monto_cuota) {
          excedente = Math.round((nuevoMontoPagado - c.monto_cuota) * 100) / 100;
          nuevoMontoPagado = c.monto_cuota;
        }

        let nuevoEstado: string;
        if (nuevoMontoPagado >= c.monto_cuota) {
          nuevoEstado = 'pagado';
        } else if (nuevoMontoPagado > 0) {
          nuevoEstado = 'parcial';
        } else {
          nuevoEstado = c.estado === 'vencido' ? 'vencido' : 'pendiente';
        }

        if (nuevoMontoPagado !== c.monto_pagado || nuevoEstado !== c.estado) {
          const { error } = await supabase
            .from('cuotas_matricula' as any)
            .update({ monto_pagado: nuevoMontoPagado, estado: nuevoEstado })
            .eq('id', c.id);
          if (error) throw error;
        }
      }

      toast({ title: 'Excedentes redistribuidos', description: 'Las cuotas han sido corregidas correctamente.' });
      await fetchMatriculas();
      // Actualizar selectedMatricula con datos frescos
      setDetailDialogOpen(false);
    } catch (err: any) {
      toast({ title: 'Error', description: `No se pudo redistribuir: ${err.message}`, variant: 'destructive' });
    } finally {
      setRedistribuyendo(false);
    }
  };

  const fetchMatriculas = async () => {
    try {
      setLoading(true);
      
      // Cargar matrículas
      const { data: matriculasData, error: matriculasError } = await supabase
        .from('matriculas' as any)
        .select(`
          *,
          estudiante:profiles!matriculas_estudiante_id_fkey(id, first_name, last_name, email),
          usuario:profiles!matriculas_usuario_id_fkey(id, first_name, last_name),
          curso_grabado:cursos_grabados(id, name)
        `)
        .order('created_at', { ascending: false});

      if (matriculasError) throw matriculasError;

      // Cargar pagos relacionados
      const { data: pagosData } = await supabase
        .from('pagos' as any)
        .select('*')
        .eq('categoria_producto', 'matricula');

      // Cargar planes de cuotas
      const { data: planesData } = await supabase
        .from('plan_cuotas_matricula' as any)
        .select('*');

      // Cargar cuotas individuales
      const { data: cuotasData } = await supabase
        .from('cuotas_matricula' as any)
        .select('*');

      // Asociar pagos, plan de cuotas y cuotas con matrículas
      const matriculasConDatos = (matriculasData || []).map((mat: any) => {
        const plan = planesData?.find((p: any) => p.matricula_id === mat.id);
        const cuotas = plan ? (cuotasData || []).filter((c: any) => c.plan_cuotas_id === plan.id) : [];
        
        return {
          ...mat,
          pagos: (pagosData || []).filter((pago: any) => pago.codigo_producto === mat.cod_matricula),
          plan_cuotas: plan || null,
          cuotas: cuotas
        };
      });

      setMatriculas(matriculasConDatos as any);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: `Error al cargar matrículas: ${error.message}`,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchCursos = async () => {
    try {
      const { data, error } = await supabase
        .from('courses' as any)
        .select('id, name, code')
        .order('name');

      if (error) throw error;
      setCursos(data || []);
    } catch (error: any) {
      console.error('Error al cargar cursos:', error);
    }
  };

  const handleViewDetail = (matricula: MatriculaWithRelations) => {
    setSelectedMatricula(matricula);
    setDetailDialogOpen(true);
  };

  const handleNewMatricula = () => {
    navigate('/admin/matriculas/nueva');
  };

  // Función auxiliar para calcular el estado efectivo de pago de una matrícula
  const calcularEstadoPagoEfectivo = (mat: MatriculaWithRelations): string => {
    // Si tiene estado_pago en DB, usarlo
    const estadoDB = (mat as any).estado_pago as string | null | undefined;
    if (estadoDB && estadoDB !== 'pendiente') return estadoDB;

    // Calcular desde pagos y cuotas
    const monedaMatricula = mat.moneda_monto || 'PEN';
    const totalPagado = mat.pagos
      ?.filter((p: any) => p.moneda_pago === monedaMatricula)
      .reduce((sum: number, p: any) => sum + p.monto_pago, 0) || 0;

    const cuotas: any[] = (mat as any).cuotas || [];
    if (cuotas.length > 0) {
      const todasPagadas = cuotas.every((c: any) => c.estado === 'pagado');
      const algunaPagadaOParcial = cuotas.some(
        (c: any) => c.estado === 'pagado' || c.estado === 'parcial' || (c.monto_pagado ?? 0) > 0
      );
      if (todasPagadas) return 'pagado';
      if (algunaPagadaOParcial) return 'parcial';
      return estadoDB || 'pendiente';
    }

    // Sin plan de cuotas: basado en monto total
    if (totalPagado >= mat.precio_final) return 'pagado';
    if (totalPagado > 0) return 'parcial';
    return estadoDB || 'pendiente';
  };

  // Filtrar matrículas por búsqueda, curso y estado de pago
  // courseModuloIds contiene los IDs reales de módulos del curso seleccionado (cargados desde BD)
  const filteredMatriculas = matriculas.filter(mat => {
    // Filtro por búsqueda
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = (
      mat.cod_matricula.toLowerCase().includes(searchLower) ||
      mat.estudiante?.first_name.toLowerCase().includes(searchLower) ||
      mat.estudiante?.last_name.toLowerCase().includes(searchLower) ||
      mat.estudiante?.email.toLowerCase().includes(searchLower)
    );

    // Filtro por curso: compara modulo_id de cada módulo matriculado
    // contra los IDs reales de módulos del curso (obtenidos de la tabla modulos)
    const matchesCourse = selectedCourseId === 'all' ||
      (courseModuloIds !== null && (mat.modulos_matriculados as any[])?.some(
        (modulo: any) => courseModuloIds.has(modulo.modulo_id)
      ));

    // Filtro por estado de pago
    const matchesEstado = filterEstadoPago === 'all' ||
      calcularEstadoPagoEfectivo(mat) === filterEstadoPago;

    return matchesSearch && matchesCourse && matchesEstado;
  });

  // Calcular totales por moneda
  const totalMatriculas = filteredMatriculas.length;
  
  // Agrupar ingresos por moneda
  const ingresosPorMoneda = filteredMatriculas.reduce((acc, mat) => {
    const moneda = mat.moneda_monto || 'PEN';
    acc[moneda] = (acc[moneda] || 0) + mat.precio_final;
    return acc;
  }, {} as Record<string, number>);
  
  // Agrupar pagos por moneda
  const pagadoPorMoneda = filteredMatriculas.reduce((acc, mat) => {
    const pagos = mat.pagos || [];
    pagos.forEach(p => {
      const moneda = p.moneda_pago || 'PEN';
      acc[moneda] = (acc[moneda] || 0) + p.monto_pago;
    });
    return acc;
  }, {} as Record<string, number>);
  
  // Calcular pendiente por moneda
  const pendientePorMoneda = Object.keys(ingresosPorMoneda).reduce((acc, moneda) => {
    const ingreso = ingresosPorMoneda[moneda] || 0;
    const pagado = pagadoPorMoneda[moneda] || 0;
    acc[moneda] = ingreso - pagado;
    return acc;
  }, {} as Record<string, number>);

  return (
    <DashboardLayout>
      <div className="container mx-auto py-8">
        <Card>
          <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl flex items-center gap-2">
                <FileText className="h-6 w-6" />
                Gestión de Matrículas
              </CardTitle>
              <CardDescription>
                Listado y seguimiento de todas las matrículas registradas
              </CardDescription>
            </div>
            <Button onClick={handleNewMatricula}>
              <Plus className="mr-2 h-4 w-4" />
              Nueva Matrícula
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Buscador y Filtros */}
          <div className="mb-6 space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 flex-1">
                <Search className="h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Buscar por código, nombre o email del estudiante..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="max-w-md"
                />
              </div>
              <div className="flex items-center gap-2 min-w-[250px]">
                <Filter className="h-4 w-4 text-gray-400" />
                <Select value={selectedCourseId} onValueChange={setSelectedCourseId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Filtrar por curso" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los cursos</SelectItem>
                    {cursos.map((curso) => (
                      <SelectItem key={curso.id} value={curso.id}>
                        {curso.name} ({curso.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {loadingCourseFilter && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
              </div>
              <div className="flex items-center gap-2 min-w-[220px]">
                <DollarSign className="h-4 w-4 text-gray-400" />
                <Select value={filterEstadoPago} onValueChange={(v) => setFilterEstadoPago(v as any)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Filtrar por pago" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los estados</SelectItem>
                    <SelectItem value="parcial">🔶 Parcialmente pagado</SelectItem>
                    <SelectItem value="pagado">✅ Pagado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Estadísticas */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total Matrículas</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalMatriculas}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Ingresos Totales</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  {Object.entries(ingresosPorMoneda).map(([moneda, monto]) => (
                    <div key={moneda} className="text-xl font-bold">
                      {moneda} {monto.toFixed(2)}
                    </div>
                  ))}
                  {Object.keys(ingresosPorMoneda).length === 0 && (
                    <div className="text-2xl font-bold">S/ 0.00</div>
                  )}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Pagado</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  {Object.entries(pagadoPorMoneda).map(([moneda, monto]) => (
                    <div key={moneda}>
                      <div className="text-xl font-bold text-green-600">
                        {moneda} {monto.toFixed(2)}
                      </div>
                      {pendientePorMoneda[moneda] > 0 && (
                        <div className="text-xs text-gray-500">
                          Pendiente: {moneda} {pendientePorMoneda[moneda].toFixed(2)}
                        </div>
                      )}
                    </div>
                  ))}
                  {Object.keys(pagadoPorMoneda).length === 0 && (
                    <div className="text-2xl font-bold text-green-600">S/ 0.00</div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tabla de Matrículas */}
          {loading ? (
            <div className="text-center py-8">Cargando...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Estudiante</TableHead>
                  <TableHead>Código Est.</TableHead>
                  <TableHead>Módulos</TableHead>
                  <TableHead>Precio Final</TableHead>
                  <TableHead>Pagado</TableHead>
                  <TableHead>Estado Pago</TableHead>
                  <TableHead>Extras</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMatriculas.map((matricula) => {
                  // Calcular total pagado solo con pagos de la misma moneda que la matrícula
                  const monedaMatricula = matricula.moneda_monto || 'PEN';
                  const totalPagadoMatricula = matricula.pagos
                    ?.filter(p => p.moneda_pago === monedaMatricula)
                    .reduce((sum, p) => sum + p.monto_pago, 0) || 0;
                  const pendiente = matricula.precio_final - totalPagadoMatricula;
                  
                  return (
                    <TableRow key={matricula.id}>
                      <TableCell className="font-medium">
                        {matricula.cod_matricula}
                      </TableCell>
                      <TableCell>
                        {matricula.estudiante
                          ? `${matricula.estudiante.first_name} ${matricula.estudiante.last_name}`
                          : '-'}
                      </TableCell>
                      <TableCell>
                        {matricula.codigo_estudiante || '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {Array.isArray(matricula.modulos_matriculados)
                            ? matricula.modulos_matriculados.length
                            : 0}{' '}
                          módulos
                        </Badge>
                      </TableCell>
                      <TableCell className="font-semibold">
                        {matricula.moneda_monto} {matricula.precio_final.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium text-green-600">
                            {matricula.moneda_monto} {totalPagadoMatricula.toFixed(2)}
                          </span>
                          {pendiente > 0 && (
                            <span className="text-xs text-orange-600">
                              Pend: {matricula.moneda_monto} {pendiente.toFixed(2)}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {(() => {
                          const estado = calcularEstadoPagoEfectivo(matricula);
                          if (estado === 'pagado') return <Badge className="bg-green-100 text-green-800 border-green-300">✅ Pagado</Badge>;
                          if (estado === 'parcial') return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">🔶 Parcial</Badge>;
                          return <Badge className="bg-gray-100 text-gray-700 border-gray-300">⏳ Pendiente</Badge>;
                        })()}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {matricula.book_incluido && (
                            <Badge variant="outline" className="text-xs">
                              📚 Book
                            </Badge>
                          )}
                          {matricula.kit_incluido && (
                            <Badge variant="outline" className="text-xs">
                              🎒 Kit
                            </Badge>
                          )}
                          {matricula.id_clases_grabadas && (
                            <Badge variant="outline" className="text-xs">
                              🎥 Video
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {formatDate(matricula.created_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewDetail(matricula)}
                        >
                          <Eye className="h-4 w-4" />
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

      {/* Dialog de Detalle */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalle de Matrícula</DialogTitle>
            <DialogDescription>
              {selectedMatricula?.cod_matricula}
            </DialogDescription>
          </DialogHeader>

          {selectedMatricula && (
            <div className="space-y-6">

              {/* Ediciones (Cursos) */}
              <div>
                <h3 className="font-semibold mb-2 text-blue-800">📚 Ediciones / Cursos</h3>
                <div className="space-y-2">
                  {(() => {
                    const cursosUnicos = Array.isArray(selectedMatricula.modulos_matriculados)
                      ? (selectedMatricula.modulos_matriculados as any[]).reduce((acc: any[], modulo: any) => {
                          const key = modulo.course_id || modulo.course_name || 'sin-curso';
                          const existe = acc.find((c: any) => c.key === key);
                          if (!existe) {
                            acc.push({
                              key,
                              course_id: modulo.course_id,
                              course_name: modulo.course_name || null,
                              course_code: modulo.course_code,
                              modulos: [modulo]
                            });
                          } else {
                            existe.modulos.push(modulo);
                          }
                          return acc;
                        }, [])
                      : [];
                    if (cursosUnicos.length === 0) {
                      return <p className="text-sm text-gray-500">Sin módulos matriculados</p>;
                    }
                    return cursosUnicos.map((curso: any) => (
                      <div key={curso.key} className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="flex-1">
                            {curso.course_name ? (
                              <>
                                <div className="font-semibold text-base text-blue-900">{curso.course_name}</div>
                                {curso.course_code && <div className="text-xs text-blue-600">Código: {curso.course_code}</div>}
                              </>
                            ) : (
                              <div className="font-semibold text-base text-blue-900 italic">Edición sin nombre registrado</div>
                            )}
                          </div>
                          <Badge variant="secondary">
                            {curso.modulos.length} {curso.modulos.length === 1 ? 'módulo' : 'módulos'}
                          </Badge>
                        </div>
                        <div className="space-y-1">
                          {curso.modulos.map((m: any, i: number) => (
                            <div key={i} className="text-sm text-blue-800">
                              • {m.nombre} {m.code ? `(${m.code})` : ''}
                              {(m.start_date || m.end_date) && (
                                <span className="text-xs text-blue-500 ml-2">{m.start_date} – {m.end_date}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              </div>

              {/* Plan de Cuotas */}
              <div>
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Plan de Cuotas
                </h3>
                {!(selectedMatricula as any).plan_cuotas ? (
                  <p className="text-sm text-gray-500 bg-gray-50 border border-gray-200 rounded-lg p-3">
                    Esta matrícula no tiene un plan de cuotas registrado.
                  </p>
                ) : (
                  <>
                    {/* Resumen del Plan */}
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4 mb-3">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-gray-600 text-xs">Núm. Cuotas</span>
                          <p className="font-bold text-lg text-blue-900">{(selectedMatricula as any).plan_cuotas.numero_cuotas}</p>
                        </div>
                        <div>
                          <span className="text-gray-600 text-xs">Tipo</span>
                          <p className="font-medium text-blue-900 capitalize">
                            {(selectedMatricula as any).plan_cuotas.tipo_plan?.replace(/_/g, ' ')}
                          </p>
                        </div>
                        <div>
                          <span className="text-gray-600 text-xs">Monto por Cuota</span>
                          <p className="font-bold text-lg text-blue-900">
                            {selectedMatricula.moneda_monto} {(selectedMatricula as any).plan_cuotas.monto_por_cuota?.toFixed(2)}
                          </p>
                        </div>
                        <div>
                          <span className="text-gray-600 text-xs">Creado</span>
                          <p className="font-medium text-blue-900">
                            {formatSimpleDate((selectedMatricula as any).plan_cuotas.created_at)}
                          </p>
                        </div>
                      </div>
                    </div>
                    {/* Estadísticas */}
                    {(() => {
                      const cuotas: any[] = (selectedMatricula as any).cuotas || [];
                      const pagadas = cuotas.filter(c => c.estado === 'pagado').length;
                      const parciales = cuotas.filter(c => c.estado === 'parcial').length;
                      const pendientes = cuotas.filter(c => c.estado === 'pendiente').length;
                      const vencidas = cuotas.filter(c => c.estado === 'vencido').length;
                      const totalPagado = cuotas.reduce((s, c) => s + (c.monto_pagado || 0), 0);
                      const totalPendiente = cuotas.reduce((s, c) => s + (c.monto_cuota - c.monto_pagado), 0);
                      return (
                        <>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                              <div className="text-xs text-green-700">✅ Pagadas</div>
                              <div className="font-bold text-2xl text-green-900">{pagadas}</div>
                            </div>
                            {parciales > 0 && (
                              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                                <div className="text-xs text-yellow-700">⚠️ Parciales</div>
                                <div className="font-bold text-2xl text-yellow-900">{parciales}</div>
                              </div>
                            )}
                            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                              <div className="text-xs text-gray-700">⏳ Pendientes</div>
                              <div className="font-bold text-2xl text-gray-900">{pendientes}</div>
                            </div>
                            {vencidas > 0 && (
                              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                                <div className="text-xs text-red-700">🚨 Vencidas</div>
                                <div className="font-bold text-2xl text-red-900">{vencidas}</div>
                              </div>
                            )}
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 col-span-2">
                              <div className="text-xs text-blue-700">💰 Total Pagado</div>
                              <div className="font-bold text-xl text-blue-900">{selectedMatricula.moneda_monto} {totalPagado.toFixed(2)}</div>
                            </div>
                            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 col-span-2">
                              <div className="text-xs text-orange-700">💳 Saldo Pendiente</div>
                              <div className="font-bold text-xl text-orange-900">{selectedMatricula.moneda_monto} {totalPendiente.toFixed(2)}</div>
                            </div>
                          </div>
                          {/* Detalle cuotas */}
                          <div className="border-t pt-3">
                            <h4 className="font-medium text-sm text-gray-700 mb-2">Detalle de Cuotas</h4>
                            {/* Aviso de excedentes sin distribuir */}
                            {cuotas.some((c: any) => c.monto_pagado > c.monto_cuota) && (
                              <div className="mb-3 p-3 bg-amber-50 border border-amber-300 rounded-lg flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-sm font-semibold text-amber-800">⚠️ Hay cuotas con excedente no distribuido</p>
                                  <p className="text-xs text-amber-700 mt-0.5">
                                    Una o más cuotas tienen un monto pagado mayor al monto de la cuota. Esto puede ocurrir por pagos registrados con una versión anterior del sistema. Haz clic en "Redistribuir" para corregirlo automáticamente.
                                  </p>
                                </div>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="shrink-0 border-amber-400 text-amber-800 hover:bg-amber-100"
                                  disabled={redistribuyendo}
                                  onClick={() => redistribuirExcedentes(cuotas)}
                                >
                                  {redistribuyendo ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                                  {redistribuyendo ? 'Corrigiendo...' : 'Redistribuir'}
                                </Button>
                              </div>
                            )}
                            <div className="space-y-2">
                              {cuotas.map((cuota: any) => {
                                const saldo = Math.max(0, cuota.monto_cuota - cuota.monto_pagado);
                                const excedente = Math.max(0, cuota.monto_pagado - cuota.monto_cuota);
                                return (
                                  <div key={cuota.id} className={`p-3 border rounded-lg ${
                                    cuota.estado === 'pagado' ? 'bg-green-50 border-green-200' :
                                    cuota.estado === 'parcial' ? 'bg-yellow-50 border-yellow-200' :
                                    cuota.estado === 'vencido' ? 'bg-red-50 border-red-200' :
                                    'bg-white border-gray-200'
                                  }`}>
                                    <div className="flex justify-between items-start">
                                      <div>
                                        <div className="flex items-center gap-2">
                                          <span className="font-semibold">Cuota {cuota.numero_cuota}</span>
                                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                                            cuota.estado === 'pagado' ? 'bg-green-100 text-green-700' :
                                            cuota.estado === 'parcial' ? 'bg-yellow-100 text-yellow-700' :
                                            cuota.estado === 'vencido' ? 'bg-red-100 text-red-700' :
                                            'bg-gray-100 text-gray-700'
                                          }`}>{cuota.estado?.toUpperCase()}</span>
                                        </div>
                                        <div className="text-sm text-gray-600 mt-1">
                                          <div>Vence: {formatSimpleDate(cuota.fecha_vencimiento)}</div>
                                          <div>Monto: {selectedMatricula.moneda_monto} {cuota.monto_cuota?.toFixed(2)}</div>
                                          {cuota.monto_pagado > 0 && (
                                            <div className="text-green-600">Pagado: {selectedMatricula.moneda_monto} {cuota.monto_pagado?.toFixed(2)}</div>
                                          )}
                                        </div>
                                      </div>
                                      {saldo > 0 && (
                                        <div className="text-right">
                                          <div className="text-xs text-gray-500">Saldo</div>
                                          <div className="font-bold text-orange-600">{selectedMatricula.moneda_monto} {saldo.toFixed(2)}</div>
                                        </div>
                                      )}
                                      {excedente > 0 && (
                                        <div className="text-right">
                                          <div className="text-xs text-amber-600">⚠️ Excedente</div>
                                          <div className="font-bold text-amber-700">{selectedMatricula.moneda_monto} {excedente.toFixed(2)}</div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </>
                      );
                    })()}
                  </>
                )}
              </div>

              {/* Información del Estudiante */}
              <div>
                <h3 className="font-semibold mb-2">Información del Estudiante</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <Label className="text-gray-600">Nombre</Label>
                    <p className="font-medium">
                      {selectedMatricula.estudiante?.first_name}{' '}
                      {selectedMatricula.estudiante?.last_name}
                    </p>
                  </div>
                  <div>
                    <Label className="text-gray-600">Email</Label>
                    <p className="font-medium">{selectedMatricula.estudiante?.email}</p>
                  </div>
                  <div>
                    <Label className="text-gray-600">Código Estudiante</Label>
                    <p className="font-medium">{(selectedMatricula as any).codigo_estudiante || '-'}</p>
                  </div>
                  <div>
                    <Label className="text-gray-600">Registrado por</Label>
                    <p className="font-medium">
                      {selectedMatricula.usuario?.first_name}{' '}
                      {selectedMatricula.usuario?.last_name}
                    </p>
                  </div>
                </div>
              </div>

              {/* Módulos Matriculados */}
              <div>
                <h3 className="font-semibold mb-2">Módulos Matriculados</h3>
                <div className="space-y-2">
                  {Array.isArray(selectedMatricula.modulos_matriculados) &&
                    selectedMatricula.modulos_matriculados.map((modulo: any, idx: number) => (
                      <div key={idx} className="p-3 bg-gray-50 rounded-lg">
                        <div className="font-medium">{modulo.nombre}</div>
                        <div className="text-sm text-gray-600">
                          Código: {modulo.code}
                        </div>
                        {modulo.course_name && (
                          <div className="text-sm text-gray-600">
                            Edición: {modulo.course_name}
                          </div>
                        )}
                        {modulo.start_date && modulo.end_date && (
                          <div className="text-xs text-gray-500">
                            {modulo.start_date} - {modulo.end_date}
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              </div>


              {/* Información Financiera */}
              <div>
                <h3 className="font-semibold mb-2">Información Financiera</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <Label className="text-gray-600">Valor Matrícula</Label>
                    <p className="font-medium">
                      {selectedMatricula.moneda_monto} {selectedMatricula.valor_matricula.toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <Label className="text-gray-600">Descuento</Label>
                    <p className="font-medium text-orange-600">
                      - {selectedMatricula.moneda_monto} {selectedMatricula.descuento.toFixed(2)}
                    </p>
                  </div>
                  {selectedMatricula.id_clases_grabadas && (
                    <div>
                      <Label className="text-gray-600">Clases Grabadas</Label>
                      <p className="font-medium">
                        {selectedMatricula.moneda_monto}{' '}
                        {selectedMatricula.valor_clase_grabada.toFixed(2)}
                      </p>
                      <p className="text-xs text-gray-500">
                        {selectedMatricula.curso_grabado?.name}
                      </p>
                    </div>
                  )}
                  <div>
                    <Label className="text-gray-600">Precio Final</Label>
                    <p className="font-bold text-lg text-blue-600">
                      {selectedMatricula.moneda_monto} {selectedMatricula.precio_final.toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Extras */}
              <div>
                <h3 className="font-semibold mb-2">Extras Incluidos</h3>
                <div className="flex gap-2 flex-wrap">
                  {selectedMatricula.book_incluido && (
                    <Badge>📚 Libro Incluido</Badge>
                  )}
                  {selectedMatricula.kit_incluido && (
                    <Badge>🎒 Kit Incluido</Badge>
                  )}
                  {selectedMatricula.id_clases_grabadas && (
                    <Badge>
                      🎥 Clases Grabadas{selectedMatricula.curso_grabado?.name ? `: ${selectedMatricula.curso_grabado.name}` : ''}
                    </Badge>
                  )}
                  {!selectedMatricula.book_incluido && !selectedMatricula.kit_incluido && !selectedMatricula.id_clases_grabadas && (
                    <span className="text-sm text-gray-500">Sin extras</span>
                  )}
                </div>
              </div>


              {/* Historial de Pagos */}
              <div>
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Historial de Pagos
                </h3>
                {selectedMatricula.pagos && selectedMatricula.pagos.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Monto</TableHead>
                        <TableHead>Método</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Comprobante</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedMatricula.pagos.map((pago: any, idx: number) => (
                        <TableRow key={idx}>
                          <TableCell>
                            {formatDate(pago.fecha_pago)}
                          </TableCell>
                          <TableCell className="font-medium">
                            {selectedMatricula.moneda_monto} {pago.monto_pago.toFixed(2)}
                          </TableCell>
                          <TableCell>{pago.metodo_pago.toUpperCase()}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">
                              {pago.estado_pago.replace('_', ' ').toUpperCase()}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {pago.comprobante ? (
                              <a 
                                href={pago.comprobante} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline text-sm"
                              >
                                Ver
                              </a>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-sm text-gray-500">No hay pagos registrados</p>
                )}
              </div>

              {/* Observaciones */}
              {selectedMatricula.observaciones && (
                <div>
                  <h3 className="font-semibold mb-2">Observaciones</h3>
                  <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded">
                    {selectedMatricula.observaciones}
                  </p>
                </div>
              )}

              {/* Fechas */}
              <div className="text-xs text-gray-500 border-t pt-4">
                <p>Creado: {formatDateTime(selectedMatricula.created_at)}</p>
                <p>Actualizado: {formatDateTime(selectedMatricula.updated_at)}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
    </DashboardLayout>
  );
}
