import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { formatDate, formatSimpleDate, getTodayInPeru } from '@/lib/dateUtils.ts';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import {
  Pago,
  PagoWithRelations,
  PagoFormData,
  PagoInsert,
  CuotaMatricula,
  MONEDAS,
  METODOS_PAGO,
  TIPOS_PAGO,
  CATEGORIAS_PRODUCTO,
} from '@/integrations/supabase/peri-types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
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
import { toast } from '@/hooks/use-toast';
import { Plus, DollarSign, Filter, Calendar, FileText, Loader2, Pencil } from 'lucide-react';

interface Profile {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
}

interface Course {
  id: string;
  name: string;
  code: string;
}

interface ProductoDisponible {
  codigo: string;
  descripcion: string;
  estudiante_id: string;
  estudiante_nombre: string;
  monto?: number;
  moneda?: string;
  // Para compras de cursos grabados
  monto_pagado?: number;
  compra_id?: string;
}

export default function AdminPagosManagement() {
  const [pagos, setPagos] = useState<PagoWithRelations[]>([]);
  const [students, setStudents] = useState<Profile[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [productosDisponibles, setProductosDisponibles] = useState<ProductoDisponible[]>([]);
  const [loadingProductos, setLoadingProductos] = useState(false);
  const [searchProducto, setSearchProducto] = useState('');
  const [showProductoDropdown, setShowProductoDropdown] = useState(false);
  const [cuotasMatricula, setCuotasMatricula] = useState<CuotaMatricula[]>([]);
  const [cuotaSeleccionada, setCuotaSeleccionada] = useState<string | null>(null);
  const [loadingCuotas, setLoadingCuotas] = useState(false);
  const [matriculaModulosMap, setMatriculaModulosMap] = useState<Map<string, Set<string>>>(new Map());
  const [courseModuloIds, setCourseModuloIds] = useState<Set<string> | null>(null);
  const [loadingCourseFilter, setLoadingCourseFilter] = useState(false);
  const [materialesPorCurso, setMaterialesPorCurso] = useState<Map<string, string>>(new Map());
  const [comprobanteFile, setComprobanteFile] = useState<File | null>(null);
  const [uploadingComprobante, setUploadingComprobante] = useState(false);
  const [editComprobanteDialogOpen, setEditComprobanteDialogOpen] = useState(false);
  const [pagoEditandoComprobante, setPagoEditandoComprobante] = useState<PagoWithRelations | null>(null);
  const [editComprobanteFile, setEditComprobanteFile] = useState<File | null>(null);
  const [uploadingEditComprobante, setUploadingEditComprobante] = useState(false);
  const [recentlyUpdatedPagoId, setRecentlyUpdatedPagoId] = useState<string | null>(null);
  const [metodoPagoPersonalizado, setMetodoPagoPersonalizado] = useState<string>('');
  // Saldo de compra de cursos grabados seleccionada
  const [compraGrabadaInfo, setCompraGrabadaInfo] = useState<{
    compra_id: string;
    codigo_compra: string;
    valor_total: number;
    monto_pagado: number;
    moneda: string;
    cursos: string[];
  } | null>(null);
  
  const [filters, setFilters] = useState({
    categoria: 'all',
    estado: 'all',
    estudiante: 'all',
    curso: 'all',
  });

  const [formData, setFormData] = useState<PagoFormData>({
    categoria_producto: 'matricula',
    codigo_producto: '',
    estudiante_id: '',
    monto_pago: 0,
    fecha_pago: getTodayInPeru(),
    metodo_pago: 'En efectivo',
    moneda_pago: 'PEN',
    estado_pago: 'pago_regular',
    comprobante: '',
    observaciones: '',
  });

  useEffect(() => {
    getCurrentUser();
    fetchPagos();
    fetchStudents();
    fetchCourses();
    fetchMatriculasConModulos();
    fetchMaterialesConCursos();
  }, []);

  // Cuando cambia el filtro de curso, cargar los IDs de módulos reales desde BD
  useEffect(() => {
    if (filters.curso === 'all') {
      setCourseModuloIds(null);
      return;
    }
    const loadModuloIds = async () => {
      setLoadingCourseFilter(true);
      try {
        const { data, error } = await supabase
          .from('modulos' as any)
          .select('id')
          .eq('course_id', filters.curso);
        if (!error && data) {
          setCourseModuloIds(new Set((data as any[]).map(m => m.id)));
        } else {
          setCourseModuloIds(new Set());
        }
      } catch {
        setCourseModuloIds(new Set());
      } finally {
        setLoadingCourseFilter(false);
      }
    };
    loadModuloIds();
  }, [filters.curso]);

  // Resetear estado_pago a 'pago_regular' solo si se cambia a materiales (books/kits)
  useEffect(() => {
    if ((formData.categoria_producto === 'books' || formData.categoria_producto === 'kits') && formData.estado_pago !== 'pago_regular') {
      setFormData(prev => ({ ...prev, estado_pago: 'pago_regular' }));
    }
  }, [formData.categoria_producto]);

  // Cargar cuotas automáticamente cuando se cambia el código de matrícula
  useEffect(() => {
    // Esperar 500ms después del último cambio antes de cargar cuotas
    // Esto evita hacer muchas llamadas mientras el usuario está escribiendo
    const timeoutId = setTimeout(() => {
      if (dialogOpen && formData.categoria_producto === 'matricula' && formData.codigo_producto) {
        fetchCuotasMatricula(formData.codigo_producto);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [formData.codigo_producto, formData.categoria_producto, dialogOpen]);

  useEffect(() => {
    // Cerrar dropdown al hacer clic fuera
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('#codigo_producto') && !target.closest('.producto-dropdown')) {
        setShowProductoDropdown(false);
      }
    };

    if (showProductoDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showProductoDropdown]);

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

  const fetchPagos = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('pagos' as any)
        .select(`
          *,
          estudiante:profiles!pagos_estudiante_id_fkey(id, first_name, last_name, email),
          usuario:profiles!pagos_usuario_id_fkey(id, first_name, last_name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPagos(data as any || []);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: `Error al cargar pagos: ${error.message}`,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchStudents = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email')
        .eq('role', 'student')
        .order('first_name');

      if (error) throw error;
      setStudents(data || []);
    } catch (error: any) {
      console.error('Error fetching students:', error);
    }
  };

  const fetchCourses = async () => {
    try {
      const { data, error } = await supabase
        .from('courses' as any)
        .select('id, name, code')
        .order('name');

      if (error) throw error;
      setCourses((data || []) as Course[]);
    } catch (error: any) {
      console.error('Error fetching courses:', error);
    }
  };

  const fetchMatriculasConModulos = async () => {
    try {
      // Leer modulos_matriculados JSONB directamente desde la tabla matriculas
      // y construir un mapa: cod_matricula -> Set<modulo_id>
      const { data: matriculas, error } = await supabase
        .from('matriculas' as any)
        .select('cod_matricula, modulos_matriculados');

      if (error) throw error;

      const modulosMap = new Map<string, Set<string>>();
      for (const mat of (matriculas || []) as any[]) {
        const modulos: any[] = Array.isArray(mat.modulos_matriculados) ? mat.modulos_matriculados : [];
        const ids = new Set<string>(modulos.map((m: any) => m.modulo_id).filter(Boolean));
        if (ids.size > 0) {
          modulosMap.set(mat.cod_matricula, ids);
        }
      }

      setMatriculaModulosMap(modulosMap);
    } catch (error: any) {
      console.error('Error fetching matriculas con modulos:', error);
    }
  };

  const fetchMaterialesConCursos = async () => {
    try {
      // Obtener todos los materiales registrados con su course_id
      const { data: materiales, error } = await supabase
        .from('registro_compra_materiales')
        .select('codigo_material, course_id');

      if (error) throw error;

      // Crear un mapa: codigo_material -> course_id
      const materialesCursoMap = new Map<string, string>();

      materiales?.forEach((material: any) => {
        if (material.codigo_material && material.course_id) {
          materialesCursoMap.set(material.codigo_material, material.course_id);
        }
      });

      setMaterialesPorCurso(materialesCursoMap);
    } catch (error: any) {
      console.error('Error fetching materiales con cursos:', error);
    }
  };

  const fetchProductosPorCategoria = async (categoria: string) => {
    try {
      setLoadingProductos(true);
      const productos: ProductoDisponible[] = [];

      if (categoria === 'matricula') {
        const { data, error } = await supabase
          .from('matriculas' as any)
          .select(`
            id,
            cod_matricula,
            precio_final,
            moneda_monto,
            estudiante_id,
            estado_pago,
            estudiante:profiles!matriculas_estudiante_id_fkey(id, first_name, last_name)
          `)
          .order('created_at', { ascending: false })
          .limit(500);

        if (error) throw error;
        
        data?.forEach((mat: any) => {
          if (mat.estudiante) {
            productos.push({
              codigo: mat.cod_matricula,
              descripcion: `Matrícula ${mat.cod_matricula}`,
              estudiante_id: mat.estudiante_id,
              estudiante_nombre: `${mat.estudiante.first_name} ${mat.estudiante.last_name}`,
              monto: mat.precio_final,
              moneda: mat.moneda_monto,
            });
          }
        });
        
      } else if (categoria === 'books' || categoria === 'kits') {
        // Filtrar materiales por tipo (book o kit)
        const { data, error } = await supabase
          .from('registro_compra_materiales' as any)
          .select(`
            id,
            codigo_material,
            nombre,
            tipo_material,
            monto,
            estudiante_id,
            estudiante:profiles!registro_compra_materiales_estudiante_id_fkey(id, first_name, last_name),
            course:courses(name)
          `)
          .eq('estado_pago', 'pendiente')
          .eq('tipo_material', categoria === 'books' ? 'book' : 'kit')
          .order('created_at', { ascending: false });

        if (error) throw error;
        
        data?.forEach((mat: any) => {
          if (mat.estudiante) {
            productos.push({
              codigo: mat.codigo_material,
              descripcion: `${mat.nombre} - ${mat.course?.name || 'Sin curso'}`,
              estudiante_id: mat.estudiante_id,
              estudiante_nombre: `${mat.estudiante.first_name} ${mat.estudiante.last_name}`,
              monto: mat.monto,
              moneda: 'PEN',
            });
          }
        });
      } else if (categoria === 'clases_grabadas') {
        // Consultar cabeceras de compra (compra_cursos_grabados) con estado pendiente o parcial
        const { data, error } = await supabase
          .from('compra_cursos_grabados' as any)
          .select(`
            id,
            codigo_compra,
            valor_total,
            monto_pagado,
            moneda,
            estado_pago,
            estudiante_id,
            estudiante:profiles!compra_cursos_grabados_estudiante_id_fkey(id, first_name, last_name),
            items:venta_cursos_grabados(id, curso_grabado:cursos_grabados(name))
          `)
          .in('estado_pago', ['pendiente', 'parcial'])
          .order('created_at', { ascending: false });

        if (error) throw error;
        
        data?.forEach((compra: any) => {
          if (compra.estudiante) {
            const saldo = compra.valor_total - compra.monto_pagado;
            const cursosNombres = (compra.items ?? []).map((it: any) => it.curso_grabado?.name).filter(Boolean).join(', ');
            productos.push({
              codigo: compra.codigo_compra,
              descripcion: cursosNombres || 'Cursos grabados',
              estudiante_id: compra.estudiante_id,
              estudiante_nombre: `${compra.estudiante.first_name} ${compra.estudiante.last_name}`,
              monto: saldo,        // Sugerir el saldo pendiente como monto a pagar
              moneda: compra.moneda,
              monto_pagado: compra.monto_pagado,
              compra_id: compra.id,
            });
          }
        });
      }

      setProductosDisponibles(productos);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: `Error al cargar productos: ${error.message}`,
        variant: 'destructive',
      });
    } finally {
      setLoadingProductos(false);
    }
  };

  const handleCategoriaChange = (categoria: string) => {
    setFormData({ 
      ...formData, 
      categoria_producto: categoria,
      codigo_producto: '',
      estudiante_id: '',
    });
    setCompraGrabadaInfo(null);
    fetchProductosPorCategoria(categoria);
  };

  const handleProductoChange = async (codigo: string) => {
    const producto = productosDisponibles.find(p => p.codigo === codigo);
    if (producto) {
      setFormData({
        ...formData,
        codigo_producto: codigo,
        estudiante_id: producto.estudiante_id,
        monto_pago: producto.monto || formData.monto_pago,
        moneda_pago: (producto.moneda as any) || formData.moneda_pago,
      });
      setSearchProducto(codigo);
      // NOTA: El useEffect se encarga de cargar las cuotas automáticamente para matrículas

      // Para clases grabadas: cargar información de saldo de la compra
      if (formData.categoria_producto === 'clases_grabadas' && producto.compra_id) {
        const { data: compraData } = await supabase
          .from('compra_cursos_grabados' as any)
          .select(`
            id, codigo_compra, valor_total, monto_pagado, moneda,
            items:venta_cursos_grabados(id, curso_grabado:cursos_grabados(name))
          `)
          .eq('id', producto.compra_id)
          .single();

        if (compraData) {
          const cursos = ((compraData as any).items ?? [])
            .map((it: any) => it.curso_grabado?.name)
            .filter(Boolean);
          setCompraGrabadaInfo({
            compra_id: (compraData as any).id,
            codigo_compra: (compraData as any).codigo_compra,
            valor_total: (compraData as any).valor_total,
            monto_pagado: (compraData as any).monto_pagado,
            moneda: (compraData as any).moneda,
            cursos,
          });
        }
      } else if (formData.categoria_producto !== 'clases_grabadas') {
        setCompraGrabadaInfo(null);
      }
    } else {
      setFormData({
        ...formData,
        codigo_producto: codigo,
      });
      setSearchProducto(codigo);
      setCuotasMatricula([]);
      setCuotaSeleccionada(null);
      setCompraGrabadaInfo(null);
    }
    setShowProductoDropdown(false);
  };

  const fetchCuotasMatricula = async (codMatricula: string) => {
    try {
      // No hacer nada si el código está vacío
      if (!codMatricula || codMatricula.trim() === '') {
        setCuotasMatricula([]);
        return;
      }

      setLoadingCuotas(true);

      // Obtener la matrícula
      const { data: matriculaData, error: matriculaError } = await supabase
        .from('matriculas' as any)
        .select('id')
        .eq('cod_matricula', codMatricula)
        .maybeSingle();

      if (matriculaError) {
        setCuotasMatricula([]);
        setLoadingCuotas(false);
        return;
      }
      
      if (!matriculaData) {
        setCuotasMatricula([]);
        setLoadingCuotas(false);
        return;
      }

      // Obtener el plan de cuotas
      const { data: planData, error: planError } = await supabase
        .from('plan_cuotas_matricula' as any)
        .select('id')
        .eq('matricula_id', matriculaData.id)
        .maybeSingle();

      if (planError) {
        setCuotasMatricula([]);
        setLoadingCuotas(false);
        return;
      }

      if (!planData) {
        setCuotasMatricula([]);
        setLoadingCuotas(false);
        return;
      }

      // Obtener las cuotas
      const { data: cuotasData, error: cuotasError } = await supabase
        .from('cuotas_matricula' as any)
        .select('*')
        .eq('plan_cuotas_id', planData.id)
        .order('numero_cuota');

      if (cuotasError) {
        setCuotasMatricula([]);
        setLoadingCuotas(false);
        return;
      }

      setCuotasMatricula(cuotasData || []);
      setLoadingCuotas(false);
      
      // Auto-seleccionar la primera cuota pendiente, parcial o vencida
      const primeraCuotaPendiente = cuotasData?.find(c => c.estado === 'pendiente' || c.estado === 'parcial' || c.estado === 'vencido');
      if (primeraCuotaPendiente) {
        setCuotaSeleccionada(primeraCuotaPendiente.id);
        setFormData(prev => ({ ...prev, monto_pago: primeraCuotaPendiente.monto_cuota - primeraCuotaPendiente.monto_pagado }));
      }
    } catch (error: any) {
      setCuotasMatricula([]);
      setLoadingCuotas(false);
    }
  };

  const handleOpenDialog = () => {
    setFormData({
      categoria_producto: 'matricula',
      codigo_producto: '',
      estudiante_id: '',
      monto_pago: 0,
      fecha_pago: getTodayInPeru(),
      metodo_pago: 'En efectivo',
      moneda_pago: 'PEN',
      estado_pago: 'pago_regular',
      comprobante: '',
      observaciones: '',
    });
    setSearchProducto('');
    setShowProductoDropdown(false);
    setProductosDisponibles([]);
    setCuotasMatricula([]);
    setCuotaSeleccionada(null);
    setComprobanteFile(null);
    setLoadingCuotas(false);
    setMetodoPagoPersonalizado('');
    setCompraGrabadaInfo(null);
    fetchProductosPorCategoria('matricula');
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setCuotasMatricula([]);
    setCuotaSeleccionada(null);
    setComprobanteFile(null);
    setLoadingCuotas(false);
    setMetodoPagoPersonalizado('');
    setCompraGrabadaInfo(null);
  };

  const getPaymentReceiptPathFromUrl = (publicUrl?: string | null) => {
    if (!publicUrl) return null;

    try {
      const url = new URL(publicUrl);
      const marker = '/storage/v1/object/public/payment-receipts/';
      const markerIndex = url.pathname.indexOf(marker);

      if (markerIndex === -1) return null;

      const objectPath = url.pathname.slice(markerIndex + marker.length);
      return decodeURIComponent(objectPath);
    } catch {
      return null;
    }
  };

  const handleOpenEditComprobanteDialog = (pago: PagoWithRelations) => {
    setPagoEditandoComprobante(pago);
    setEditComprobanteFile(null);
    setEditComprobanteDialogOpen(true);
  };

  const handleCloseEditComprobanteDialog = () => {
    setEditComprobanteDialogOpen(false);
    setPagoEditandoComprobante(null);
    setEditComprobanteFile(null);
    setUploadingEditComprobante(false);
  };

  const handleUpdateComprobante = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!pagoEditandoComprobante) {
      toast({
        title: 'Error',
        description: 'No se encontró el pago a editar',
        variant: 'destructive',
      });
      return;
    }

    if (!editComprobanteFile) {
      toast({
        title: 'Error',
        description: 'Debe seleccionar un nuevo comprobante',
        variant: 'destructive',
      });
      return;
    }

    try {
      setUploadingEditComprobante(true);

      const fileExt = editComprobanteFile.name.split('.').pop();
      const fileName = `${Date.now()}_${pagoEditandoComprobante.id}.${fileExt}`;
      const folder = pagoEditandoComprobante.estudiante_id || 'sin_estudiante';
      const newFilePath = `${folder}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('payment-receipts')
        .upload(newFilePath, editComprobanteFile, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('payment-receipts')
        .getPublicUrl(newFilePath);

      const newComprobanteUrl = urlData.publicUrl;

      const { error: updateError } = await supabase
        .from('pagos' as any)
        .update({ comprobante: newComprobanteUrl })
        .eq('id', pagoEditandoComprobante.id);

      if (updateError) throw updateError;

      const oldFilePath = getPaymentReceiptPathFromUrl(pagoEditandoComprobante.comprobante);
      if (oldFilePath && oldFilePath !== newFilePath) {
        const { error: deleteError } = await supabase.storage
          .from('payment-receipts')
          .remove([oldFilePath]);

        if (deleteError) {
          console.warn('No se pudo eliminar el comprobante anterior del bucket:', deleteError.message);
        }
      }

      toast({
        title: 'Éxito',
        description: 'Comprobante actualizado correctamente',
      });

      setRecentlyUpdatedPagoId(pagoEditandoComprobante.id);
      setTimeout(() => setRecentlyUpdatedPagoId(null), 5 * 60 * 1000);

      fetchPagos();
      handleCloseEditComprobanteDialog();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: `Error al actualizar comprobante: ${error.message}`,
        variant: 'destructive',
      });
      setUploadingEditComprobante(false);
    }
  };

  const formatRelativeTime = (dateString?: string | null) => {
    if (!dateString) return '';

    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return '';

    const diffMs = Date.now() - date.getTime();

    if (diffMs < 60_000) return 'hace unos segundos';

    const diffMinutes = Math.floor(diffMs / 60_000);
    if (diffMinutes < 60) return `hace ${diffMinutes} min`;

    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `hace ${diffHours} h`;

    const diffDays = Math.floor(diffHours / 24);
    return `hace ${diffDays} día${diffDays === 1 ? '' : 's'}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.codigo_producto || !formData.monto_pago || !formData.estudiante_id) {
      toast({
        title: 'Error',
        description: 'Complete todos los campos obligatorios (categoría, código, estudiante y monto)',
        variant: 'destructive',
      });
      return;
    }

    // Validar que haya cuotas disponibles para pagar (solo para matrículas)
    if (formData.categoria_producto === 'matricula' && cuotasMatricula.length > 0) {
      const cuotasPagables = cuotasMatricula.filter(c => 
        c.estado === 'pendiente' || c.estado === 'parcial' || c.estado === 'vencido'
      );
      
      if (cuotasPagables.length === 0) {
        toast({
          title: 'Error',
          description: 'Todas las cuotas de esta matrícula ya están pagadas',
          variant: 'destructive',
        });
        return;
      }

      if (!cuotaSeleccionada) {
        toast({
          title: 'Error',
          description: 'Debe seleccionar una cuota para aplicar el pago',
          variant: 'destructive',
        });
        return;
      }

      // Validar que el monto ingresado sea mayor a 0
      if (formData.monto_pago <= 0) {
        toast({
          title: 'Monto inválido',
          description: 'El monto debe ser mayor a 0.',
          variant: 'destructive',
        });
        return;
      }
      // Nota: se permiten pagos parciales (montos menores al saldo de la cuota).
      // La cuota quedará en estado "parcial" y se podrán registrar pagos adicionales
      // hasta completarla.
    }

    if (!comprobanteFile) {
      toast({
        title: 'Error',
        description: 'Debe adjuntar el comprobante de pago',
        variant: 'destructive',
      });
      return;
    }

    if (!currentUser) {
      toast({
        title: 'Error',
        description: 'Usuario no identificado',
        variant: 'destructive',
      });
      return;
    }

    try {
      let comprobanteUrl = formData.comprobante;

      // Si hay un archivo de comprobante, subirlo primero
      if (comprobanteFile) {
        setUploadingComprobante(true);
        const fileExt = comprobanteFile.name.split('.').pop();
        const fileName = `${Date.now()}_${formData.estudiante_id}_${formData.codigo_producto}.${fileExt}`;
        const filePath = `${formData.estudiante_id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('payment-receipts')
          .upload(filePath, comprobanteFile, {
            cacheControl: '3600',
            upsert: false,
          });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('payment-receipts')
          .getPublicUrl(filePath);

        comprobanteUrl = urlData.publicUrl;
        setUploadingComprobante(false);
      }

      const metodoPagoFinal =
        formData.metodo_pago === 'Otros'
          ? metodoPagoPersonalizado.trim() || 'Otros'
          : formData.metodo_pago;

      const pagoData: PagoInsert = {
        ...formData,
        metodo_pago: metodoPagoFinal,
        comprobante: comprobanteUrl,
        usuario_id: currentUser.id,
        estudiante_id: formData.estudiante_id || null,
        cuota_id: cuotaSeleccionada || null,
      };

      const { error } = await supabase
        .from('pagos' as any)
        .insert(pagoData);

      if (error) throw error;

      // Si hay una cuota seleccionada, distribuir el monto entre cuotas desde la seleccionada en adelante
      if (cuotaSeleccionada) {
        // Ordenar cuotas por número para distribuir correctamente el excedente
        const todasCuotas = [...cuotasMatricula].sort((a, b) => a.numero_cuota - b.numero_cuota);
        const idxSeleccionada = todasCuotas.findIndex(c => c.id === cuotaSeleccionada);

        let montoRestante = formData.monto_pago;

        for (let i = idxSeleccionada; i < todasCuotas.length && montoRestante > 0; i++) {
          const cuota = todasCuotas[i];

          // Saltar cuotas ya pagadas completamente
          if (cuota.estado === 'pagado') continue;

          const saldoCuota = Math.round((cuota.monto_cuota - cuota.monto_pagado) * 100) / 100;

          let nuevoMontoPagado: number;
          let nuevoEstado: 'pendiente' | 'pagado' | 'parcial' | 'vencido';

          if (montoRestante >= saldoCuota) {
            // Pago cubre completamente esta cuota; el excedente pasa a la siguiente
            nuevoMontoPagado = cuota.monto_cuota;
            nuevoEstado = 'pagado';
            montoRestante = Math.round((montoRestante - saldoCuota) * 100) / 100;
          } else {
            // Pago parcial: queda debiendo el resto de esta cuota
            nuevoMontoPagado = Math.round((cuota.monto_pagado + montoRestante) * 100) / 100;
            nuevoEstado = 'parcial';
            montoRestante = 0;
          }

          const { error: updateError } = await supabase
            .from('cuotas_matricula' as any)
            .update({
              monto_pagado: nuevoMontoPagado,
              estado: nuevoEstado,
            })
            .eq('id', cuota.id);

          if (updateError) {
            console.error(`Error actualizando cuota ${cuota.numero_cuota}:`, updateError);
          }
        }

        // Verificar si todas las cuotas están pagadas para actualizar el estado de la matrícula
        await verificarYActualizarEstadoMatricula(formData.codigo_producto);
      } else if (formData.categoria_producto === 'matricula') {
        // Si no hay cuota seleccionada (pago único sin plan de cuotas)
        // Verificar el total pagado vs el precio final de la matrícula
        await verificarYActualizarEstadoMatricula(formData.codigo_producto);
      }

      toast({
        title: 'Éxito',
        description: 'Pago registrado correctamente',
      });

      // Si el pago es de clases grabadas: actualizar monto_pagado y estado_pago en compra_cursos_grabados
      if (formData.categoria_producto === 'clases_grabadas' && compraGrabadaInfo) {
        await actualizarSaldoCompraGrabada(compraGrabadaInfo.compra_id, formData.monto_pago);
      }

      handleCloseDialog();
      fetchPagos();
      
      // Recargar materiales si el pago es de tipo material
      if (formData.categoria_producto === 'kits' || formData.categoria_producto === 'books') {
        fetchMaterialesConCursos();
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: `Error al registrar pago: ${error.message}`,
        variant: 'destructive',
      });
    }
  };

  // Actualizar saldo y estado de una compra de cursos grabados tras recibir un pago
  const actualizarSaldoCompraGrabada = async (compraId: string, montoPagado: number) => {
    try {
      // Obtener datos actuales de la compra
      const { data: compraData, error: compraErr } = await supabase
        .from('compra_cursos_grabados' as any)
        .select('valor_total, monto_pagado')
        .eq('id', compraId)
        .single();

      if (compraErr || !compraData) return;

      const nuevoMontoPagado = Math.round(((compraData as any).monto_pagado + montoPagado) * 100) / 100;
      const valorTotal = (compraData as any).valor_total;

      let nuevoEstado: string;
      if (nuevoMontoPagado >= valorTotal) {
        nuevoEstado = 'pagado';
      } else if (nuevoMontoPagado > 0) {
        nuevoEstado = 'parcial';
      } else {
        nuevoEstado = 'pendiente';
      }

      await supabase
        .from('compra_cursos_grabados' as any)
        .update({
          monto_pagado: nuevoMontoPagado,
          estado_pago: nuevoEstado,
        })
        .eq('id', compraId);

      // Si la compra quedó pagada, marcar todos sus items como pagados
      if (nuevoEstado === 'pagado') {
        await supabase
          .from('venta_cursos_grabados' as any)
          .update({ estado_pago: 'pagado' })
          .eq('compra_id', compraId);
      }
    } catch (err: any) {
      console.error('Error actualizando saldo de compra grabada:', err.message);
    }
  };

  // Función para verificar y actualizar el estado de pago de una matrícula
  const verificarYActualizarEstadoMatricula = async (codMatricula: string) => {
    try {
      // Obtener la matrícula
      const { data: matriculaData, error: matriculaError } = await supabase
        .from('matriculas' as any)
        .select('id, precio_final')
        .eq('cod_matricula', codMatricula)
        .single();

      if (matriculaError || !matriculaData) return;

      // Obtener el plan de cuotas
      const { data: planData } = await supabase
        .from('plan_cuotas_matricula' as any)
        .select('id')
        .eq('matricula_id', matriculaData.id)
        .single();

      if (planData) {
        // Tiene plan de cuotas: determinar estado según el estado de las cuotas
        const { data: cuotasData } = await supabase
          .from('cuotas_matricula' as any)
          .select('estado, monto_pagado')
          .eq('plan_cuotas_id', planData.id);

        const todasPagadas = cuotasData?.every(c => c.estado === 'pagado');
        const algunaPagadaOParcial = cuotasData?.some(
          c => c.estado === 'pagado' || c.estado === 'parcial' || (c.monto_pagado ?? 0) > 0
        );

        let nuevoEstado: string;
        if (todasPagadas) {
          nuevoEstado = 'pagado';
        } else if (algunaPagadaOParcial) {
          nuevoEstado = 'parcial';
        } else {
          nuevoEstado = 'pendiente';
        }

        await supabase
          .from('matriculas' as any)
          .update({ estado_pago: nuevoEstado })
          .eq('id', matriculaData.id);
      } else {
        // No tiene plan de cuotas (pago único): verificar el total pagado
        const { data: pagosData } = await supabase
          .from('pagos' as any)
          .select('monto_pago, moneda_pago')
          .eq('codigo_producto', codMatricula)
          .eq('categoria_producto', 'matricula');

        // Sumar todos los pagos de la misma moneda que la matrícula
        const { data: matriculaCompleta } = await supabase
          .from('matriculas' as any)
          .select('moneda_monto')
          .eq('cod_matricula', codMatricula)
          .single();

        const totalPagado = pagosData
          ?.filter(p => p.moneda_pago === matriculaCompleta?.moneda_monto)
          .reduce((sum, p) => sum + p.monto_pago, 0) || 0;

        let nuevoEstado: string;
        if (totalPagado >= matriculaData.precio_final) {
          nuevoEstado = 'pagado';
        } else if (totalPagado > 0) {
          nuevoEstado = 'parcial';
        } else {
          nuevoEstado = 'pendiente';
        }

        await supabase
          .from('matriculas' as any)
          .update({ estado_pago: nuevoEstado })
          .eq('id', matriculaData.id);
      }
    } catch (error: any) {
      console.error('Error al verificar estado de matrícula:', error);
    }
  };

  // Filtrar pagos
  const filteredPagos = pagos.filter(pago => {
    if (filters.categoria !== 'all' && pago.categoria_producto !== filters.categoria) return false;
    if (filters.estado !== 'all' && pago.estado_pago !== filters.estado) return false;
    if (filters.estudiante !== 'all' && pago.estudiante_id !== filters.estudiante) return false;
    
    // Filtro por curso
    if (filters.curso !== 'all') {
      if (pago.categoria_producto === 'matricula') {
        // Para matrículas: verificar si alguno de sus modulo_ids pertenece al curso seleccionado
        if (courseModuloIds === null) return false;
        const modulosDeMatricula = matriculaModulosMap.get(pago.codigo_producto);
        if (!modulosDeMatricula || ![...modulosDeMatricula].some(id => courseModuloIds.has(id))) {
          return false;
        }
      } else if (pago.categoria_producto === 'kits' || pago.categoria_producto === 'books') {
        // Para materiales (kits/books): verificar si el material pertenece al curso
        const courseId = materialesPorCurso.get(pago.codigo_producto);
        if (!courseId || courseId !== filters.curso) {
          return false;
        }
      } else {
        // Para otros tipos de pago (clases_grabadas), no mostrar cuando se filtra por curso
        return false;
      }
    }
    
    return true;
  });

  // Estadísticas agrupadas por moneda
  const montosPorMoneda = filteredPagos.reduce((acc, pago) => {
    const moneda = pago.moneda_pago || 'PEN';
    if (!acc[moneda]) {
      acc[moneda] = 0;
    }
    acc[moneda] += pago.monto_pago;
    return acc;
  }, {} as Record<string, number>);

  const totalPEN = montosPorMoneda['PEN'] || 0;
  const totalUSD = montosPorMoneda['USD'] || 0;
  const totalEUR = montosPorMoneda['EUR'] || 0;
  const totalMXN = montosPorMoneda['MXN'] || 0;
  const totalCOP = montosPorMoneda['COP'] || 0;

  return (
    <DashboardLayout>
      <div className="container mx-auto py-8">
        <Card>
          <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl flex items-center gap-2">
                <DollarSign className="h-6 w-6" />
                Gestión de Pagos
              </CardTitle>
              <CardDescription>
                Registro y seguimiento de todos los pagos
              </CardDescription>
            </div>
            <Button onClick={handleOpenDialog}>
              <Plus className="mr-2 h-4 w-4" />
              Registrar Pago
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filtros */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-2 mb-3">
              <Filter className="h-4 w-4" />
              <span className="font-semibold">Filtros</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Categoría</Label>
                <Select
                  value={filters.categoria}
                  onValueChange={(value) =>
                    setFilters({ ...filters, categoria: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {CATEGORIAS_PRODUCTO.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat === 'matricula' ? 'Matrícula' : 
                         cat === 'kits' ? 'Kit' : 
                         cat === 'books' ? 'Book' :
                         'Clases Grabadas'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Estado</Label>
                <Select
                  value={filters.estado}
                  onValueChange={(value) =>
                    setFilters({ ...filters, estado: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {TIPOS_PAGO.map((tipo) => (
                      <SelectItem key={tipo} value={tipo}>
                        {tipo.replace('_', ' ').toUpperCase()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Estudiante</Label>
                <Select
                  value={filters.estudiante}
                  onValueChange={(value) =>
                    setFilters({ ...filters, estudiante: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {students.map((student) => (
                      <SelectItem key={student.id} value={student.id}>
                        {student.first_name} {student.last_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  Curso
                  {loadingCourseFilter && <Loader2 className="h-3 w-3 animate-spin text-gray-400" />}
                </Label>
                <Select
                  value={filters.curso}
                  onValueChange={(value) =>
                    setFilters({ ...filters, curso: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los cursos</SelectItem>
                    {courses.map((course) => (
                      <SelectItem key={course.id} value={course.id}>
                        {course.name} - {course.code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Estadísticas */}
          <div className="grid grid-cols-3 md:grid-cols-6 gap-4 mb-6">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total Pagos</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{filteredPagos.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total (PEN)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold">S/ {totalPEN.toFixed(2)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total (USD)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold">$ {totalUSD.toFixed(2)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total (EUR)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold">€ {totalEUR.toFixed(2)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total (MXN)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold">$ {totalMXN.toFixed(2)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total (COP)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold">$ {totalCOP.toFixed(2)}</div>
              </CardContent>
            </Card>
          </div>

          {/* Tabla de Pagos */}
          {loading ? (
            <div className="text-center py-8">Cargando...</div>
          ) : (
            <div className="w-full overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Código Producto</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead>Estudiante</TableHead>
                  <TableHead>Monto</TableHead>
                  <TableHead>Método</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Comprobante</TableHead>
                  <TableHead>Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPagos.map((pago) => (
                  <TableRow key={pago.id}>
                    <TableCell>
                      {formatDate(pago.fecha_pago)}
                    </TableCell>
                    <TableCell className="font-medium">{pago.codigo_producto}</TableCell>
                    <TableCell>
                      <span
                        className={`px-2 py-1 rounded-full text-xs ${
                          pago.categoria_producto === 'matricula'
                            ? 'bg-blue-100 text-blue-800'
                            : pago.categoria_producto === 'books'
                            ? 'bg-green-100 text-green-800'
                            : pago.categoria_producto === 'kits'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {pago.categoria_producto.toUpperCase()}
                      </span>
                    </TableCell>
                    <TableCell>
                      {pago.estudiante
                        ? `${pago.estudiante.first_name} ${pago.estudiante.last_name}`
                        : '-'}
                    </TableCell>
                    <TableCell className="font-semibold">
                      {pago.moneda_pago} {pago.monto_pago.toFixed(2)}
                    </TableCell>
                    <TableCell>{pago.metodo_pago.toUpperCase()}</TableCell>
                    <TableCell>
                      <span
                        className={`px-2 py-1 rounded-full text-xs ${
                          pago.estado_pago === 'pago_regular'
                            ? 'bg-green-100 text-green-800'
                            : pago.estado_pago === 'primera_cuota'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-orange-100 text-orange-800'
                        }`}
                      >
                        {pago.estado_pago.replace('_', ' ').toUpperCase()}
                      </span>
                    </TableCell>
                    <TableCell>
                      {pago.comprobante ? (
                        <div className="space-y-1">
                          <a
                            href={pago.comprobante}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline flex items-center gap-1"
                          >
                            <FileText className="h-4 w-4" />
                            Ver comprobante
                          </a>
                          <p className={`text-xs ${recentlyUpdatedPagoId === pago.id ? 'text-green-600 font-medium' : 'text-muted-foreground'}`}>
                            Actualizado {formatRelativeTime(pago.updated_at)}
                          </p>
                        </div>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 w-8 p-0 sm:w-auto sm:px-2"
                        onClick={() => handleOpenEditComprobanteDialog(pago)}
                        aria-label={pago.comprobante ? 'Editar comprobante' : 'Subir comprobante'}
                      >
                        <Pencil className="h-3.5 w-3.5 sm:mr-1" />
                        <span className="hidden sm:inline">
                          {pago.comprobante ? 'Editar' : 'Subir'}
                        </span>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog para registrar pago */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Registrar Nuevo Pago
            </DialogTitle>
            <DialogDescription>
              Complete los datos del pago recibido
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Sección 1: Información del Producto */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">1. Información del Producto</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="categoria_producto">Categoría *</Label>
                    <Select
                      value={formData.categoria_producto}
                      onValueChange={handleCategoriaChange}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIAS_PRODUCTO.map((cat) => (
                          <SelectItem key={cat} value={cat}>
                            {cat === 'matricula' ? 'Pago de Matrícula' : 
                             cat === 'kits' ? 'Pago de Kit' : 
                             cat === 'books' ? 'Pago de Book' :
                             'Pago de Clases Grabadas'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="estudiante_id">Estudiante *</Label>
                    <Select
                      value={formData.estudiante_id}
                      onValueChange={(value) =>
                        setFormData({ ...formData, estudiante_id: value })
                      }
                      disabled={!formData.codigo_producto}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Se autocompletará" />
                      </SelectTrigger>
                      <SelectContent>
                        {students.map((student) => (
                          <SelectItem key={student.id} value={student.id}>
                            {student.first_name} {student.last_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {formData.estudiante_id && (
                      <p className="text-xs text-green-600">
                        ✓ Autocompletado del producto
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="codigo_producto">Código del Producto *</Label>
                  {loadingProductos ? (
                    <div className="text-sm text-gray-500 p-2 bg-gray-50 rounded">Cargando productos...</div>
                  ) : (
                    <div className="relative">
                      <Input
                        id="codigo_producto"
                        placeholder="Escriba para buscar código (ej: MAT-2026-00001)..."
                        value={searchProducto}
                        onChange={(e) => {
                          const newValue = e.target.value;
                          setSearchProducto(newValue);
                          setShowProductoDropdown(true);
                          // Actualizar también el código en formData para que se carguen las cuotas automáticamente
                          setFormData(prev => ({ ...prev, codigo_producto: newValue }));
                        }}
                        onFocus={() => setShowProductoDropdown(true)}
                        className="pr-10"
                      />
                      {searchProducto && (
                        <button
                          type="button"
                          onClick={() => {
                            setSearchProducto('');
                            setFormData({ 
                              ...formData, 
                              codigo_producto: '',
                              estudiante_id: '',
                            });
                          }}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          ✕
                        </button>
                      )}
                      
                      {/* Dropdown con resultados filtrados */}
                      {showProductoDropdown && searchProducto && (
                        <div className="producto-dropdown absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-60 overflow-auto">
                          {productosDisponibles
                            .filter(p => 
                              p.codigo.toLowerCase().includes(searchProducto.toLowerCase()) ||
                              p.descripcion.toLowerCase().includes(searchProducto.toLowerCase()) ||
                              p.estudiante_nombre.toLowerCase().includes(searchProducto.toLowerCase())
                            )
                            .slice(0, 10)
                            .map((producto) => (
                              <div
                                key={producto.codigo}
                                onClick={() => handleProductoChange(producto.codigo)}
                                className="px-3 py-2 hover:bg-gray-100 cursor-pointer border-b last:border-b-0"
                              >
                                <div className="flex flex-col">
                                  <span className="font-medium text-sm">{producto.codigo}</span>
                                  <span className="text-xs text-gray-500">
                                    {producto.descripcion}
                                  </span>
                                  <span className="text-xs text-gray-400">
                                    {producto.estudiante_nombre}
                                  </span>
                                  {/* Saldo para compras de cursos grabados */}
                                  {formData.categoria_producto === 'clases_grabadas' && producto.monto !== undefined && (
                                    <span className="text-xs font-semibold text-orange-600">
                                      Saldo pendiente: {producto.moneda} {producto.monto.toFixed(2)}
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))
                          }
                          {productosDisponibles.filter(p => 
                            p.codigo.toLowerCase().includes(searchProducto.toLowerCase()) ||
                            p.descripcion.toLowerCase().includes(searchProducto.toLowerCase()) ||
                            p.estudiante_nombre.toLowerCase().includes(searchProducto.toLowerCase())
                          ).length === 0 && (
                            <div className="px-3 py-4 text-center text-sm text-gray-500">
                              No se encontraron resultados
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  <p className="text-xs text-gray-500">
                    Seleccione la categoría para ver productos disponibles
                  </p>
                  {formData.codigo_producto && (
                    <p className="text-xs text-green-600">
                      ✓ Producto seleccionado: {formData.codigo_producto}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Sección de Cuotas (solo para matrículas) */}
            {formData.categoria_producto === 'matricula' && formData.codigo_producto && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Cuotas de la Matrícula</CardTitle>
                  <CardDescription>
                    {loadingCuotas 
                      ? 'Cargando cuotas...' 
                      : cuotasMatricula.length > 0 
                        ? (() => {
                            const cuotasPagables = cuotasMatricula.filter(c => 
                              c.estado === 'pendiente' || c.estado === 'parcial' || c.estado === 'vencido'
                            );
                            return cuotasPagables.length > 0 
                              ? 'Seleccione la cuota a la que desea aplicar el pago'
                              : '⚠️ Todas las cuotas ya están pagadas';
                          })()
                        : 'No se encontraron cuotas para esta matrícula'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingCuotas ? (
                    <div className="text-sm text-gray-500 p-4 bg-gray-50 rounded text-center">
                      Buscando cuotas...
                    </div>
                  ) : cuotasMatricula.length === 0 ? (
                    <div className="text-sm text-gray-500 p-4 bg-yellow-50 rounded text-center">
                      No hay cuotas registradas para esta matrícula o el código es incorrecto.
                    </div>
                  ) : (() => {
                      const cuotasPagables = cuotasMatricula.filter(c => 
                        c.estado === 'pendiente' || c.estado === 'parcial' || c.estado === 'vencido'
                      );
                      return cuotasPagables.length === 0 ? (
                        <div className="text-sm p-4 bg-green-50 border border-green-200 rounded text-center">
                          <div className="text-green-700 font-medium mb-2">✅ Todas las cuotas pagadas</div>
                          <div className="text-green-600 text-xs">Esta matrícula ha sido completamente pagada.</div>
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-60 overflow-y-auto">
                          {cuotasMatricula.map((cuota) => {
                            const saldoPendiente = cuota.monto_cuota - cuota.monto_pagado;
                            const isSeleccionable = cuota.estado === 'pendiente' || cuota.estado === 'parcial' || cuota.estado === 'vencido';
                            
                            return (
                              <div
                                key={cuota.id}
                                onClick={() => {
                                  if (isSeleccionable) {
                                    setCuotaSeleccionada(cuota.id);
                                    setFormData(prev => ({ ...prev, monto_pago: saldoPendiente }));
                                  }
                                }}
                                className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                                  cuotaSeleccionada === cuota.id
                                    ? 'border-blue-500 bg-blue-50'
                                    : cuota.estado === 'pagado'
                                    ? 'border-green-200 bg-green-50 opacity-60 cursor-not-allowed'
                                    : cuota.estado === 'vencido'
                                    ? 'border-red-200 hover:border-blue-300 hover:bg-gray-50'
                                    : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                                }`}
                              >
                                <div className="flex justify-between items-start">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                      <span className="font-semibold">Cuota {cuota.numero_cuota}</span>
                                      <span className={`text-xs px-2 py-1 rounded-full ${
                                        cuota.estado === 'pagado' ? 'bg-green-100 text-green-700' :
                                        cuota.estado === 'parcial' ? 'bg-yellow-100 text-yellow-700' :
                                        cuota.estado === 'vencido' ? 'bg-red-100 text-red-700' :
                                        'bg-gray-100 text-gray-700'
                                      }`}>
                                        {cuota.estado.toUpperCase()}
                                      </span>
                                    </div>
                                    <div className="text-sm text-gray-600 mt-1">
                                      <div>Vence: {formatSimpleDate(cuota.fecha_vencimiento)}</div>
                                      <div>Monto: {formData.moneda_pago} {cuota.monto_cuota.toFixed(2)}</div>
                                      {cuota.monto_pagado > 0 && (
                                        <div className="text-green-600">
                                          Pagado: {formData.moneda_pago} {cuota.monto_pagado.toFixed(2)}
                                        </div>
                                      )}
                                      {saldoPendiente > 0 && (
                                        <div className="text-orange-600 font-medium">
                                          Saldo: {formData.moneda_pago} {saldoPendiente.toFixed(2)}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  {cuotaSeleccionada === cuota.id && (
                                    <div className="text-blue-600">
                                      ✓
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  {!loadingCuotas && cuotasMatricula.length > 0 && cuotaSeleccionada && (() => {
                    const cuotaAct = cuotasMatricula.find(c => c.id === cuotaSeleccionada);
                    const saldoAct = cuotaAct ? Math.round((cuotaAct.monto_cuota - cuotaAct.monto_pagado) * 100) / 100 : 0;
                    const montoMenor = formData.monto_pago > 0 && formData.monto_pago < saldoAct;
                    return (
                      <div className="mt-3 space-y-1">
                        {montoMenor ? (
                          <p className="text-xs text-yellow-700 font-medium bg-yellow-50 border border-yellow-200 rounded p-2">
                            🔶 Pago parcial: el monto ingresado ({formData.moneda_pago} {formData.monto_pago.toFixed(2)}) es menor al saldo de la cuota ({formData.moneda_pago} {saldoAct.toFixed(2)}). La cuota quedará como <strong>parcialmente pagada</strong> y podrás registrar pagos adicionales hasta completarla.
                          </p>
                        ) : (
                          <p className="text-xs text-green-600">
                            ✓ Cuota seleccionada. Reglas de pago:
                          </p>
                        )}
                        <p className="text-xs text-blue-600">
                          • Si paga <strong>más</strong> del saldo de la cuota seleccionada, el excedente se aplicará automáticamente a las cuotas siguientes.
                        </p>
                        <p className="text-xs text-blue-600">
                          • Si paga <strong>menos</strong> del saldo, la cuota quedará como <strong>parcialmente pagada</strong> (estado: 🔶 PARCIAL).
                        </p>
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>
            )}

            {/* Sección de Saldo — solo para Clases Grabadas */}
            {formData.categoria_producto === 'clases_grabadas' && compraGrabadaInfo && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Saldo de la Compra</CardTitle>
                  <CardDescription>
                    Compra <strong>{compraGrabadaInfo.codigo_compra}</strong> — puede realizar abonos parciales
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Cursos incluidos */}
                  {compraGrabadaInfo.cursos.length > 0 && (
                    <div className="text-xs text-muted-foreground">
                      <span className="font-semibold">Cursos:</span>{' '}
                      {compraGrabadaInfo.cursos.join(' · ')}
                    </div>
                  )}
                  {/* Resumen financiero */}
                  <div className="grid grid-cols-3 gap-2 rounded-lg border overflow-hidden">
                    <div className="p-3 text-center bg-muted/20">
                      <p className="text-xs text-muted-foreground mb-1">Total compra</p>
                      <p className="font-bold text-base">
                        {compraGrabadaInfo.moneda} {compraGrabadaInfo.valor_total.toFixed(2)}
                      </p>
                    </div>
                    <div className="p-3 text-center bg-green-50">
                      <p className="text-xs text-muted-foreground mb-1">Ya pagado</p>
                      <p className="font-bold text-base text-green-700">
                        {compraGrabadaInfo.moneda} {compraGrabadaInfo.monto_pagado.toFixed(2)}
                      </p>
                    </div>
                    <div className="p-3 text-center bg-orange-50">
                      <p className="text-xs text-muted-foreground mb-1">Saldo pendiente</p>
                      <p className="font-bold text-base text-orange-600">
                        {compraGrabadaInfo.moneda}{' '}
                        {Math.max(0, compraGrabadaInfo.valor_total - compraGrabadaInfo.monto_pagado).toFixed(2)}
                      </p>
                    </div>
                  </div>
                  {/* Indicación de pago parcial */}
                  {formData.monto_pago > 0 &&
                    formData.monto_pago < (compraGrabadaInfo.valor_total - compraGrabadaInfo.monto_pagado) && (
                      <p className="text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 rounded p-2">
                        🔶 <strong>Abono parcial:</strong> el monto ingresado ({compraGrabadaInfo.moneda}{' '}
                        {formData.monto_pago.toFixed(2)}) es menor al saldo pendiente. La compra quedará como{' '}
                        <strong>parcialmente pagada</strong> y podrá registrar más abonos.
                      </p>
                    )}
                  {formData.monto_pago > 0 &&
                    formData.monto_pago >= (compraGrabadaInfo.valor_total - compraGrabadaInfo.monto_pagado) &&
                    compraGrabadaInfo.monto_pagado < compraGrabadaInfo.valor_total && (
                      <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded p-2">
                        ✅ Este pago cubrirá el saldo pendiente. La compra quedará como <strong>pagada</strong>.
                      </p>
                    )}
                </CardContent>
              </Card>
            )}

            {/* Sección 2: Detalles del Pago */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">2. Detalles del Pago</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="monto_pago">Monto *</Label>
                    <Input
                      id="monto_pago"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.monto_pago}
                      onChange={(e) =>
                        setFormData({ ...formData, monto_pago: parseFloat(e.target.value) || 0 })
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="moneda_pago">Moneda *</Label>
                    <Select
                      value={formData.moneda_pago}
                      onValueChange={(value: any) =>
                        setFormData({ ...formData, moneda_pago: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MONEDAS.map((moneda) => (
                          <SelectItem key={moneda} value={moneda}>
                            {moneda}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fecha_pago">Fecha *</Label>
                    <Input
                      id="fecha_pago"
                      type="date"
                      value={formData.fecha_pago}
                      onChange={(e) =>
                        setFormData({ ...formData, fecha_pago: e.target.value })
                      }
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="metodo_pago">Método de Pago *</Label>
                    <Select
                      value={formData.metodo_pago}
                      onValueChange={(value: any) => {
                        setFormData({ ...formData, metodo_pago: value });
                        if (value !== 'Otros') setMetodoPagoPersonalizado('');
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {METODOS_PAGO.map((metodo) => (
                          <SelectItem key={metodo} value={metodo}>
                            {metodo.charAt(0).toUpperCase() + metodo.slice(1)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {formData.metodo_pago === 'Otros' && (
                      <Input
                        id="metodo_pago_personalizado"
                        placeholder="Especifique el método de pago..."
                        value={metodoPagoPersonalizado}
                        onChange={(e) => setMetodoPagoPersonalizado(e.target.value)}
                        required
                      />
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="estado_pago">Estado del Pago *</Label>
                    <Select
                      value={formData.estado_pago}
                      onValueChange={(value: any) =>
                        setFormData({ ...formData, estado_pago: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {formData.categoria_producto === 'matricula' || formData.categoria_producto === 'clases_grabadas' ? (
                          // Para matrículas y cursos grabados: mostrar todas las opciones de pago
                          TIPOS_PAGO.map((tipo) => (
                            <SelectItem key={tipo} value={tipo}>
                              {tipo.replace('_', ' ').charAt(0).toUpperCase() + tipo.replace('_', ' ').slice(1)}
                            </SelectItem>
                          ))
                        ) : (
                          // Para materiales (books/kits): solo pago regular
                          <SelectItem value="pago_regular">Pago Regular</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                    {(formData.categoria_producto === 'books' || formData.categoria_producto === 'kits') && (
                      <p className="text-xs text-muted-foreground">
                        Los materiales (books/kits) solo admiten pago regular.
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Sección 3: Información Adicional */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">3. Información Adicional</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="comprobante">Archivo de Comprobante <span className="text-destructive">*</span></Label>
                  <Input
                    id="comprobante"
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      setComprobanteFile(file || null);
                    }}
                    disabled={uploadingComprobante}
                    required
                  />
                  {comprobanteFile && (
                    <p className="text-xs text-muted-foreground">
                      Archivo seleccionado: {comprobanteFile.name}
                    </p>
                  )}
                  {uploadingComprobante && (
                    <p className="text-xs text-blue-600">
                      Subiendo comprobante...
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="observaciones">Observaciones</Label>
                  <Textarea
                    id="observaciones"
                    value={formData.observaciones}
                    onChange={(e) =>
                      setFormData({ ...formData, observaciones: e.target.value })
                    }
                    rows={3}
                    placeholder="Notas adicionales sobre el pago..."
                  />
                </div>
              </CardContent>
            </Card>

            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={handleCloseDialog} disabled={uploadingComprobante}>
                Cancelar
              </Button>
              <Button 
                type="submit" 
                disabled={
                  uploadingComprobante || 
                  (formData.categoria_producto === 'matricula' && 
                   cuotasMatricula.length > 0 && 
                   cuotasMatricula.filter(c => c.estado === 'pendiente' || c.estado === 'parcial' || c.estado === 'vencido').length === 0)
                }
              >
                <DollarSign className="mr-2 h-4 w-4" />
                {uploadingComprobante ? 'Subiendo...' : 'Registrar Pago'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={editComprobanteDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            handleCloseEditComprobanteDialog();
            return;
          }
          setEditComprobanteDialogOpen(true);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <Pencil className="h-5 w-5" />
              Editar Comprobante
            </DialogTitle>
            <DialogDescription>
              Reemplace el comprobante del pago seleccionado. El cambio se reflejará en la base de datos y en el bucket.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleUpdateComprobante} className="space-y-4">
            <div className="space-y-2">
              <Label>Código de pago</Label>
              <Input value={pagoEditandoComprobante?.codigo_producto || ''} disabled />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit_comprobante">Nuevo comprobante <span className="text-destructive">*</span></Label>
              <Input
                id="edit_comprobante"
                type="file"
                accept="image/*,.pdf"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  setEditComprobanteFile(file || null);
                }}
                disabled={uploadingEditComprobante}
                required
              />
              {editComprobanteFile && (
                <p className="text-xs text-muted-foreground">
                  Archivo seleccionado: {editComprobanteFile.name}
                </p>
              )}
            </div>

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleCloseEditComprobanteDialog}
                disabled={uploadingEditComprobante}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={uploadingEditComprobante || !editComprobanteFile}>
                {uploadingEditComprobante ? 'Actualizando...' : 'Guardar comprobante'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
    </DashboardLayout>
  );
}
