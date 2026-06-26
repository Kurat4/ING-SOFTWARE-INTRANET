import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { formatDate, formatSimpleDate, getTodayInPeru } from '@/lib/dateUtils.ts';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import {
  MatriculaFormData,
  Modulo,
  ModuloMatriculado,
  CursoGrabado,
  Course,
  CourseEnrollmentInsert,
  RegistroCompraMaterialInsert,
  VentaCursoGrabadoInsert,
  PagoInsert,
  PlanCuotasMatriculaInsert,
  CuotaMatriculaInsert,
  CuotaCalculada,
  generateMatriculaCode,
  calculatePrecioFinal,
  calcularTipoPlanCuotas,
  calcularCuotas,
  validarNumeroCuotasPermitido,
  MONEDAS,
  METODOS_PAGO,
  TIPOS_PAGO,
} from '@/integrations/supabase/peri-types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/hooks/use-toast';
import { Save, UserPlus, DollarSign } from 'lucide-react';

interface Profile {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  student_code?: string;
  document_number?: string;
}

interface ModuloConCurso extends Modulo {
  course?: Course;
}

export default function AdminMatriculaForm() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [students, setStudents] = useState<Profile[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<Profile[]>([]);
  const [studentSearch, setStudentSearch] = useState('');
  const [searchType, setSearchType] = useState<'codigo' | 'dni' | 'codigoMatricula'>('codigo');
  const [showStudentDropdown, setShowStudentDropdown] = useState(false);
  const [courses, setCourses] = useState<Course[]>([]);
  const [modulos, setModulos] = useState<ModuloConCurso[]>([]);
  const [cursosGrabados, setCursosGrabados] = useState<CursoGrabado[]>([]);
  const [selectedModulos, setSelectedModulos] = useState<string[]>([]);
  const [selectedEdicion, setSelectedEdicion] = useState<string>('');
  const [modulosYaMatriculados, setModulosYaMatriculados] = useState<string[]>([]);
  const [modoModuloIndividual, setModoModuloIndividual] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [programCode, setProgramCode] = useState<string>('');
  
  // Estados para sistema de cuotas
  const [numeroCuotas, setNumeroCuotas] = useState<number>(1);
  const [cuotasCalculadas, setCuotasCalculadas] = useState<CuotaCalculada[]>([]);
  const [fechaPrimerPago, setFechaPrimerPago] = useState<string>(getTodayInPeru());

  const [formData, setFormData] = useState<MatriculaFormData>({
    estudiante_id: '',
    student_code: '',
    modulos_seleccionados: [],
    valor_matricula: 0,
    descuento: 0,
    moneda: 'PEN',
    incluir_clases_grabadas: false,
    id_clases_grabadas: undefined,
    valor_clase_grabada: 0,
    book_incluido: false,
    monto_book: 0,
    moneda_book: 'PEN',
    kit_incluido: false,
    monto_kit: 0,
    moneda_kit: 'PEN',
    observaciones: '',
    estado_pago: 'pendiente',
  });

  const [precioFinal, setPrecioFinal] = useState(0);

  useEffect(() => {
    fetchInitialData();
    getCurrentUser();
  }, []);

  useEffect(() => {
    // Calcular precio final cuando cambien los valores
    // IMPORTANTE: Book y Kit NO se suman al precio final de la matrícula
    // Los materiales se gestionan independientemente
    const costoClasesGrabadas = formData.incluir_clases_grabadas ? (formData.valor_clase_grabada || 0) : 0;
    
    const precio = calculatePrecioFinal(
      formData.valor_matricula,
      costoClasesGrabadas,
      formData.descuento
    );
    setPrecioFinal(precio);
  }, [
    formData.valor_matricula, 
    formData.valor_clase_grabada, 
    formData.descuento, 
    formData.incluir_clases_grabadas
  ]);

  useEffect(() => {
    // Obtener código del programa desde el primer módulo seleccionado
    if (selectedModulos.length > 0) {
      const primerModulo = modulos.find(m => m.id === selectedModulos[0]);
      if (primerModulo && primerModulo.course) {
        const { data: programaData } = supabase
          .from('programas')
          .select('code')
          .eq('id', primerModulo.course.program_id)
          .single()
          .then(({ data }) => {
            if (data) {
              setProgramCode(data.code);
            }
          });
      }
    }
  }, [selectedModulos, modulos]);

  useEffect(() => {
    // Recalcular cuotas cuando cambian los parámetros
    if (precioFinal > 0 && numeroCuotas > 0 && fechaPrimerPago) {
      const tipoPlan = calcularTipoPlanCuotas(numeroCuotas, programCode || '');
      
      // Parsear fecha como fecha local, no UTC
      const [year, month, day] = fechaPrimerPago.split('-').map(Number);
      const fechaLocal = new Date(year, month - 1, day);
      
      const cuotas = calcularCuotas(
        precioFinal,
        numeroCuotas,
        fechaLocal,
        tipoPlan
      );
      setCuotasCalculadas(cuotas);
    }
  }, [precioFinal, numeroCuotas, fechaPrimerPago, programCode]);

  useEffect(() => {
    // Filtrar estudiantes según búsqueda
    if (!studentSearch.trim()) {
      setFilteredStudents(students);
      return;
    }

    const searchLower = studentSearch.toLowerCase();
    
    if (searchType === 'codigoMatricula') {
      // Búsqueda por código de matrícula
      fetchStudentsByMatriculaCode(searchLower);
    } else {
      // Búsqueda normal por código de estudiante o DNI
      const filtered = students.filter(student => {
        if (searchType === 'codigo') {
          return student.student_code?.toLowerCase().includes(searchLower);
        } else {
          return student.document_number?.toLowerCase().includes(searchLower);
        }
      });
      setFilteredStudents(filtered);
    }
  }, [studentSearch, searchType, students]);

  // ── Envío de correo de confirmación (no bloquea el flujo principal) ────────
  const sendEnrollmentEmail = async (
    studentId: string,
    codMatricula: string,
    modulosMatriculados: ModuloMatriculado[],
    precioFinal: number,
    moneda: string
  ) => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) return;

      const { data: fnData, error: fnError } = await supabase.functions.invoke(
        'send-enrollment-email',
        {
          body: {
            student_id: studentId,
            cod_matricula: codMatricula,
            modulos_matriculados: modulosMatriculados,
            precio_final: precioFinal,
            moneda,
          },
        }
      );

      if (fnError) {
        console.warn('⚠️ No se pudo enviar el correo de confirmación:', fnError.message);
      } else {
        console.log('✅ Correo de confirmación enviado:', fnData?.message);
        toast({
          title: '📧 Correo enviado',
          description: `Se envió la confirmación de matrícula al estudiante`,
        });
      }
    } catch (err: any) {
      console.warn('⚠️ Error al enviar correo de confirmación:', err.message);
    }
  };

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

  const fetchStudentsByMatriculaCode = async (codMatricula: string) => {
    try {
      // Buscar matrículas que coincidan con el código
      const { data: matriculasData, error } = await supabase
        .from('matriculas' as any)
        .select('estudiante_id, cod_matricula')
        .ilike('cod_matricula', `%${codMatricula}%`);

      if (error) throw error;

      if (matriculasData && matriculasData.length > 0) {
        // Obtener los IDs únicos de estudiantes
        const estudianteIds = [...new Set(matriculasData.map((m: any) => m.estudiante_id))];
        
        // Filtrar estudiantes que tienen esas matrículas
        const filtered = students.filter(student => estudianteIds.includes(student.id));
        setFilteredStudents(filtered);
      } else {
        setFilteredStudents([]);
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: `Error al buscar por código de matrícula: ${error.message}`,
        variant: 'destructive',
      });
      setFilteredStudents([]);
    }
  };

  const fetchInitialData = async () => {
    try {
      // Cargar estudiantes
      const { data: studentsData, error: studentsError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email, student_code, document_number')
        .eq('role', 'student')
        .order('first_name');

      if (studentsError) throw studentsError;
      setStudents(studentsData || []);
      setFilteredStudents(studentsData || []);

      // Cargar ediciones activas
      const { data: coursesData, error: coursesError } = await supabase
        .from('courses')
        .select('*')
        .eq('is_active', true)
        .order('start_date', { ascending: false });

      if (coursesError) throw coursesError;

      // Cargar módulos activos
      const { data: modulosData, error: modulosError } = await supabase
        .from('modulos' as any)
        .select(`
          *,
          course:courses(*)
        `)
        .eq('is_active', true)
        .order('start_date', { ascending: false });

      if (modulosError) throw modulosError;

      // Cargar cursos grabados
      const { data: grabadosData, error: grabadosError } = await supabase
        .from('cursos_grabados')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (grabadosError) throw grabadosError;

      setCourses(coursesData || []);
      setModulos(modulosData || []);
      setCursosGrabados(grabadosData || []);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: `Error al cargar datos: ${error.message}`,
        variant: 'destructive',
      });
    }
  };

  const handleEstudianteChange = async (estudianteId: string) => {
    const student = students.find(s => s.id === estudianteId);
    setFormData({
      ...formData,
      estudiante_id: estudianteId,
      student_code: student?.student_code || '',
    });
    
    // Limpiar selección al cambiar de estudiante
    setSelectedModulos([]);
    setSelectedEdicion('');
    
    // Verificar módulos ya matriculados
    await fetchModulosYaMatriculados(estudianteId);
  };

  const fetchModulosYaMatriculados = async (estudianteId: string) => {
    try {
      const { data: enrollments, error } = await supabase
        .from('course_enrollments')
        .select('modulo_id')
        .eq('student_id', estudianteId)
        .eq('is_active', true);

      if (error) throw error;

      const modulosIds = enrollments?.map(e => e.modulo_id) || [];
      setModulosYaMatriculados(modulosIds);
    } catch (error: any) {
      console.error('Error al verificar módulos matriculados:', error);
      setModulosYaMatriculados([]);
    }
  };

  const handleEdicionChange = (courseId: string) => {
    setSelectedEdicion(courseId);
    setModoModuloIndividual(false);

    if (!courseId) {
      setSelectedModulos([]);
      setFormData(prev => ({ ...prev, modulos_seleccionados: [] }));
      return;
    }

    // Seleccionar automáticamente todos los módulos disponibles de la edición
    const courseModulos = modulos.filter(m => m.course_id === courseId);
    const modulosDisponibles = courseModulos
      .filter(m => !modulosYaMatriculados.includes(m.id))
      .map(m => m.id);

    setSelectedModulos(modulosDisponibles);
    setFormData(prev => ({ ...prev, modulos_seleccionados: modulosDisponibles }));
  };

  const handleToggleModoModuloIndividual = (checked: boolean) => {
    setModoModuloIndividual(checked);
    if (checked) {
      // En modo individual, limpiar la selección para que el usuario elija manualmente
      setSelectedModulos([]);
      setFormData(prev => ({ ...prev, modulos_seleccionados: [] }));
    } else {
      // Volver a seleccionar todos los módulos disponibles
      const courseModulos = modulos.filter(m => m.course_id === selectedEdicion);
      const modulosDisponibles = courseModulos
        .filter(m => !modulosYaMatriculados.includes(m.id))
        .map(m => m.id);
      setSelectedModulos(modulosDisponibles);
      setFormData(prev => ({ ...prev, modulos_seleccionados: modulosDisponibles }));
    }
  };

  const handleToggleModuloIndividual = (moduloId: string, checked: boolean) => {
    const newSelection = checked
      ? [...selectedModulos, moduloId]
      : selectedModulos.filter(id => id !== moduloId);
    setSelectedModulos(newSelection);
    setFormData(prev => ({ ...prev, modulos_seleccionados: newSelection }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.estudiante_id) {
      toast({
        title: 'Error',
        description: 'Debe seleccionar un estudiante',
        variant: 'destructive',
      });
      return;
    }

    if (!selectedEdicion) {
      toast({
        title: 'Error',
        description: 'Debe seleccionar una edición',
        variant: 'destructive',
      });
      return;
    }

    if (selectedModulos.length === 0) {
      toast({
        title: 'Error',
        description: 'La edición seleccionada no tiene módulos disponibles para matricular',
        variant: 'destructive',
      });
      return;
    }

    if (!formData.valor_matricula || formData.valor_matricula <= 0) {
      toast({
        title: 'Error',
        description: 'Debe ingresar un valor de matrícula válido (mayor a 0)',
        variant: 'destructive',
      });
      return;
    }

    if (formData.incluir_clases_grabadas) {
      if (!formData.id_clases_grabadas) {
        toast({
          title: 'Error',
          description: 'Debe seleccionar un curso grabado',
          variant: 'destructive',
        });
        return;
      }
      
      if (!formData.valor_clase_grabada || formData.valor_clase_grabada <= 0) {
        toast({
          title: 'Error',
          description: 'El valor del curso grabado debe ser mayor a 0',
          variant: 'destructive',
        });
        return;
      }
    }

    if (!currentUser) {
      toast({
        title: 'Error',
        description: 'Usuario no identificado',
        variant: 'destructive',
      });
      return;
    }

    let matriculaId: string | null = null;
    
    try {
      setLoading(true);

      // 1. Obtener el último número de matrícula del año
      const currentYear = new Date().getFullYear();
      const { data: lastMatricula } = await supabase
        .from('matriculas' as any)
        .select('cod_matricula')
        .like('cod_matricula', `MAT-${currentYear}-%`)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      let sequential = 1;
      if (lastMatricula) {
        const parts = lastMatricula.cod_matricula.split('-');
        sequential = parseInt(parts[2]) + 1;
      }

      const codMatricula = generateMatriculaCode(currentYear, sequential);

      // 2. Preparar datos de módulos matriculados
      const modulosMatriculados: ModuloMatriculado[] = selectedModulos.map(modId => {
        const modulo = modulos.find(m => m.id === modId)!;
        return {
          modulo_id: modulo.id,
          nombre: modulo.name,
          code: modulo.code,
          course_id: modulo.course_id,
          course_name: modulo.course?.name,
          course_code: modulo.course?.code,
          start_date: modulo.start_date,
          end_date: modulo.end_date,
        };
      });

      // 3. Contar ediciones únicas
      const uniqueCourses = new Set(
        selectedModulos.map(modId => {
          const modulo = modulos.find(m => m.id === modId);
          return modulo?.course_id;
        })
      );

      // 4. Insertar matrícula
      const matriculaData = {
        cod_matricula: codMatricula,
        estudiante_id: formData.estudiante_id,
        codigo_estudiante: formData.student_code,
        usuario_id: currentUser.id,
        modulos_matriculados: modulosMatriculados,
        num_cursos: uniqueCourses.size,
        moneda_monto: formData.moneda,
        valor_matricula: formData.valor_matricula,
        descuento: formData.descuento,
        id_clases_grabadas: formData.incluir_clases_grabadas ? formData.id_clases_grabadas : null,
        valor_clase_grabada: formData.incluir_clases_grabadas ? formData.valor_clase_grabada || 0 : 0,
        book_incluido: formData.book_incluido,
        kit_incluido: formData.kit_incluido,
        precio_final: precioFinal,
        estado_pago: formData.estado_pago,
        observaciones: formData.observaciones,
      };

      const { data: newMatricula, error: matriculaError } = await supabase
        .from('matriculas' as any)
        .insert(matriculaData)
        .select()
        .single();

      if (matriculaError) throw matriculaError;
      
      // Guardar ID para posible rollback
      matriculaId = newMatricula.id;

      try {
        // 5. Crear enrollments para cada módulo
        for (const moduloId of selectedModulos) {
          const enrollmentData: CourseEnrollmentInsert = {
            modulo_id: moduloId,
            student_id: formData.estudiante_id,
            matricula_id: newMatricula.id,
            tipo_estudiante: 'nuevo', // Esto se puede determinar con lógica adicional
            is_active: true,
          };

          const { error: enrollError } = await supabase
            .from('course_enrollments')
            .insert(enrollmentData);

          if (enrollError) throw enrollError;
        }

        // 6. Si incluye clases grabadas como promoción, ya están registradas en la matrícula
        // NO se registra en venta_cursos_grabados porque es parte de la promoción de matrícula
        // Los datos quedan en: matriculas.id_clases_grabadas y matriculas.valor_clase_grabada

        // 7. Registrar compra de materiales
        const courseId = modulos.find(m => m.id === selectedModulos[0])?.course_id;
        if (courseId) {
          // Obtener información del curso para nombre uniforme
          const { data: courseData } = await supabase
            .from('courses')
            .select('name')
            .eq('id', courseId)
            .single();
          
          const courseName = courseData?.name || 'Curso';
          
          // Para books: solo si está incluido y tiene precio
          if (formData.book_incluido && formData.monto_book) {
            const bookData: RegistroCompraMaterialInsert = {
              nombre: `Book - ${courseName}`,
              tipo_material: 'book',
              usuario_id: currentUser.id,
              estudiante_id: formData.estudiante_id,
              course_id: courseId,
              monto: formData.monto_book,
              moneda_material: formData.moneda_book || 'PEN',
              estado_pago: 'pendiente',
              fecha_pago: undefined,
              // fecha_registro usa DEFAULT NOW() de la base de datos
            };

            const { error: bookError } = await supabase
              .from('registro_compra_materiales')
              .insert(bookData);

            if (bookError) throw bookError;
          }

          // Para kits: solo si está incluido y tiene precio
          if (formData.kit_incluido && formData.monto_kit) {
            const kitData: RegistroCompraMaterialInsert = {
              nombre: `Kit - ${courseName}`,
              tipo_material: 'kit',
              usuario_id: currentUser.id,
              estudiante_id: formData.estudiante_id,
              course_id: courseId,
              monto: formData.monto_kit,
              moneda_material: formData.moneda_kit || 'PEN',
              estado_pago: 'pendiente',
              fecha_pago: undefined,
              // fecha_registro usa DEFAULT NOW() de la base de datos
            };

            const { error: kitError } = await supabase
              .from('registro_compra_materiales')
              .insert(kitData);

            if (kitError) throw kitError;
          }
        }

        // 8. Crear plan de cuotas para la matrícula
        if (numeroCuotas > 0 && cuotasCalculadas.length > 0) {
          const tipoPlan = calcularTipoPlanCuotas(numeroCuotas, programCode || '');
          const montoPorCuota = precioFinal / numeroCuotas;

          const planCuotasData: PlanCuotasMatriculaInsert = {
            matricula_id: newMatricula.id,
            numero_cuotas: numeroCuotas,
            tipo_plan: tipoPlan,
            monto_total: precioFinal,
            monto_por_cuota: Math.round(montoPorCuota * 100) / 100,
            fecha_primer_pago: fechaPrimerPago,
          };

          const { data: newPlanCuotas, error: planError } = await supabase
            .from('plan_cuotas_matricula' as any)
            .insert(planCuotasData)
            .select()
            .single();

          if (planError) throw planError;

          // 9. Crear las cuotas individuales
          const cuotasInsert: CuotaMatriculaInsert[] = cuotasCalculadas.map(cuota => ({
            plan_cuotas_id: newPlanCuotas.id,
            numero_cuota: cuota.numero_cuota,
            monto_cuota: cuota.monto_cuota,
            fecha_vencimiento: cuota.fecha_vencimiento,
            estado: 'pendiente',
            monto_pagado: 0,
          }));

          const { error: cuotasError } = await supabase
            .from('cuotas_matricula' as any)
            .insert(cuotasInsert);

          if (cuotasError) throw cuotasError;
        }

      } catch (innerError: any) {
        // Si falla algo después de crear la matrícula, hacer rollback
        if (matriculaId) {
          console.error('Error en transacción, haciendo rollback...', innerError);
          
          // Eliminar enrollments
          await supabase
            .from('course_enrollments')
            .delete()
            .eq('matricula_id', matriculaId);
          
          // NO eliminar ventas de cursos grabados porque ya no se registran en esa tabla
          // cuando son parte de una promoción de matrícula
          
          // Eliminar registros de materiales
          await supabase
            .from('registro_compra_materiales')
            .delete()
            .eq('estudiante_id', formData.estudiante_id)
            .gte('created_at', new Date(Date.now() - 10000).toISOString()); // Últimos 10 segundos
          
          // Eliminar pagos
          await supabase
            .from('pagos' as any)
            .delete()
            .eq('codigo_producto', codMatricula);
          
          // Eliminar la matrícula
          await supabase
            .from('matriculas' as any)
            .delete()
            .eq('id', matriculaId);
        }
        
        throw innerError;
      }

      toast({
        title: 'Éxito',
        description: `Matrícula ${codMatricula} registrada correctamente`,
      });

      // Enviar correo de confirmación al estudiante (no bloquea la navegación)
      sendEnrollmentEmail(
        formData.estudiante_id,
        codMatricula,
        modulosMatriculados,
        precioFinal,
        formData.moneda
      );

      navigate('/admin/matriculas');
    } catch (error: any) {
      toast({
        title: 'Error',
        description: `Error al registrar matrícula: ${error.message}`,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Agrupar módulos por edición
  const modulosPorCurso = courses.map(course => ({
    course,
    modulos: modulos.filter(m => m.course_id === course.id),
  })).filter(group => group.modulos.length > 0);

  return (
    <DashboardLayout>
      <div className="container mx-auto py-8 max-w-6xl">
        <Card>
          <CardHeader>
          <CardTitle className="text-2xl flex items-center gap-2">
            <UserPlus className="h-6 w-6" />
            Nueva Matrícula
          </CardTitle>
          <CardDescription>
            Registre la matrícula de un estudiante en una edición. Los módulos se asignan desde la lista de estudiantes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* 1. DATOS DEL ESTUDIANTE */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">1. Datos del Estudiante</h3>
              
              {/* Búsqueda de estudiante */}
              <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
                <div className="space-y-2">
                  <Label>Buscar por:</Label>
                  <Select value={searchType} onValueChange={(value: any) => setSearchType(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="codigo">Código de Estudiante</SelectItem>
                      <SelectItem value="dni">DNI</SelectItem>
                      <SelectItem value="codigoMatricula">Código de Matrícula</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2 space-y-2">
                  <Label>
                    {searchType === 'codigo' 
                      ? 'Código de Estudiante' 
                      : searchType === 'dni' 
                      ? 'Número de DNI'
                      : 'Código de Matrícula'}
                  </Label>
                  <Input
                    placeholder={
                      searchType === 'codigo' 
                        ? 'Buscar por código de estudiante...' 
                        : searchType === 'dni' 
                        ? 'Buscar por DNI...'
                        : 'Buscar por código de matrícula (ej: MAT-2026-00001)...'
                    }
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                  />
                  {studentSearch && (
                    <p className="text-sm text-gray-500">
                      {filteredStudents.length} estudiante(s) encontrado(s)
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="estudiante_id">Estudiante *</Label>
                  <Select
                    value={formData.estudiante_id}
                    onValueChange={handleEstudianteChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={
                        filteredStudents.length === 0 
                          ? "No se encontraron estudiantes" 
                          : "Seleccione un estudiante"
                      } />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredStudents.map((student) => (
                        <SelectItem key={student.id} value={student.id}>
                          {student.first_name} {student.last_name} - {student.student_code || 'Sin código'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="student_code">Código Estudiante</Label>
                  <Input
                    id="student_code"
                    value={formData.student_code}
                    disabled
                    placeholder="Se completa automáticamente"
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* 2. SELECCIÓN DE EDICIÓN */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">2. Seleccionar Edición *</h3>
              {!formData.estudiante_id && (
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
                  ℹ️ Seleccione primero un estudiante para ver las ediciones disponibles
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="edicion_id">Edición *</Label>
                <Select
                  value={selectedEdicion}
                  onValueChange={handleEdicionChange}
                  disabled={!formData.estudiante_id}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccione una edición" />
                  </SelectTrigger>
                  <SelectContent>
                    {modulosPorCurso.map(({ course }) => (
                      <SelectItem key={course.id} value={course.id}>
                        {course.name} ({course.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Vista previa / selección de módulos de la edición seleccionada */}
              {selectedEdicion && (() => {
                const edicionData = modulosPorCurso.find(g => g.course.id === selectedEdicion);
                if (!edicionData) return null;
                const todosMatriculados = edicionData.modulos.every(m => modulosYaMatriculados.includes(m.id));
                const modulosDisponibles = edicionData.modulos.filter(m => !modulosYaMatriculados.includes(m.id));
                return (
                  <div className="border rounded-lg p-4 space-y-3">
                    {todosMatriculados && (
                      <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                        ⚠️ El estudiante ya está matriculado en todos los módulos de esta edición.
                      </div>
                    )}

                    {/* Toggle: módulo individual */}
                    {!todosMatriculados && (
                      <div className="flex items-center gap-3 px-1">
                        <Switch
                          id="modo_modulo_individual"
                          checked={modoModuloIndividual}
                          onCheckedChange={handleToggleModoModuloIndividual}
                        />
                        <Label htmlFor="modo_modulo_individual" className="cursor-pointer">
                          Matricular sólo módulo(s) específico(s)
                        </Label>
                        {modoModuloIndividual && (
                          <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-0.5">
                            Seleccione los módulos manualmente
                          </span>
                        )}
                      </div>
                    )}

                    {/* Lista de módulos */}
                    <div className="grid grid-cols-2 gap-2">
                      {edicionData.modulos.map((modulo) => {
                        const yaMatriculado = modulosYaMatriculados.includes(modulo.id);
                        const seleccionado = selectedModulos.includes(modulo.id);

                        if (modoModuloIndividual && !yaMatriculado) {
                          // Modo individual: checkboxes interactivos
                          return (
                            <div
                              key={modulo.id}
                              onClick={() => handleToggleModuloIndividual(modulo.id, !seleccionado)}
                              className={`flex items-center gap-2 text-sm p-2 rounded border cursor-pointer transition-colors ${
                                seleccionado
                                  ? 'bg-blue-50 border-blue-300 text-blue-800'
                                  : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                              }`}
                            >
                              <Checkbox
                                checked={seleccionado}
                                onCheckedChange={(checked: boolean) =>
                                  handleToggleModuloIndividual(modulo.id, checked)
                                }
                                onClick={(e: React.MouseEvent) => e.stopPropagation()}
                              />
                              <span className="font-medium">M{modulo.num_modulo}: {modulo.name}</span>
                              <span className="text-xs ml-auto text-gray-400">
                                {formatDate(modulo.start_date)}
                              </span>
                            </div>
                          );
                        }

                        // Modo normal: vista informativa
                        return (
                          <div
                            key={modulo.id}
                            className={`flex items-center gap-2 text-sm p-2 rounded ${
                              yaMatriculado
                                ? 'bg-gray-100 text-gray-400 line-through'
                                : 'bg-green-50 text-green-800'
                            }`}
                          >
                            <span>{yaMatriculado ? '✗' : '✓'}</span>
                            <span>M{modulo.num_modulo}: {modulo.name}</span>
                            <span className="text-xs ml-auto">
                              {yaMatriculado ? 'Ya matriculado' : formatDate(modulo.start_date)}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Resumen */}
                    {!todosMatriculados && (
                      <p className="text-xs text-gray-500">
                        {modoModuloIndividual
                          ? selectedModulos.length === 0
                            ? '⚠️ Seleccione al menos un módulo para continuar.'
                            : `Se matricularán ${selectedModulos.length} módulo(s) seleccionado(s). Para matricular módulos restantes, genere una nueva matrícula.`
                          : `Se matricularán ${selectedModulos.length} módulo(s) disponible(s) de la edición.`
                        }
                      </p>
                    )}
                  </div>
                );
              })()}
            </div>

            <Separator />

            {/* 3. VALORES Y COSTOS */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">3. Valores y Costos</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="moneda">Moneda</Label>
                  <Select
                    value={formData.moneda}
                    onValueChange={(value: any) =>
                      setFormData({ ...formData, moneda: value })
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
                  <Label htmlFor="valor_matricula">Valor Matrícula *</Label>
                  <Input
                    id="valor_matricula"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.valor_matricula}
                    onChange={(e) =>
                      setFormData({ ...formData, valor_matricula: parseFloat(e.target.value) || 0 })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="descuento">Descuento</Label>
                  <Input
                    id="descuento"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.descuento}
                    onChange={(e) =>
                      setFormData({ ...formData, descuento: parseFloat(e.target.value) || 0 })
                    }
                  />
                </div>
              </div>

              {/* Clases Grabadas */}
              <div className="space-y-3 border rounded-lg p-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="incluir_clases_grabadas"
                    checked={formData.incluir_clases_grabadas}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, incluir_clases_grabadas: checked })
                    }
                  />
                  <Label htmlFor="incluir_clases_grabadas">
                    Incluir Clases Grabadas (promoción)
                  </Label>
                </div>

                {formData.incluir_clases_grabadas && (
                  <div className="grid grid-cols-3 gap-4 mt-2">
                    <div className="space-y-2">
                      <Label htmlFor="id_clases_grabadas">Curso Grabado</Label>
                      <Select
                        value={formData.id_clases_grabadas}
                        onValueChange={(value) =>
                          setFormData({ ...formData, id_clases_grabadas: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccione" />
                        </SelectTrigger>
                        <SelectContent>
                          {cursosGrabados.map((curso) => (
                            <SelectItem key={curso.id} value={curso.id}>
                              {curso.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="valor_clase_grabada">
                        Valor <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="valor_clase_grabada"
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={formData.valor_clase_grabada}
                        onChange={(e) =>
                          setFormData({ ...formData, valor_clase_grabada: parseFloat(e.target.value) || 0 })
                        }
                        required
                      />
                      <p className="text-xs text-muted-foreground">
                        El valor del curso grabado es obligatorio
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="moneda_curso_grabado">Moneda</Label>
                      <Select
                        value={formData.moneda}
                        onValueChange={(value: any) =>
                          setFormData({ ...formData, moneda: value })
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
                  </div>
                )}
              </div>

              {/* Materiales */}
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="book_incluido"
                    checked={formData.book_incluido}
                    onCheckedChange={(checked: boolean) =>
                      setFormData({ ...formData, book_incluido: checked })
                    }
                  />
                  <Label htmlFor="book_incluido">Incluye Libro</Label>
                </div>
                
                {formData.book_incluido && (
                  <div className="ml-6 grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="moneda_book">Moneda Book *</Label>
                      <Select
                        value={formData.moneda_book}
                        onValueChange={(value) => setFormData({ ...formData, moneda_book: value })}
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
                      <Label htmlFor="monto_book">Precio Book *</Label>
                      <Input
                        id="monto_book"
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.monto_book || 0}
                        onChange={(e) => setFormData({ ...formData, monto_book: parseFloat(e.target.value) || 0 })}
                        required={formData.book_incluido}
                      />
                    </div>
                  </div>
                )}

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="kit_incluido"
                    checked={formData.kit_incluido}
                    onCheckedChange={(checked: boolean) =>
                      setFormData({ ...formData, kit_incluido: checked })
                    }
                  />
                  <Label htmlFor="kit_incluido">Incluye Kit</Label>
                </div>
                
                {formData.kit_incluido && (
                  <div className="ml-6 grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="moneda_kit">Moneda Kit *</Label>
                      <Select
                        value={formData.moneda_kit}
                        onValueChange={(value) => setFormData({ ...formData, moneda_kit: value })}
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
                      <Label htmlFor="monto_kit">Precio Kit *</Label>
                      <Input
                        id="monto_kit"
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.monto_kit || 0}
                        onChange={(e) => setFormData({ ...formData, monto_kit: parseFloat(e.target.value) || 0 })}
                        required={formData.kit_incluido}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Precio Final */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-semibold">Precio Final de Matrícula:</span>
                  <span className="text-2xl font-bold text-blue-600">
                    {formData.moneda} {precioFinal.toFixed(2)}
                  </span>
                </div>
                <p className="text-xs text-blue-700 mt-2">
                  * Incluye: Valor de matrícula{formData.incluir_clases_grabadas && ' + Clases grabadas'}{formData.descuento > 0 && ' - Descuento'}. Los materiales (Book/Kit) se gestionan independientemente.
                  <br />* La matrícula se registrará con estado de pago <strong>PENDIENTE</strong>.
                </p>
              </div>
            </div>

            <Separator />

            {/* 4. PLAN DE CUOTAS */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Plan de Cuotas</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="numeroCuotas">Número de Cuotas</Label>
                  <Select
                    value={numeroCuotas.toString()}
                    onValueChange={(value) => {
                      const num = parseInt(value);
                      if (validarNumeroCuotasPermitido(num, programCode || '')) {
                        setNumeroCuotas(num);
                      } else {
                        toast({
                          title: 'Número de cuotas no permitido',
                          description: `Para este programa, solo se permiten ${programCode === 'P013' ? '1-12' : '1-4'} cuotas`,
                          variant: 'destructive',
                        });
                      }
                    }}
                  >
                    <SelectTrigger id="numeroCuotas">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Pago Único</SelectItem>
                      <SelectItem value="2">2 Cuotas (Quincenal)</SelectItem>
                      {programCode !== 'P013' && (
                        <>
                          <SelectItem value="3">3 Cuotas (Semanal)</SelectItem>
                          <SelectItem value="4">4 Cuotas (Semanal)</SelectItem>
                        </>
                      )}
                      {programCode === 'P013' && (
                        <>
                          <SelectItem value="3">3 Cuotas (Mensual)</SelectItem>
                          <SelectItem value="4">4 Cuotas (Mensual)</SelectItem>
                          <SelectItem value="5">5 Cuotas (Mensual)</SelectItem>
                          <SelectItem value="6">6 Cuotas (Mensual)</SelectItem>
                          <SelectItem value="7">7 Cuotas (Mensual)</SelectItem>
                          <SelectItem value="8">8 Cuotas (Mensual)</SelectItem>
                          <SelectItem value="9">9 Cuotas (Mensual)</SelectItem>
                          <SelectItem value="10">10 Cuotas (Mensual)</SelectItem>
                          <SelectItem value="11">11 Cuotas (Mensual)</SelectItem>
                          <SelectItem value="12">12 Cuotas (Mensual)</SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {programCode === 'P013' 
                      ? 'Programa P013: Permite pago único, 2 cuotas o hasta 12 cuotas mensuales'
                      : 'Otros programas: Máximo 4 cuotas dentro del primer mes'}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="fechaPrimerPago">Fecha Primer Pago</Label>
                  <Input
                    id="fechaPrimerPago"
                    type="date"
                    value={fechaPrimerPago}
                    onChange={(e) => setFechaPrimerPago(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Fecha de vencimiento de la primera cuota
                  </p>
                </div>
              </div>

              {/* Preview de cuotas */}
              {cuotasCalculadas.length > 0 && (
                <div className="border rounded-lg p-4 bg-gray-50">
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    Calendario de Pagos
                  </h4>
                  <div className="space-y-2">
                    {cuotasCalculadas.map((cuota, index) => (
                      <div
                        key={index}
                        className="flex justify-between items-center p-2 bg-white rounded border"
                      >
                        <div>
                          <span className="font-medium">Cuota {cuota.numero_cuota}</span>
                          <span className="text-xs text-gray-500 ml-2">
                            Vence: {formatSimpleDate(cuota.fecha_vencimiento)}
                          </span>
                        </div>
                        <span className="font-semibold text-blue-600">
                          {formData.moneda} {cuota.monto_cuota.toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 pt-3 border-t">
                    <div className="flex justify-between font-bold">
                      <span>Total:</span>
                      <span className="text-blue-600">
                        {formData.moneda} {precioFinal.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <Separator />

            {/* 5. OBSERVACIONES */}
            <div className="space-y-2">
              <Label htmlFor="observaciones">Observaciones</Label>
              <Textarea
                id="observaciones"
                value={formData.observaciones}
                onChange={(e) =>
                  setFormData({ ...formData, observaciones: e.target.value })
                }
                rows={3}
                placeholder="Notas adicionales sobre la matrícula..."
              />
            </div>

            {/* BOTONES */}
            <div className="flex justify-end gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/admin/matriculas')}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                <Save className="mr-2 h-4 w-4" />
                {loading ? 'Guardando...' : 'Registrar Matrícula'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
    </DashboardLayout>
  );
}
