import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { formatDate } from '@/lib/dateUtils.ts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { BulkStudentImport } from '@/components/students/BulkStudentImport';
import { MatriculasTab } from '@/components/students/MatriculasTab';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Users,
  BookOpen,
  UserCheck,
  UserX,
  Upload,
  UserPlus,
  Loader2,
  CheckCircle2,
  X,
  DollarSign,
  Lock,
  Unlock,
  AlertCircle
} from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';

interface Student {
  id: string;
  first_name: string;
  last_name: string;
  paternal_surname: string;
  maternal_surname: string;
  student_code: string;
  email: string;
  phone: string | null;
  document_number?: string;
  gender?: string;
  birth_date?: string;
  country?: string;
  education_level?: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

interface Course {
  id: string;
  name: string;
  code: string;
  grade?: string;
  section?: string;
  academic_year?: string;
  is_active: boolean;
}

interface Enrollment {
  id: string;
  student_id: string;
  modulo_id: string;
  enrolled_at: string;
  tipo_estudiante?: 'nuevo' | 'antiguo';
  matricula_id?: string | null;
  modulo: {
    id: string;
    name: string;
    code: string;
    num_modulo: number;
    course: {
      id: string;
      name: string;
      code: string;
    };
  };
}

interface StudentFormData {
  first_name: string;
  paternal_surname: string;
  maternal_surname: string;
  student_code: string;
  email: string;
  phone: string;
  document_number: string;
  gender: string;
  birth_date: string;
  country: string;
  education_level: string;
}

const AdminStudentManagementHub = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  
  // States para gestión individual
  const [students, setStudents] = useState<Student[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchType, setSearchType] = useState<'code' | 'name' | 'course'>('code');
  const [filterCourse, setFilterCourse] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [creating, setCreating] = useState(false);
  
  // States para matriculación existentes
  const [selectedCourseEnroll, setSelectedCourseEnroll] = useState<Course | null>(null);
  const [selectedStudentsEnroll, setSelectedStudentsEnroll] = useState<Set<string>>(new Set());
  const [enrollFilteredStudents, setEnrollFilteredStudents] = useState<Student[]>([]);
  const [enrollSearchTerm, setEnrollSearchTerm] = useState('');
  const [showOnlyNotEnrolled, setShowOnlyNotEnrolled] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  
  // States para gestión de matrículas y pagos
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [studentEnrollments, setStudentEnrollments] = useState<Enrollment[]>([]);
  const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(false);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [selectedEnrollment, setSelectedEnrollment] = useState<Enrollment | null>(null);
  const [paymentNotes, setPaymentNotes] = useState('');
  
  const [formData, setFormData] = useState<StudentFormData>({
    first_name: '',
    paternal_surname: '',
    maternal_surname: '',
    student_code: '',
    email: '',
    phone: '',
    document_number: '',
    gender: 'M',
    birth_date: '',
    country: 'Perú',
    education_level: ''
  });
  const [customCountry, setCustomCountry] = useState('');
  const [studentCodeError, setStudentCodeError] = useState('');

