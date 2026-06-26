import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { formatDate } from '@/lib/dateUtils.ts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Users,
  BookOpen,
  UserCheck,
  UserX,
  Filter,
  Mail,
  Phone,
  Calendar,
  Lock,
  Unlock,
  DollarSign,
  AlertCircle
} from 'lucide-react';

interface Student {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  role: string;
  is_active: boolean;
  created_at: string;
  enrollments?: { count: number }[];
}

interface Course {
  id: string;
  name: string;
  code: string;
}

interface ModuloForEnrollment {
  id: string;
  name: string;
  code: string;
  num_modulo: number;
  course: {
    id: string;
    name: string;
    code: string;
  };
}

interface Modulo {
  id: string;
  name: string;
  code: string;
  num_modulo: number;
  course: Course;
}

interface Enrollment {
  id: string;
  student_id: string;
  modulo_id: string;
  enrolled_at: string;
  modulo: Modulo;
  tipo_estudiante?: 'nuevo' | 'antiguo';
  matricula_id?: string | null;
}

interface StudentFormData {
  document_type: string;
  document_number: string;
  student_code: string;
  paternal_surname: string;
  maternal_surname: string;
  first_name: string;
  email: string;
  phone: string;
  gender: string;
  birth_date: string;
  country: string;
  education_level: string;
}

