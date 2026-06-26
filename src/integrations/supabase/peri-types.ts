// =====================================================
// TIPOS TYPESCRIPT: Nuevo modelo de negocio Peri Institute
// =====================================================

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

// ============================================
// TIPOS DE DATOS PRINCIPALES
// ============================================

export interface Programa {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Course {
  id: string;
  name: string;
  description?: string | null;
  code: string; // program_id + "-" + mes corto MAYUS + "-" + año
  program_id: string;
  teacher_principal_id: string;
  academic_year: string;
  semester: string;
  is_active: boolean;
  start_date: string;
  end_date?: string | null;
  numero_modulos: number;
  material: 'book' | 'kit' | 'none';
  created_at: string;
  updated_at: string;
}

export interface Modulo {
  id: string;
  name: string;
  num_modulo: number;
  description?: string | null;
  code: string; // program_id + "-M" + num + "-" + mes + "-" + año
  course_id: string;
  teacher_principal_id: string;
  academic_year: string;
  semester_year: string;
  is_active: boolean;
  start_date: string;
  end_date: string;
  schedule?: ModuloSchedule | null;
  aditional_teachers?: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface ModuloSchedule {
  [dia: string]: string; // { "lunes": "10:00-12:00", "miércoles": "14:00-16:00" }
}

export interface CursoGrabado {
  id: string;
  name: string;
  description?: string | null;
  program_id?: string | null;
  video_url?: string | null;
  duration_hours?: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface RegistroCompraMaterial {
  id: string;
  codigo_material: string; // Código único (MAT-XXXXXX)
  nombre: string;
  tipo_material: 'book' | 'kit';
  usuario_id: string; // Quien registró la compra
  estudiante_id: string;
  course_id: string;
  estado_pago: 'pendiente' | 'pagado' | 'cancelado';
  monto?: number | null;
  moneda_material?: string;
  fecha_registro: string;
  fecha_pago?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Matricula {
  id: string;
  cod_matricula: string; // Código único (ej: MAT-2026-0001)
  estudiante_id: string;
  student_code?: string | null;
  usuario_id: string; // Quien registró la matrícula
  modulos_matriculados: ModuloMatriculado[]; // JSONB
  num_cursos: number;
  moneda_monto: Moneda;
  valor_matricula: number;
  descuento: number;
  id_clases_grabadas?: string | null;
  valor_clase_grabada: number;
  book_incluido: boolean;
  kit_incluido: boolean;
  precio_final: number;
  estado_pago?: 'pendiente' | 'pagado' | 'parcial' | 'cancelado' | null;
  observaciones?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ModuloMatriculado {
  modulo_id: string;
  nombre: string;
  code: string;
  course_id?: string;
  course_name?: string;
  course_code?: string;
  start_date?: string;
  end_date?: string;
}

export interface VentaCursoGrabado {
  id: string;
  codigo_venta: string; // Código único (VCG-XXXXXX)
  estudiante_id: string;
  usuario_id: string;
  id_clases_grabadas: string;
  valor_venta: number;
  moneda_venta?: string;
  matricula_id?: string | null;
  compra_id?: string | null; // FK a compra_cursos_grabados
  estado_pago: 'pendiente' | 'pagado' | 'cancelado';
  created_at: string;
  updated_at: string;
}

/**
 * Cabecera de compra de cursos grabados.
 * Una compra agrupa uno o más VentaCursoGrabado y permite pagos parciales.
 */
export interface CompraGrabada {
  id: string;
  codigo_compra: string; // COC-XXXXXX
  estudiante_id: string;
  usuario_id: string;
  valor_total: number;
  moneda: string;
  estado_pago: 'pendiente' | 'pagado' | 'parcial' | 'cancelado';
  monto_pagado: number;
  observaciones?: string | null;
  created_at: string;
  updated_at: string;
}

export type CompraGrabadaInsert = Omit<CompraGrabada, 'id' | 'created_at' | 'updated_at'>;

export interface CompraGrabadaWithRelaciones extends CompraGrabada {
  estudiante?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    student_code?: string;
  };
  items?: (VentaCursoGrabado & { curso_grabado?: { id: string; name: string } })[];
}

export interface Pago {
  id: string;
  codigo_producto: string; // cod_matricula, id material, id curso grabado
  categoria_producto: 'matricula' | 'kits' | 'books' | 'clases_grabadas';
  comprobante?: string | null;
  monto_pago: number;
  fecha_pago: string;
  metodo_pago: string;
  moneda_pago: Moneda;
  estado_pago: 'primera_cuota' | 'pago_regular' | 'cuotas_restantes';
  usuario_id: string;
  estudiante_id?: string | null;
  cuota_id?: string | null;
  observaciones?: string | null;
  created_at: string;
  updated_at: string;
}

export interface PlanCuotasMatricula {
  id: string;
  matricula_id: string;
  numero_cuotas: number;
  tipo_plan: 'pago_unico' | 'cuotas_mensuales' | 'cuotas_quincenales' | 'cuotas_semanales';
  monto_total: number;
  monto_por_cuota: number;
  fecha_primer_pago: string;
  created_at: string;
  updated_at: string;
}

export interface CuotaMatricula {
  id: string;
  plan_cuotas_id: string;
  numero_cuota: number;
  monto_cuota: number;
  fecha_vencimiento: string;
  estado: 'pendiente' | 'pagado' | 'parcial' | 'vencido';
  monto_pagado: number;
  created_at: string;
  updated_at: string;
}

export interface CourseEnrollment {
  id: string;
  modulo_id: string;
  student_id: string;
  matricula_id?: string | null;
  tipo_estudiante: 'nuevo' | 'antiguo';
  enrolled_at: string;
  is_active: boolean;
  payment_status?: 'pending' | 'verified' | 'blocked';
  payment_verified_by?: string | null;
  payment_verified_at?: string | null;
  payment_notes?: string | null;
}

// ============================================
// TIPOS CON RELACIONES (para queries)
// ============================================

export interface CourseWithRelations extends Course {
  programa?: Programa;
  teacher?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  };
  modulos?: Modulo[];
}

export interface ModuloWithRelations extends Modulo {
  course?: CourseWithRelations;
  teacher?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  };
  enrollments?: CourseEnrollment[];
}

export interface MatriculaWithRelations extends Matricula {
  estudiante?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    student_code?: string;
  };
  usuario?: {
    id: string;
    first_name: string;
    last_name: string;
  };
  curso_grabado?: CursoGrabado;
  pagos?: Pago[];
}

export interface PagoWithRelations extends Pago {
  estudiante?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  };
  usuario?: {
    id: string;
    first_name: string;
    last_name: string;
  };
  cuota?: CuotaMatricula;
}