  if (profile?.role !== 'admin') {
    return (
      <DashboardLayout>
        <div className="p-6">
          <Card className="bg-gradient-card shadow-card border-0">
            <CardContent className="p-8 text-center">
              <div className="text-destructive text-lg font-semibold mb-2">
                Acceso Denegado
              </div>
              <p className="text-muted-foreground">
                Solo los administradores pueden acceder a esta sección.
              </p>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  useEffect(() => {
    fetchStudents();
    fetchCourses();
  }, []);

  useEffect(() => {
    // Ejecutar el filtro cada vez que cambien las dependencias
    filterStudentsList();
  }, [students, searchTerm, searchType, filterCourse, filterStatus]);

  useEffect(() => {
    filterEnrollStudentsList();
  }, [students, enrollSearchTerm, selectedCourseEnroll, showOnlyNotEnrolled]);

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'student')
        .order('paternal_surname', { ascending: true });

      if (error) throw error;
      setStudents(data || []);
    } catch (error) {
      console.error('Error fetching students:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los estudiantes",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchCourses = async () => {
    try {
      // Cargar solo cursos que tengan módulos activos
      const { data: modulosData, error: modulosError } = await supabase
        .from('modulos')
        .select('course_id, courses(id, name, code)')
        .eq('is_active', true);

      if (modulosError) throw modulosError;

      // Extraer cursos únicos
      const coursesMap = new Map();
      modulosData?.forEach((modulo: any) => {
        if (modulo.courses && !coursesMap.has(modulo.courses.id)) {
          coursesMap.set(modulo.courses.id, {
            id: modulo.courses.id,
            name: modulo.courses.name,
            code: modulo.courses.code,
            is_active: true
          });
        }
      });

      const uniqueCourses = Array.from(coursesMap.values());
      // Ordenar por nombre
      uniqueCourses.sort((a, b) => a.name.localeCompare(b.name));
      
      setCourses(uniqueCourses);
    } catch (error) {
      console.error('Error fetching courses:', error);
    }
  };

  const filterStudentsList = async () => {
    let filtered = [...students];

    // Filtro por curso primero (si está seleccionado)
    if (searchType === 'course' && filterCourse !== 'all') {
      // Primero obtener los módulos del curso seleccionado
      const { data: modulos, error: modulosError } = await supabase
        .from('modulos')
        .select('id')
        .eq('course_id', filterCourse);
      
      if (modulosError) {
        console.error('Error fetching modulos:', modulosError);
      }
      
      const moduloIds = modulos?.map(m => m.id) || [];
      
      if (moduloIds.length > 0) {
        // Buscar estudiantes matriculados en cualquiera de estos módulos
        const { data: enrollments, error: enrollError } = await supabase
          .from('course_enrollments')
          .select('student_id')
          .in('modulo_id', moduloIds);
        
        if (enrollError) {
          console.error('Error fetching enrollments:', enrollError);
        }
        
        const enrolledIds = new Set(enrollments?.map(e => e.student_id) || []);
        filtered = filtered.filter(s => enrolledIds.has(s.id));
      } else {
        // Si no hay módulos, no hay estudiantes matriculados
        filtered = [];
      }
    }
    
    // Filtro por búsqueda de texto (si hay término y no es búsqueda por curso)
    if (searchTerm && searchType !== 'course') {
      const term = searchTerm.toLowerCase();
      
      if (searchType === 'code') {
        filtered = filtered.filter(s => s.student_code?.toLowerCase().includes(term));
      } else if (searchType === 'name') {
        filtered = filtered.filter(s => {
          const fullName = `${s.paternal_surname} ${s.maternal_surname} ${s.first_name}`.toLowerCase();
          return fullName.includes(term) || s.document_number?.toLowerCase().includes(term);
        });
      }
    }

    // Filtro por estado
    if (filterStatus !== 'all') {
      filtered = filtered.filter(s => 
        filterStatus === 'active' ? s.is_active : !s.is_active
      );
    }

    setFilteredStudents(filtered);
  };

  const filterEnrollStudentsList = async () => {
    let filtered = [...students].filter(s => s.is_active);

    // Filtro por búsqueda
    if (enrollSearchTerm) {
      const term = enrollSearchTerm.toLowerCase();
      filtered = filtered.filter(student => {
        const fullName = `${student.paternal_surname} ${student.maternal_surname} ${student.first_name}`.toLowerCase();
        const code = student.student_code?.toLowerCase() || '';
        const doc = student.document_number?.toLowerCase() || '';
        return fullName.includes(term) || code.includes(term) || doc.includes(term);
      });
    }

    // Filtro por no matriculados
    if (selectedCourseEnroll && showOnlyNotEnrolled) {
      const { data: enrollments } = await supabase
        .from('course_enrollments')
        .select('student_id')
        .eq('modulo_id', selectedCourseEnroll.id);

      const enrolledIds = new Set(enrollments?.map(e => e.student_id) || []);
      filtered = filtered.filter(student => !enrolledIds.has(student.id));
    }

    setEnrollFilteredStudents(filtered);
  };

  const handleCreateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);