const AdminStudentManagement = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  
  // States
  const [students, setStudents] = useState<Student[]>([]);
  const [modulos, setModulos] = useState<ModuloForEnrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [studentEnrollments, setStudentEnrollments] = useState<Enrollment[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedCourseForEnrollment, setSelectedCourseForEnrollment] = useState('');
  const [formData, setFormData] = useState<StudentFormData>({
    document_type: 'DNI',
    document_number: '',
    student_code: '',
    paternal_surname: '',
    maternal_surname: '',
    first_name: '',
    email: '',
    phone: '',
    gender: '',
    birth_date: '',
    country: 'Perú',
    education_level: ''
  });
  const [customCountry, setCustomCountry] = useState('');
  const [studentCodeError, setStudentCodeError] = useState('');

  // Redirect if not admin
  if (profile?.role !== 'admin') {
    return (
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
    );
  }

  useEffect(() => {
    fetchStudents();
    fetchModulos();
  }, []);

  const fetchStudents = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          *,
          enrollments:course_enrollments (count)
        `)
        .eq('role', 'student')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching students:', error);
        toast({
          title: "Error",
          description: "No se pudieron cargar los estudiantes",
          variant: "destructive",
        });
      } else {
        setStudents(data || []);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchModulos = async () => {
    try {
      const { data, error } = await supabase
        .from('modulos')
        .select(`
          id,
          name,
          code,
          num_modulo,
          course:courses (
            id,
            name,
            code
          )
        `)
        .eq('is_active', true)
        .order('code');

      if (error) {
        console.error('Error fetching modulos:', error);
      } else {
        setModulos(data || []);
      }
    } catch (error) {
      console.error('Error:', error);
    }
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

  const handleCreateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      // Validar longitud exacta del código de estudiante
      if (formData.student_code.length !== 9) {
        const msg = formData.student_code.length < 9
          ? `El código debe tener exactamente 9 caracteres (faltan ${9 - formData.student_code.length}).`
          : `El código no puede tener más de 9 caracteres (sobran ${formData.student_code.length - 9}).`;
        setStudentCodeError(msg);
        return;
      }

      // Verificar que el código de estudiante no esté ya registrado
      const { data: existingCode } = await supabase
        .from('profiles')
        .select('id')
        .eq('student_code', formData.student_code)
        .maybeSingle();

      if (existingCode) {
        resetForm();
        setStudentCodeError('Este código de estudiante ya está registrado. Completa nuevamente los datos.');
        return;
      }

      setStudentCodeError('');

      // Generar el apellido completo (last_name)
      const last_name = `${formData.paternal_surname} ${formData.maternal_surname}`.trim();
      
      // Create user in auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: 'TempPassword123!', // Temporary password
        options: {
          data: {
            first_name: formData.first_name,
            last_name: last_name,
            role: 'student'
          }
        }
      });

      if (authError) {
        console.error('Error creating auth user:', authError);
        toast({
          title: "Error",
          description: "No se pudo crear el usuario",
          variant: "destructive",
        });
        return;
      }

      // Update profile with additional data
      if (authData.user) {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            document_type: formData.document_type,
            document_number: formData.document_number,
            student_code: formData.student_code,
            phone: formData.phone || null,
            gender: formData.gender || null,
            birth_date: formData.birth_date || null,
            country: formData.country === 'Otro' ? customCountry : formData.country || null,
            education_level: formData.education_level || null,
            role: 'student'
          })
          .eq('id', authData.user.id);

        if (profileError) {
          console.error('Error updating profile:', profileError);
        }
      }

      toast({
        title: "Éxito",
        description: "Estudiante creado exitosamente. Se ha enviado un email para confirmar la cuenta.",
      });
      setIsCreateModalOpen(false);
      resetForm();
      fetchStudents();
    } catch (error) {
      console.error('Error:', error);
      toast({
        title: "Error",
        description: "Error al crear el estudiante",
        variant: "destructive",
      });
    }
  };

  const handleEditStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!editingStudent) return;

    try {
        // Generar el apellido completo (last_name)
        const last_name = `${formData.paternal_surname} ${formData.maternal_surname}`.trim();
        
        const { error } = await supabase
          .from('profiles')
          .update({
            first_name: formData.first_name,
            last_name: last_name,
            document_type: formData.document_type,
            document_number: formData.document_number,
            student_code: formData.student_code,
            phone: formData.phone || null,
            gender: formData.gender || null,
            birth_date: formData.birth_date || null,
            country: formData.country === 'Otro' ? customCountry : formData.country || null,
            education_level: formData.education_level || null,
          })
          .eq('id', editingStudent.id);      if (error) {
        console.error('Error updating student:', error);
        toast({
          title: "Error",
          description: "No se pudo actualizar el estudiante",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Éxito",
          description: "Estudiante actualizado exitosamente",
        });
        setIsEditModalOpen(false);
        setEditingStudent(null);
        resetForm();
        fetchStudents();
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const handleToggleStudentStatus = async (student: Student) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_active: !student.is_active })
        .eq('id', student.id);

      if (error) {
        console.error('Error toggling student status:', error);
        toast({
          title: "Error",
          description: "No se pudo cambiar el estado del estudiante",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Éxito",
          description: `Estudiante ${!student.is_active ? 'activado' : 'desactivado'} exitosamente`,
        });
        fetchStudents();
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const handleEnrollStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedStudent || !selectedCourseForEnrollment) return;

    try {
      // Check if already enrolled
      const { data: existingEnrollment } = await supabase
        .from('course_enrollments')
        .select('id')
        .eq('student_id', selectedStudent.id)
        .eq('modulo_id', selectedCourseForEnrollment)
        .single();

      if (existingEnrollment) {
        toast({
          title: "Error",
          description: "El estudiante ya está inscrito en este módulo",
          variant: "destructive",
        });
        return;
      }

      const { error } = await supabase
        .from('course_enrollments')
        .insert([{
          student_id: selectedStudent.id,
          modulo_id: selectedCourseForEnrollment,
          enrolled_at: new Date().toISOString(),
          tipo_estudiante: 'nuevo'
        }]);

      if (error) {
        console.error('Error enrolling student:', error);
        toast({
          title: "Error",
          description: "No se pudo inscribir al estudiante",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Éxito",
          description: "Estudiante inscrito exitosamente",
        });
        setIsEnrollModalOpen(false);
        setSelectedCourseForEnrollment('');
        fetchStudentEnrollments(selectedStudent.id);
        fetchStudents();
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const handleUnenrollStudent = async (enrollmentId: string) => {
    if (!confirm('¿Estás seguro de que quieres retirar al estudiante de este curso?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('course_enrollments')
        .delete()
        .eq('id', enrollmentId);

      if (error) {
        console.error('Error unenrolling student:', error);
        toast({
          title: "Error",
          description: "No se pudo retirar al estudiante del curso",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Éxito",
          description: "Estudiante retirado del curso exitosamente",
        });
        if (selectedStudent) {
          fetchStudentEnrollments(selectedStudent.id);
        }
        fetchStudents();
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const openEditModal = (student: Student) => {
    setEditingStudent(student);
    
    // Separar last_name en apellidos paterno y materno si es posible
    const lastNameParts = (student.last_name || '').split(' ');
    const paternal = lastNameParts[0] || '';
    const maternal = lastNameParts.slice(1).join(' ') || '';
    
    // Lista de países estándar
    const standardCountries = ['Perú', 'Argentina', 'Bolivia', 'Brasil', 'Chile', 'Colombia', 
      'Costa Rica', 'Cuba', 'Ecuador', 'El Salvador', 'España', 'Guatemala', 'Honduras', 
      'México', 'Nicaragua', 'Panamá', 'Paraguay', 'Puerto Rico', 'República Dominicana', 
      'Uruguay', 'Venezuela', 'Estados Unidos', 'Canadá'];
    
    const studentCountry = (student as any).country || 'Perú';
    const isStandardCountry = standardCountries.includes(studentCountry);
    
    setFormData({
      document_type: (student as any).document_type || 'DNI',
      document_number: (student as any).document_number || '',
      student_code: (student as any).student_code || '',
      paternal_surname: paternal,
      maternal_surname: maternal,
      first_name: student.first_name,
      email: student.email,
      phone: student.phone || '',
      gender: (student as any).gender || '',
      birth_date: (student as any).birth_date || '',
      country: isStandardCountry ? studentCountry : 'Otro',
      education_level: (student as any).education_level || '',
    });
    
    // Si el país no es estándar, guardarlo en customCountry
    setCustomCountry(isStandardCountry ? '' : studentCountry);
    
    setIsEditModalOpen(true);
  };

  const openEnrollModal = (student: Student) => {
    setSelectedStudent(student);
    fetchStudentEnrollments(student.id);
    setIsEnrollModalOpen(true);
  };

  const resetForm = () => {
    setFormData({
      document_type: 'DNI',
      document_number: '',
      student_code: '',
      paternal_surname: '',
      maternal_surname: '',
      first_name: '',
      email: '',
      phone: '',
      gender: '',
      birth_date: '',
      country: 'Perú',
      education_level: ''
    });
    setCustomCountry('');
    setStudentCodeError('');
  };

  // Filter students based on search and filters
  const filteredStudents = students.filter(student => {
    const matchesSearch = student.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         student.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         student.email.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = filterStatus === 'all' || 
                         (filterStatus === 'active' && student.is_active) ||
                         (filterStatus === 'inactive' && !student.is_active);
    
    return matchesSearch && matchesStatus;
  });

  const StudentForm = ({ onSubmit, isEdit = false }: { onSubmit: (e: React.FormEvent) => void, isEdit?: boolean }) => (
    <form onSubmit={onSubmit} className="space-y-4">
      {/* Tipo y Número de Documento */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="document_type">Tipo de Documento *</Label>
          <Select
            value={formData.document_type}
            onValueChange={(value) => setFormData({ ...formData, document_type: value })}
          >
            <SelectTrigger id="document_type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="DNI">DNI</SelectItem>
              <SelectItem value="CE">Carnet de Extranjería</SelectItem>
              <SelectItem value="PASAPORTE">Pasaporte</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="document_number">Número de Documento *</Label>
          <Input
            id="document_number"
            value={formData.document_number}
            onChange={(e) => setFormData({ ...formData, document_number: e.target.value })}
            required
            placeholder="Ej: 12345678"
          />
        </div>
      </div>

      {/* Código del Estudiante */}
      <div className="space-y-2">
        <Label htmlFor="student_code">Código del Estudiante *</Label>
        <Input
          id="student_code"
          value={formData.student_code}
          onChange={(e) => {
            setFormData({ ...formData, student_code: e.target.value });
            if (studentCodeError) setStudentCodeError('');
          }}
          required
          maxLength={9}
          placeholder="Ej: EST001234"
          className={studentCodeError ? 'border-destructive focus-visible:ring-destructive' : ''}
        />
        <p className={`text-xs ${formData.student_code.length === 9 ? 'text-green-600' : 'text-muted-foreground'}`}>
          {formData.student_code.length}/9 caracteres
        </p>
        {studentCodeError && (
          <p className="text-xs text-destructive flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            {studentCodeError}
          </p>
        )}
      </div>

      {/* Apellidos */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="paternal_surname">Apellido Paterno *</Label>
          <Input
            id="paternal_surname"
            value={formData.paternal_surname}
            onChange={(e) => setFormData({ ...formData, paternal_surname: e.target.value })}
            required
            placeholder="Apellido paterno"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="maternal_surname">Apellido Materno *</Label>
          <Input
            id="maternal_surname"
            value={formData.maternal_surname}
            onChange={(e) => setFormData({ ...formData, maternal_surname: e.target.value })}
            required
            placeholder="Apellido materno"
          />
        </div>
      </div>

      {/* Nombres */}
      <div className="space-y-2">
        <Label htmlFor="first_name">Nombres *</Label>
        <Input
          id="first_name"
          value={formData.first_name}
          onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
          required
          placeholder="Nombres del estudiante"
        />
      </div>

      {/* Email */}
      <div className="space-y-2">
        <Label htmlFor="email">Email *</Label>
        <Input
          id="email"
          type="email"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          required
          disabled={isEdit} // Cannot change email once created
          placeholder="correo@ejemplo.com"
        />
      </div>

      {/* Teléfono y Sexo */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="phone">Teléfono (con código de país)</Label>
          <Input
            id="phone"
            type="tel"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            placeholder="+51 987654321"
          />
          <p className="text-xs text-muted-foreground">
            Incluye el código de país (Ej: +51 para Perú)
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="gender">Sexo</Label>
          <Select
            value={formData.gender}
            onValueChange={(value) => setFormData({ ...formData, gender: value })}
          >
            <SelectTrigger id="gender">
              <SelectValue placeholder="Seleccionar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="M">Masculino</SelectItem>
              <SelectItem value="F">Femenino</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Fecha de Nacimiento */}
      <div className="space-y-2">
        <Label htmlFor="birth_date">Fecha de Nacimiento</Label>
        <Input
          id="birth_date"
          type="date"
          value={formData.birth_date}
          onChange={(e) => setFormData({ ...formData, birth_date: e.target.value })}
        />
      </div>

      {/* País */}
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

      {/* Nivel Educativo */}
      <div className="space-y-2">
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

      <div className="flex justify-end gap-2 pt-4">
        <Button 
          type="button" 
          variant="outline" 
          onClick={() => {
            if (isEdit) {
              setIsEditModalOpen(false);
              setEditingStudent(null);
            } else {
              setIsCreateModalOpen(false);
            }
            resetForm();
          }}
        >
          Cancelar
        </Button>
        <Button type="submit">
          {isEdit ? 'Actualizar Estudiante' : 'Crear Estudiante'}
        </Button>
      </div>
    </form>
  );

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-1/3 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-32 bg-muted rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Gestión de Estudiantes</h1>
          <p className="text-muted-foreground">Administra todos los estudiantes del sistema</p>
        </div>
        <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setIsCreateModalOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Nuevo Estudiante
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Crear Nuevo Estudiante</DialogTitle>
            </DialogHeader>
            <StudentForm onSubmit={handleCreateStudent} />
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <Card className="bg-gradient-card shadow-card border-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="search">Buscar</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Buscar estudiantes..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="filter-status">Estado</Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  <SelectItem value="active">Activos</SelectItem>
                  <SelectItem value="inactive">Inactivos</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button 
                variant="outline" 
                onClick={() => {
                  setSearchTerm('');
                  setFilterStatus('all');
                }}
                className="w-full"
              >
                Limpiar Filtros
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-card shadow-card border-0">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Estudiantes</p>
                <p className="text-2xl font-bold">{students.length}</p>
              </div>
              <Users className="w-8 h-8 text-primary" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-card shadow-card border-0">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Estudiantes Activos</p>
                <p className="text-2xl font-bold">{students.filter(s => s.is_active).length}</p>
              </div>
              <UserCheck className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-card shadow-card border-0">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Estudiantes Inactivos</p>
                <p className="text-2xl font-bold">{students.filter(s => !s.is_active).length}</p>
              </div>
              <UserX className="w-8 h-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-card shadow-card border-0">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Inscripciones</p>
                <p className="text-2xl font-bold">
                  {students.reduce((acc, student) => acc + (student.enrollments?.[0]?.count || 0), 0)}
                </p>
              </div>
              <BookOpen className="w-8 h-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Students Table */}
      <Card className="bg-gradient-card shadow-card border-0">
        <CardHeader>
          <CardTitle>Lista de Estudiantes ({filteredStudents.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Estudiante</TableHead>
                  <TableHead>Contacto</TableHead>
                  <TableHead>Inscripciones</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Fecha Registro</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStudents.map((student) => (
                  <TableRow key={student.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{student.first_name} {student.last_name}</div>
                        <div className="text-sm text-muted-foreground flex items-center gap-1">
                          <Mail className="w-3 h-3" />
                          {student.email}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {student.phone && (
                          <div className="text-sm flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            {student.phone}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <BookOpen className="w-4 h-4" />
                        <span>{student.enrollments?.[0]?.count || 0} cursos</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={student.is_active ? "default" : "secondary"}>
                        {student.is_active ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {formatDate(student.created_at)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditModal(student)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEnrollModal(student)}
                        >
                          <BookOpen className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleToggleStudentStatus(student)}
                        >
                          {student.is_active ? 'Desactivar' : 'Activar'}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {filteredStudents.length === 0 && (
            <div className="text-center py-8">
              <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No se encontraron estudiantes</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Student Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar Estudiante</DialogTitle>
          </DialogHeader>
          <StudentForm onSubmit={handleEditStudent} isEdit={true} />
        </DialogContent>
      </Dialog>

      {/* Enrollment Management Modal */}
      <Dialog open={isEnrollModalOpen} onOpenChange={setIsEnrollModalOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              Gestión de Inscripciones - {selectedStudent?.first_name} {selectedStudent?.last_name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            {/* Enroll in new course */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Inscribir en nuevo curso</h3>
              <form onSubmit={handleEnrollStudent} className="flex gap-2">
                <Select value={selectedCourseForEnrollment} onValueChange={setSelectedCourseForEnrollment}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Seleccionar módulo" />
                  </SelectTrigger>
                  <SelectContent>
                    {modulos
                      .filter(modulo => !studentEnrollments.some(enrollment => enrollment.modulo_id === modulo.id))
                      .map((modulo) => (
                        <SelectItem key={modulo.id} value={modulo.id}>
                          {modulo.course.name} - Módulo {modulo.num_modulo}: {modulo.name} ({modulo.code})
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <Button type="submit" disabled={!selectedCourseForEnrollment}>
                  Inscribir
                </Button>
              </form>
            </div>

            {/* Current enrollments */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Inscripciones actuales ({studentEnrollments.length})</h3>
              {studentEnrollments.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Curso</TableHead>
                      <TableHead>Módulo</TableHead>
                      <TableHead>Código</TableHead>
                      <TableHead>Fecha Inscripción</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {studentEnrollments.map((enrollment) => {
                      return (
                        <TableRow key={enrollment.id}>
                          <TableCell className="font-medium">{enrollment.modulo.course.name}</TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span>Módulo {enrollment.modulo.num_modulo}</span>
                              <span className="text-sm text-muted-foreground">{enrollment.modulo.name}</span>
                            </div>
                          </TableCell>
                          <TableCell>{enrollment.modulo.code}</TableCell>
                          <TableCell>{formatDate(enrollment.enrolled_at)}</TableCell>
                          <TableCell>
                            <Badge 
                              variant={enrollment.tipo_estudiante === 'nuevo' ? 'default' : 'secondary'}
                              className="w-fit"
                            >
                              {enrollment.tipo_estudiante === 'nuevo' ? 'Nuevo' : 'Antiguo'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleUnenrollStudent(enrollment.id)}
                              title="Dar de baja del módulo"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
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
    </div>
  );
};

export default AdminStudentManagement;