export interface PlanCuotasMatriculaWithRelations extends PlanCuotasMatricula {
  cuotas?: CuotaMatricula[];
  matricula?: Matricula;
}

export interface CuotaMatriculaWithRelations extends CuotaMatricula {
  plan?: PlanCuotasMatricula;
  pagos?: Pago[];
}

export interface EnrollmentWithRelations extends CourseEnrollment {
  modulo?: ModuloWithRelations;
  student?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  };
  matricula?: Matricula;
}

// ============================================
// TIPOS PARA INSERCIÓN
// ============================================

export type ProgramaInsert = Omit<Programa, 'id' | 'created_at' | 'updated_at'> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};

export type CourseInsert = Omit<Course, 'id' | 'created_at' | 'updated_at'> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};

export type ModuloInsert = Omit<Modulo, 'id' | 'created_at' | 'updated_at'> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};

export type MatriculaInsert = Omit<Matricula, 'id' | 'created_at' | 'updated_at'> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};

export type PagoInsert = Omit<Pago, 'id' | 'created_at' | 'updated_at'> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};

export type RegistroCompraMaterialInsert = Omit<RegistroCompraMaterial, 'id' | 'created_at' | 'updated_at' | 'fecha_registro' | 'codigo_material'> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
  fecha_registro?: string; // Opcional, usa DEFAULT NOW() en la BD
  codigo_material?: string; // Generado automáticamente por trigger
};

export type CursoGrabadoInsert = Omit<CursoGrabado, 'id' | 'created_at' | 'updated_at'> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};

export type VentaCursoGrabadoInsert = Omit<VentaCursoGrabado, 'id' | 'created_at' | 'updated_at'> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};

export type CourseEnrollmentInsert = Omit<CourseEnrollment, 'id' | 'enrolled_at'> & {
  id?: string;
  enrolled_at?: string;
};

export type PlanCuotasMatriculaInsert = Omit<PlanCuotasMatricula, 'id' | 'created_at' | 'updated_at'> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};

export type CuotaMatriculaInsert = Omit<CuotaMatricula, 'id' | 'created_at' | 'updated_at'> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};