    try {
      // Validar que tenga email y código de estudiante
      if (!formData.email || !formData.student_code) {
        toast({
          title: "Error",
          description: "Email y Código de Estudiante son requeridos",
          variant: "destructive",
        });
        setCreating(false);
        return;
      }

      // Validar longitud exacta del código de estudiante
      if (formData.student_code.length !== 9) {
        const msg = formData.student_code.length < 9
          ? `El código debe tener exactamente 9 caracteres (faltan ${9 - formData.student_code.length}).`
          : `El código no puede tener más de 9 caracteres (sobran ${formData.student_code.length - 9}).`;
        setStudentCodeError(msg);
        setCreating(false);
        return;
      }

      // Verificar que el código de estudiante no esté ya registrado
      const { data: existingCode } = await supabase
        .from('profiles')
        .select('id')
        .eq('student_code', formData.student_code)
        .maybeSingle();

      if (existingCode) {
        setFormData({
          first_name: '',
          paternal_surname: '',
          maternal_surname: '',
          student_code: '',
          email: '',
          phone: '',
          document_number: '',
          gender: 'M',
          birth_date: '',
          country: 'Perú',
          education_level: ''
        });
        setCustomCountry('');
        setStudentCodeError('Este código de estudiante ya está registrado. Completa nuevamente los datos.');
        setCreating(false);
        return;
      }

      setStudentCodeError('');

      // Usar el email ingresado y el código de estudiante como contraseña
      const email = formData.email;
      const password = formData.student_code;

      // Llamar a la función edge para crear el estudiante
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast({
          title: "Error",
          description: "No hay sesión activa",
          variant: "destructive",
        });
        setCreating(false);
        return;
      }

      // Obtener el token de la sesión actual
      const { data: sessionData } = await supabase.auth.getSession();
      const currentSession = sessionData?.session;
      