// ============================================
// TIPOS PARA ACTUALIZACIÓN
// ============================================

export type ProgramaUpdate = Partial<Omit<Programa, 'id' | 'created_at' | 'updated_at'>>;
export type CourseUpdate = Partial<Omit<Course, 'id' | 'created_at' | 'updated_at'>>;
export type ModuloUpdate = Partial<Omit<Modulo, 'id' | 'created_at' | 'updated_at'>>;
export type MatriculaUpdate = Partial<Omit<Matricula, 'id' | 'created_at' | 'updated_at'>>;
export type PagoUpdate = Partial<Omit<Pago, 'id' | 'created_at' | 'updated_at'>>;

// ============================================
// TIPOS UTILITARIOS
// ============================================

export interface MatriculaFormData {
  estudiante_id: string;
  student_code?: string;
  modulos_seleccionados: string[]; // IDs de módulos
  valor_matricula: number;
  descuento: number;
  moneda: Moneda;
  incluir_clases_grabadas: boolean;
  id_clases_grabadas?: string;
  valor_clase_grabada?: number;
  book_incluido: boolean;
  monto_book?: number;
  moneda_book?: string;
  kit_incluido: boolean;
  monto_kit?: number;
  moneda_kit?: string;
  observaciones?: string;
  estado_pago: 'pendiente' | 'pagado' | 'cancelado';
}

export interface PagoFormData {
  categoria_producto: 'matricula' | 'kits' | 'books' | 'clases_grabadas';
  codigo_producto: string;
  estudiante_id?: string;
  monto_pago: number;
  fecha_pago: string;
  metodo_pago: string;
  moneda_pago: Moneda;
  estado_pago: 'primera_cuota' | 'pago_regular' | 'cuotas_restantes';
  comprobante?: string;
  observaciones?: string;
}

export interface CourseCreationData {
  name: string;
  description?: string;
  program_id: string;
  teacher_principal_id: string;
  academic_year: string;
  semester: string;
  start_date: string;
  end_date?: string;
  numero_modulos: number;
  material: 'book' | 'kit' | 'none';
  // Datos para generar módulos automáticamente
  modulos?: ModuloCreationData[];
}

export interface ModuloCreationData {
  name: string;
  description?: string;
  num_modulo: number;
  teacher_principal_id: string;
  start_date: string;
  end_date: string;
  schedule?: ModuloSchedule;
  aditional_teachers?: string[];
}

// ============================================
// CONSTANTES
// ============================================

export const MONEDAS = [
  'PEN', // Perú - Nuevo Sol
  'USD', // Estados Unidos - Dólar
  'EUR', // Eurozona - Euro
  'MXN', // México - Peso Mexicano
  'CLP', // Chile - Peso Chileno
  'ARS', // Argentina - Peso Argentino
  'COP', // Colombia - Peso Colombiano
  'BRL', // Brasil - Real
  'UYU', // Uruguay - Peso Uruguayo
  'BOB', // Bolivia - Boliviano
  'PYG', // Paraguay - Guaraní
  'VES', // Venezuela - Bolívar
] as const;
export type Moneda = typeof MONEDAS[number];

export const TIPOS_MATERIAL = ['book', 'kit'] as const;
export const ESTADOS_PAGO = ['pendiente', 'pagado', 'cancelado'] as const;
export const METODOS_PAGO = [
  'BCP', 
  'Interbank', 
  'Banco de la Nación', 
  'BBVA', 
  'Scotiabank',
  'Yape',
  'Plin',
  'Tarjeta LINK', 
  'En efectivo', 
  'Paypal',
  'Banco Colombia',
  'Banco Mexico',
  'Banco Ecuador',
  'Otros'
] as const;
export const TIPOS_PAGO = ['primera_cuota', 'pago_regular', 'cuotas_restantes'] as const;
export const CATEGORIAS_PRODUCTO = ['matricula', 'kits', 'books', 'clases_grabadas'] as const;
export const TIPOS_ESTUDIANTE = ['nuevo', 'antiguo'] as const;
export const TIPOS_PLAN_CUOTAS = ['pago_unico', 'cuotas_mensuales', 'cuotas_quincenales', 'cuotas_semanales'] as const;
export const ESTADOS_CUOTA = ['pendiente', 'pagado', 'parcial', 'vencido'] as const;

// ============================================
// HELPERS DE GENERACIÓN DE CÓDIGOS
// ============================================

export const generateCourseCode = (programCode: string, date: Date): string => {
  const monthNames = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
  const month = monthNames[date.getMonth()];
  const year = date.getFullYear();
  return `${programCode}-${month}-${year}`;
};

export const generateModuloCode = (programCode: string, numModulo: number, date: Date): string => {
  const monthNames = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
  const month = monthNames[date.getMonth()];
  const year = date.getFullYear();
  return `${programCode}-M${numModulo}-${month}-${year}`;
};

export const generateMatriculaCode = (year: number, sequential: number): string => {
  const paddedSeq = String(sequential).padStart(5, '0');
  return `MAT-${year}-${paddedSeq}`;
};

export const calculatePrecioFinal = (
  valorMatricula: number,
  valorClaseGrabada: number,
  descuento: number
): number => {
  return valorMatricula + valorClaseGrabada - descuento;
};
// ============================================
// HELPERS PARA SISTEMA DE CUOTAS
// ============================================

export const calcularTipoPlanCuotas = (
  numeroCuotas: number,
  programCode: string
): 'pago_unico' | 'cuotas_mensuales' | 'cuotas_quincenales' | 'cuotas_semanales' => {
  if (numeroCuotas === 1) {
    return 'pago_unico';
  }
  
  // Programa P013 permite cuotas mensuales
  if (programCode === 'P013' && numeroCuotas > 2) {
    return 'cuotas_mensuales';
  }
  
  // Para 2 cuotas: quincenal
  if (numeroCuotas === 2) {
    return 'cuotas_quincenales';
  }
  
  // Para 3 o 4 cuotas: semanal
  return 'cuotas_semanales';
};

export const calcularDiasEntreCuotas = (
  tipoPlan: 'pago_unico' | 'cuotas_mensuales' | 'cuotas_quincenales' | 'cuotas_semanales'
): number => {
  switch (tipoPlan) {
    case 'pago_unico':
      return 0;
    case 'cuotas_mensuales':
      return 30;
    case 'cuotas_quincenales':
      return 15;
    case 'cuotas_semanales':
      return 7;
    default:
      return 0;
  }
};

export interface CuotaCalculada {
  numero_cuota: number;
  monto_cuota: number;
  fecha_vencimiento: string;
}

export const calcularCuotas = (
  montoTotal: number,
  numeroCuotas: number,
  fechaPrimerPago: Date,
  tipoPlan: 'pago_unico' | 'cuotas_mensuales' | 'cuotas_quincenales' | 'cuotas_semanales'
): CuotaCalculada[] => {
  const cuotas: CuotaCalculada[] = [];
  const montoPorCuota = Math.round((montoTotal / numeroCuotas) * 100) / 100;
  const diasEntreCuotas = calcularDiasEntreCuotas(tipoPlan);
  
  // Obtener año, mes y día de la fecha inicial
  const yearInicial = fechaPrimerPago.getFullYear();
  const monthInicial = fechaPrimerPago.getMonth();
  const dayInicial = fechaPrimerPago.getDate();
  
  for (let i = 0; i < numeroCuotas; i++) {
    // Crear una nueva fecha a partir de los componentes, no de otra Date
    const fechaVencimiento = new Date(yearInicial, monthInicial, dayInicial + (i * diasEntreCuotas));
    
    // La última cuota ajusta el redondeo
    const monto = i === numeroCuotas - 1 
      ? Math.round((montoTotal - (montoPorCuota * (numeroCuotas - 1))) * 100) / 100
      : montoPorCuota;
    
    // Usar fecha local sin conversión UTC
    const year = fechaVencimiento.getFullYear();
    const month = String(fechaVencimiento.getMonth() + 1).padStart(2, '0');
    const day = String(fechaVencimiento.getDate()).padStart(2, '0');
    const fechaString = `${year}-${month}-${day}`;
    
    cuotas.push({
      numero_cuota: i + 1,
      monto_cuota: monto,
      fecha_vencimiento: fechaString
    });
  }
  
  return cuotas;
};

export const validarNumeroCuotasPermitido = (numeroCuotas: number, programCode: string): boolean => {
  // Pago único siempre permitido
  if (numeroCuotas === 1) return true;
  
  // Programa P013 permite 1, 2 o hasta 12 cuotas mensuales
  if (programCode === 'P013') {
    return numeroCuotas >= 1 && numeroCuotas <= 12;
  }
  
  // Otros programas: solo 1, 2, 3 o 4 cuotas
  return numeroCuotas >= 1 && numeroCuotas <= 4;
};