      if (!currentSession || !currentSession.access_token) {
        throw new Error('No hay sesión activa');
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      console.log('Enviando solicitud con token:', currentSession.access_token.substring(0, 20) + '...');

      const response = await fetch(`${supabaseUrl}/functions/v1/crud-estudiantes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentSession.access_token}`,
          'apikey': supabaseAnonKey,
        },
        body: JSON.stringify({
          students: [{
            firstName: formData.first_name,
            paternalSurname: formData.paternal_surname,
            maternalSurname: formData.maternal_surname,
            documentNumber: formData.document_number,
            studentCode: formData.student_code,
            email: email,
            password: password,
            gender: formData.gender,
            birthDate: formData.birth_date,
            phone: formData.phone,
            country: formData.country === 'Otro' ? customCountry : formData.country,
            educationLevel: formData.education_level
          }]
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Error response:', errorData);
        throw new Error(errorData.error || `Error ${response.status}: ${response.statusText}`);
      }

      const responseData = await response.json();

      // Verificar si el estudiante único falló internamente (la función siempre devuelve 200)
      if (responseData.results?.errors?.length > 0 && responseData.results?.success?.length === 0) {
        const firstError = responseData.results.errors[0];
        const errMsg = firstError.error || 'No se pudo crear el estudiante';
        console.error('Error interno al crear estudiante:', firstError);
        throw new Error(errMsg);
      }

      toast({
        title: "Éxito",
        description: "Estudiante creado exitosamente. Usa la pestaña 'Matrícula' para inscribirlo en un curso.",
      });

      setIsCreateModalOpen(false);
      setFormData({
        first_name: '',
        paternal_surname: '',
        maternal_surname: '',
        student_code: '',
        email: '',
        phone: '',
        document_number: '',
        gender: 'M',
        birth_date: '',
        country: 'Perú',
        education_level: ''
      });
      setCustomCountry('');
      setStudentCodeError('');
      fetchStudents();
    } catch (error: any) {
      console.error('Error creating student:', error);
      toast({
        title: "Error",
        description: error.message || "No se pudo crear el estudiante",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const toggleStudentSelection = (studentId: string) => {
    const newSelection = new Set(selectedStudentsEnroll);
    if (newSelection.has(studentId)) {
      newSelection.delete(studentId);
    } else {
      newSelection.add(studentId);
    }
    setSelectedStudentsEnroll(newSelection);
  };

  const selectAllEnroll = () => {
    setSelectedStudentsEnroll(new Set(enrollFilteredStudents.map(s => s.id)));
  };

  const clearSelectionEnroll = () => {
    setSelectedStudentsEnroll(new Set());
  };

  const handleEnrollStudents = async () => {
    if (!selectedCourseEnroll) {
      toast({
        title: "Error",
        description: "Debes seleccionar un curso",
        variant: "destructive",
      });
      return;
    }

    if (selectedStudentsEnroll.size === 0) {
      toast({
        title: "Error",
        description: "Debes seleccionar al menos un estudiante",
        variant: "destructive",
      });
      return;
    }

    setEnrolling(true);
    try {
      const { data: existingEnrollments } = await supabase
        .from('course_enrollments')
        .select('student_id')
        .eq('modulo_id', selectedCourseEnroll.id)
        .in('student_id', Array.from(selectedStudentsEnroll));

      const alreadyEnrolledIds = new Set(existingEnrollments?.map(e => e.student_id) || []);
      const toEnroll = Array.from(selectedStudentsEnroll).filter(id => !alreadyEnrolledIds.has(id));

      if (toEnroll.length === 0) {
        toast({
          title: "Información",
          description: "Todos los estudiantes seleccionados ya están matriculados",
        });
        setEnrolling(false);
        return;
      }

      const enrollmentData = toEnroll.map(studentId => ({
        student_id: studentId,
        modulo_id: selectedCourseEnroll.id,
        enrolled_at: new Date().toISOString(),
        tipo_estudiante: 'nuevo'
      }));

      const { error } = await supabase
        .from('course_enrollments')
        .insert(enrollmentData);

      if (error) throw error;

      toast({
        title: "Éxito",
        description: `${toEnroll.length} estudiante${toEnroll.length !== 1 ? 's' : ''} matriculado${toEnroll.length !== 1 ? 's' : ''}`,
      });

      clearSelectionEnroll();
      filterEnrollStudentsList();
    } catch (error) {
      console.error('Error enrolling students:', error);
      toast({
        title: "Error",
        description: "No se pudieron matricular los estudiantes",
        variant: "destructive",
      });
    } finally {
      setEnrolling(false);
    }
  };

  // Funciones para gestión de matrículas y pagos
  const openEnrollModal = (student: Student) => {
    setSelectedStudent(student);
    setIsEnrollModalOpen(true);
    fetchStudentEnrollments(student.id);
  };

  const fetchStudentEnrollments = async (studentId: string) => {
    try {
      const { data, error } = await supabase
        .from('course_enrollments')
        .select(`
          *,
          modulo:modulos (
            id,
            name,
            code,
            num_modulo,
            course:courses (
              id,
              name,
              code
            )
          )
        `)
        .eq('student_id', studentId)
        .order('enrolled_at', { ascending: false });

      if (error) {
        console.error('Error fetching enrollments:', error);
      } else {
        setStudentEnrollments(data || []);
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const openPaymentDialog = (enrollment: Enrollment) => {
    setSelectedEnrollment(enrollment);
    setPaymentNotes('');
    setIsPaymentDialogOpen(true);
  };

  const handleToggleCourseAccess = async (newStatus: 'pending' | 'granted' | 'blocked') => {
    if (!selectedEnrollment) return;

    try {
      // Actualizar access_status en course_enrollments
      const { error } = await supabase
        .from('course_enrollments')
        .update({ access_status: newStatus })
        .eq('id', selectedEnrollment.id);

      if (error) throw error;

      toast({
        title: "Éxito",
        description: `Estado actualizado a: ${
          newStatus === 'granted' ? 'Acceso Habilitado' :
          newStatus === 'blocked' ? 'Bloqueado' :
          'Pendiente'
        }`,
      });

      setIsPaymentDialogOpen(false);
      setSelectedEnrollment(null);
      setPaymentNotes('');

      // Refresh enrollments
      if (selectedStudent) {
        fetchStudentEnrollments(selectedStudent.id);
      }
    } catch (error) {
      console.error('Error toggling course access:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'No se pudo actualizar el acceso',
        variant: "destructive",
      });
    }
  };

  const handleUnenrollStudent = async (enrollmentId: string) => {
    if (!confirm('¿Estás seguro de dar de baja al estudiante de este curso?')) return;

    try {
      const { error } = await supabase
        .from('course_enrollments')
        .delete()
        .eq('id', enrollmentId);

      if (error) throw error;

      toast({
        title: "Éxito",
        description: "Estudiante dado de baja del curso",
      });

      if (selectedStudent) {
        fetchStudentEnrollments(selectedStudent.id);
      }
    } catch (error) {
      console.error('Error unenrolling student:', error);
      toast({
        title: "Error",
        description: "No se pudo dar de baja al estudiante",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="container mx-auto p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Gestión de Estudiantes</h1>
          <p className="text-muted-foreground">
            Administra estudiantes, matriculaciones e importación masiva
          </p>
        </div>

        <Tabs defaultValue="students" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="students">
              <Users className="h-4 w-4 mr-2" />
              Estudiantes
            </TabsTrigger>
            <TabsTrigger value="enroll">
              <UserPlus className="h-4 w-4 mr-2" />
              Matrícula
            </TabsTrigger>
            <TabsTrigger value="import">
              <Upload className="h-4 w-4 mr-2" />
              Importación Masiva
            </TabsTrigger>
          </TabsList>

          {/* Tab 1: Gestión de Estudiantes */}
          <TabsContent value="students" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Lista de Estudiantes
                  </span>
                  <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
                    <DialogTrigger asChild>
                      <Button>
                        <Plus className="h-4 w-4 mr-2" />
                        Nuevo Estudiante
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>Agregar Nuevo Estudiante</DialogTitle>
                      </DialogHeader>
                      <form onSubmit={handleCreateStudent} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="student_code">Código de Estudiante *</Label>
                            <Input
                              id="student_code"
                              value={formData.student_code}
                              onChange={(e) => {
                                setFormData({ ...formData, student_code: e.target.value });
                                if (studentCodeError) setStudentCodeError('');
                              }}
                              required
                              maxLength={9}
                              className={studentCodeError ? 'border-destructive focus-visible:ring-destructive' : ''}
                            />
                            <p className={`text-xs mt-1 ${formData.student_code.length === 9 ? 'text-green-600' : 'text-muted-foreground'}`}>
                              {formData.student_code.length}/9 caracteres
                            </p>
                            {studentCodeError && (
                              <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                                <AlertCircle className="h-3 w-3" />
                                {studentCodeError}
                              </p>
                            )}
                          </div>
                          <div>
                            <Label htmlFor="email">Correo Electrónico *</Label>
                            <Input
                              id="email"
                              type="email"
                              value={formData.email}
                              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                              placeholder="estudiante@correo.com"
                              required
                            />
                          </div>
                        </div>

                        <div>
                          <Label htmlFor="document_number">DNI / Nro. Documento</Label>
                          <Input
                            id="document_number"
                            value={formData.document_number}
                            onChange={(e) => setFormData({ ...formData, document_number: e.target.value })}
                          />
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <Label htmlFor="first_name">Nombres *</Label>
                            <Input
                              id="first_name"
                              value={formData.first_name}
                              onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                              required
                            />
                          </div>
                          <div>
                            <Label htmlFor="paternal_surname">Apellido Paterno *</Label>
                            <Input
                              id="paternal_surname"
                              value={formData.paternal_surname}
                              onChange={(e) => setFormData({ ...formData, paternal_surname: e.target.value })}
                              required
                            />
                          </div>
                          <div>
                            <Label htmlFor="maternal_surname">Apellido Materno *</Label>
                            <Input
                              id="maternal_surname"
                              value={formData.maternal_surname}
                              onChange={(e) => setFormData({ ...formData, maternal_surname: e.target.value })}
                              required
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="gender">Género *</Label>
                            <Select value={formData.gender} onValueChange={(value) => setFormData({ ...formData, gender: value })}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="M">Masculino</SelectItem>
                                <SelectItem value="F">Femenino</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label htmlFor="birth_date">Fecha de Nacimiento</Label>
                            <Input
                              id="birth_date"
                              type="date"
                              value={formData.birth_date}
                              onChange={(e) => setFormData({ ...formData, birth_date: e.target.value })}
                            />
                          </div>
                        </div>

                        <div>
                          <Label htmlFor="phone">Teléfono (con código de país)</Label>
                          <Input
                            id="phone"
                            type="tel"
                            value={formData.phone}
                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                            placeholder="+51 987654321"
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            Incluye el código de país (Ej: +51 para Perú, +52 para México)
                          </p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="country">País</Label>
                            <Select
                              value={formData.country}
                              onValueChange={(value) => {
                                setFormData({ ...formData, country: value });
                                if (value !== 'Otro') {
                                  setCustomCountry('');
                                }
                              }}
                            >
                              <SelectTrigger id="country">
                                <SelectValue placeholder="Seleccionar país" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Perú">Perú</SelectItem>
                                <SelectItem value="Argentina">Argentina</SelectItem>
                                <SelectItem value="Bolivia">Bolivia</SelectItem>
                                <SelectItem value="Brasil">Brasil</SelectItem>
                                <SelectItem value="Chile">Chile</SelectItem>
                                <SelectItem value="Colombia">Colombia</SelectItem>
                                <SelectItem value="Costa Rica">Costa Rica</SelectItem>
                                <SelectItem value="Cuba">Cuba</SelectItem>
                                <SelectItem value="Ecuador">Ecuador</SelectItem>
                                <SelectItem value="El Salvador">El Salvador</SelectItem>
                                <SelectItem value="España">España</SelectItem>
                                <SelectItem value="Guatemala">Guatemala</SelectItem>
                                <SelectItem value="Honduras">Honduras</SelectItem>
                                <SelectItem value="México">México</SelectItem>
                                <SelectItem value="Nicaragua">Nicaragua</SelectItem>
                                <SelectItem value="Panamá">Panamá</SelectItem>
                                <SelectItem value="Paraguay">Paraguay</SelectItem>
                                <SelectItem value="Puerto Rico">Puerto Rico</SelectItem>
                                <SelectItem value="República Dominicana">República Dominicana</SelectItem>
                                <SelectItem value="Uruguay">Uruguay</SelectItem>
                                <SelectItem value="Venezuela">Venezuela</SelectItem>
                                <SelectItem value="Estados Unidos">Estados Unidos</SelectItem>
                                <SelectItem value="Canadá">Canadá</SelectItem>
                                <SelectItem value="Otro">Otro</SelectItem>
                              </SelectContent>
                            </Select>
                            {formData.country === 'Otro' && (
                              <Input
                                id="custom_country"
                                value={customCountry}
                                onChange={(e) => setCustomCountry(e.target.value)}
                                placeholder="Ingresa el nombre del país"
                                className="mt-2"
                              />
                            )}
                          </div>
                          <div>
                            <Label htmlFor="education_level">Nivel Educativo</Label>
                            <Select
                              value={formData.education_level}
                              onValueChange={(value) => setFormData({ ...formData, education_level: value })}
                            >
                              <SelectTrigger id="education_level">
                                <SelectValue placeholder="Seleccionar nivel" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Primaria Completa">Primaria Completa</SelectItem>
                                <SelectItem value="Primaria Incompleta">Primaria Incompleta</SelectItem>
                                <SelectItem value="Secundaria Completa">Secundaria Completa</SelectItem>
                                <SelectItem value="Secundaria Incompleta">Secundaria Incompleta</SelectItem>
                                <SelectItem value="Universidad Completa">Universidad Completa</SelectItem>
                                <SelectItem value="Universidad Incompleta">Universidad Incompleta</SelectItem>
                                <SelectItem value="Superior / Instituto">Superior / Instituto</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div className="bg-muted p-3 rounded-lg text-sm">
                          <p className="font-medium mb-1">Credenciales de acceso:</p>
                          <p>Email: {formData.email || '(ingresa un email)'}</p>
                          <p>Contraseña: {formData.student_code || '(se usará el código de estudiante)'}</p>
                          <p className="text-xs text-muted-foreground mt-2">
                            El estudiante podrá iniciar sesión con estas credenciales
                          </p>
                          <p className="text-xs text-yellow-600 dark:text-yellow-500 mt-2 font-medium">
                            ⚠️ Para matricular al estudiante, usa la pestaña "Matrícula"
                          </p>
                        </div>

                        <div className="flex justify-end gap-2">
                          <Button type="button" variant="outline" onClick={() => setIsCreateModalOpen(false)}>
                            Cancelar
                          </Button>
                          <Button type="submit" disabled={creating}>
                            {creating ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Creando...
                              </>
                            ) : (
                              <>
                                <Plus className="h-4 w-4 mr-2" />
                                Crear Estudiante
                              </>
                            )}
                          </Button>
                        </div>
                      </form>
                    </DialogContent>
                  </Dialog>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Filtros y búsqueda */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="md:col-span-2">
                    <Label>Tipo de Búsqueda</Label>
                    <Select value={searchType} onValueChange={(value: any) => setSearchType(value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona tipo de búsqueda" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="code">Por Código de Estudiante</SelectItem>
                        <SelectItem value="name">Por Nombre/DNI</SelectItem>
                        <SelectItem value="course">Por Curso</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {searchType === 'course' ? (
                    <div className="md:col-span-2">
                      <Label>Curso</Label>
                      <Select value={filterCourse} onValueChange={setFilterCourse}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona un curso" />
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
                  ) : (
                    <div className="md:col-span-2">
                      <Label>Buscar</Label>
                      <div className="relative">
                        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder={searchType === 'code' ? 'Buscar por código...' : 'Buscar por nombre o DNI...'}
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    {filteredStudents.length} estudiante{filteredStudents.length !== 1 ? 's' : ''} encontrado{filteredStudents.length !== 1 ? 's' : ''}
                  </div>
                  <Select value={filterStatus} onValueChange={(value: any) => setFilterStatus(value)}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="Estado" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="active">Solo Activos</SelectItem>
                      <SelectItem value="inactive">Solo Inactivos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Tabla de estudiantes */}
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Código</TableHead>
                        <TableHead>Apellidos y Nombres</TableHead>
                        <TableHead>DNI</TableHead>
                        <TableHead>Género</TableHead>
                        <TableHead>País</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredStudents.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                            No se encontraron estudiantes
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredStudents.map((student) => (
                          <TableRow key={student.id}>
                            <TableCell className="font-medium">{student.student_code}</TableCell>
                            <TableCell>
                              {student.paternal_surname} {student.maternal_surname}, {student.first_name}
                            </TableCell>
                            <TableCell>{student.document_number || '-'}</TableCell>
                            <TableCell>{student.gender || '-'}</TableCell>
                            <TableCell>{student.country || '-'}</TableCell>
                            <TableCell>
                              <Badge variant={student.is_active ? 'default' : 'secondary'}>
                                {student.is_active ? 'Activo' : 'Inactivo'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openEnrollModal(student)}
                                title="Ver matrículas y gestionar pagos"
                              >
                                <BookOpen className="w-4 h-4 mr-1" />
                                Matrículas
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab 2: Matrícula (nueva) */}
          <TabsContent value="enroll" className="space-y-4">
            <MatriculasTab />
          </TabsContent>

          {/* Tab 3: Importación Masiva */}
          <TabsContent value="import" className="space-y-4">
            <BulkStudentImport courses={courses} onSuccess={fetchStudents} />
          </TabsContent>
        </Tabs>

        {/* Enrollment Management Modal */}
        <Dialog open={isEnrollModalOpen} onOpenChange={setIsEnrollModalOpen}>
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                Matrículas - {selectedStudent?.first_name} {selectedStudent?.paternal_surname}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Cursos Matriculados ({studentEnrollments.length})</h3>
                {studentEnrollments.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Curso</TableHead>
                        <TableHead>Código</TableHead>
                        <TableHead>Fecha Inscripción</TableHead>
                        <TableHead>Estado de Pago</TableHead>
                        <TableHead>Acceso</TableHead>
                        <TableHead>Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {studentEnrollments.map((enrollment) => {
                        const paymentStatus = enrollment.access_status || 'pending';
                        const isAccessGranted = paymentStatus === 'granted';
                        
                        return (
                          <TableRow key={enrollment.id} className={paymentStatus === 'blocked' ? 'bg-red-50 dark:bg-red-950/20' : ''}>
                            <TableCell className="font-medium">{enrollment.modulo?.course?.name || 'N/A'}</TableCell>
                            <TableCell>{enrollment.modulo?.code || 'N/A'}</TableCell>
                            <TableCell>{formatDate(enrollment.enrolled_at)}</TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-1">
                                <Badge 
                                  variant={
                                    paymentStatus === 'granted' ? 'default' : 
                                    paymentStatus === 'blocked' ? 'destructive' : 
                                    'secondary'
                                  }
                                  className="w-fit"
                                >
                                  {paymentStatus === 'granted' && <DollarSign className="w-3 h-3 mr-1" />}
                                  {paymentStatus === 'blocked' && <AlertCircle className="w-3 h-3 mr-1" />}
                                  {paymentStatus === 'granted' ? 'Acceso Habilitado' : 
                                   paymentStatus === 'blocked' ? 'Bloqueado' : 
                                   'Acceso Pendiente'}
                                </Badge>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge 
                                variant={isAccessGranted ? 'default' : 'secondary'}
                                className="w-fit"
                              >
                                {isAccessGranted ? (
                                  <><Unlock className="w-3 h-3 mr-1" /> Habilitado</>
                                ) : (
                                  <><Lock className="w-3 h-3 mr-1" /> Bloqueado</>
                                )}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => openPaymentDialog(enrollment)}
                                  title="Gestionar pago y acceso"
                                >
                                  <DollarSign className="w-4 h-4 mr-1" />
                                  Gestionar Pago
                                </Button>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => handleUnenrollStudent(enrollment.id)}
                                  title="Dar de baja del curso"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8">
                    <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No hay inscripciones actualmente</p>
                  </div>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Payment Management Dialog */}
        <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Gestionar Pago y Acceso al Curso</DialogTitle>
            </DialogHeader>
            {selectedEnrollment && (
              <div className="space-y-6">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Módulo:</span>
                    <span className="text-sm text-muted-foreground">{selectedEnrollment.modulo?.name || 'N/A'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Edición:</span>
                    <span className="text-sm text-muted-foreground">{selectedEnrollment.modulo?.course?.name || 'N/A'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Estado Actual:</span>
                    <Badge 
                      variant={
                        selectedEnrollment.access_status === 'granted' ? 'default' : 
                        selectedEnrollment.access_status === 'blocked' ? 'destructive' : 
                        'secondary'
                      }
                    >
                      {selectedEnrollment.access_status === 'granted' ? 'Acceso Habilitado' : 
                       selectedEnrollment.access_status === 'blocked' ? 'Bloqueado' : 
                       'Acceso Pendiente'}
                    </Badge>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="payment-notes">Notas sobre el Pago</Label>
                  <Textarea
                    id="payment-notes"
                    value={paymentNotes}
                    onChange={(e) => setPaymentNotes(e.target.value)}
                    placeholder="Ej: Pago recibido el 15/01/2026 vía transferencia..."
                    rows={3}
                  />
                  <p className="text-xs text-muted-foreground">
                    Estas notas serán visibles para otros administradores
                  </p>
                </div>

                <div className="space-y-3">
                  <Label>Actualizar Estado:</Label>
                  <div className="grid grid-cols-1 gap-2">
                    <Button
                      variant={selectedEnrollment.access_status === 'granted' ? 'default' : 'outline'}
                      className="w-full justify-start"
                      onClick={() => handleToggleCourseAccess('granted')}
                    >
                      <Unlock className="w-4 h-4 mr-2" />
                      <div className="flex-1 text-left">
                        <div className="font-medium">Habilitar Acceso</div>
                        <div className="text-xs opacity-80">Permitir acceso completo al módulo</div>
                      </div>
                    </Button>
                    
                    <Button
                      variant={selectedEnrollment.access_status === 'pending' ? 'default' : 'outline'}
                      className="w-full justify-start"
                      onClick={() => handleToggleCourseAccess('pending')}
                    >
                      <AlertCircle className="w-4 h-4 mr-2" />
                      <div className="flex-1 text-left">
                        <div className="font-medium">Marcar como Pendiente</div>
                        <div className="text-xs opacity-80">Pago en proceso de verificación</div>
                      </div>
                    </Button>
                    
                    <Button
                      variant={selectedEnrollment.access_status === 'blocked' ? 'destructive' : 'outline'}
                      className="w-full justify-start"
                      onClick={() => handleToggleCourseAccess('blocked')}
                    >
                      <Lock className="w-4 h-4 mr-2" />
                      <div className="flex-1 text-left">
                        <div className="font-medium">Bloquear por Impago</div>
                        <div className="text-xs opacity-80">Restringir acceso al curso</div>
                      </div>
                    </Button>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t">
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setIsPaymentDialogOpen(false);
                      setSelectedEnrollment(null);
                      setPaymentNotes('');
                    }}
                  >
                    Cerrar
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default AdminStudentManagementHub;
