import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import {
  Modulo,
  ModuloInsert,
  Course,
  Programa,
  ModuloSchedule,
  generateModuloCode,
} from '@/integrations/supabase/peri-types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
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
import { Plus, Edit, Trash2, ArrowLeft, Calendar, ExternalLink } from 'lucide-react';

interface Profile {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
}

const DIAS_SEMANA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

export default function AdminModulosManagement() {
  const { courseId: urlCourseId } = useParams();
  const navigate = useNavigate();
  
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(urlCourseId || null);
  const [course, setCourse] = useState<Course | null>(null);
  const [programa, setPrograma] = useState<Programa | null>(null);
  const [modulos, setModulos] = useState<Modulo[]>([]);
  const [teachers, setTeachers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingModulo, setEditingModulo] = useState<Modulo | null>(null);
  
  const [formData, setFormData] = useState<Partial<ModuloInsert>>({
    name: '',
    num_modulo: 1,
    description: '',
    code: '',
    course_id: selectedCourseId || '',
    teacher_principal_id: '',
    academic_year: '',
    semester_year: '',
    is_active: true,
    start_date: '',
    end_date: '',
    schedule: {},
    aditional_teachers: [],
  });

  const [schedule, setSchedule] = useState<ModuloSchedule>({});
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [horarioInicio, setHorarioInicio] = useState('09:00');
  const [horarioFin, setHorarioFin] = useState('11:00');

  useEffect(() => {
    if (urlCourseId) {
      // Si viene de URL, cargar directamente esa edición
      setSelectedCourseId(urlCourseId);
      fetchData(urlCourseId);
    } else {
      // Si no, cargar lista de ediciones
      fetchCourses();
    }
  }, [urlCourseId]);

  useEffect(() => {
    if (selectedCourseId && !urlCourseId) {
      fetchData(selectedCourseId);
    }
  }, [selectedCourseId]);

  // Detectar día de la semana automáticamente para módulo 1
  useEffect(() => {
    if (formData.num_modulo === 1 && formData.start_date && selectedDays.length === 0) {
      const diaInicio = getDiaSemanaNombre(new Date(formData.start_date));
      const newSchedule: ModuloSchedule = {
        [diaInicio]: `${horarioInicio}-${horarioFin}`
      };
      setSelectedDays([diaInicio]);
      setSchedule(newSchedule);
      setFormData({ ...formData, schedule: newSchedule });
    }
  }, [formData.start_date, formData.num_modulo]);

  const fetchCourses = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('courses')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCourses(data || []);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: `Error al cargar ediciones: ${error.message}`,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchData = async (courseId: string) => {
    try {
      setLoading(true);

      // Cargar edición
      const { data: courseData, error: courseError } = await supabase
        .from('courses')
        .select('*')
        .eq('id', courseId)
        .single();

      if (courseError) throw courseError;
      setCourse(courseData as any);

      // Cargar programa
      const { data: programaData, error: programaError } = await supabase
        .from('programas' as any)
        .select('*')
        .eq('id', (courseData as any).program_id)
        .single();

      if (programaError) throw programaError;
      setPrograma(programaData as any);

      // Cargar módulos
      const { data: modulosData, error: modulosError } = await supabase
        .from('modulos' as any)
        .select('*')
        .eq('course_id', courseId)
        .order('num_modulo');

      if (modulosError) throw modulosError;
      setModulos(modulosData as any || []);

      // Cargar profesores
      const { data: teachersData, error: teachersError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email')
        .eq('role', 'teacher')
        .order('first_name');

      if (teachersError) throw teachersError;
      setTeachers(teachersData || []);

      // Inicializar datos del formulario
      setFormData(prev => ({
        ...prev,
        teacher_principal_id: (courseData as any).teacher_principal_id,
        academic_year: (courseData as any).academic_year,
        semester_year: (courseData as any).academic_year + '-' + (courseData as any).semester,
      }));

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

  const handleOpenDialog = (modulo?: Modulo) => {
    if (modulo) {
      setEditingModulo(modulo);
      setFormData({
        name: modulo.name,
        num_modulo: modulo.num_modulo,
        description: modulo.description,
        code: modulo.code,
        course_id: modulo.course_id,
        teacher_principal_id: modulo.teacher_principal_id,
        academic_year: modulo.academic_year,
        semester_year: modulo.semester_year,
        is_active: modulo.is_active,
        start_date: modulo.start_date,
        end_date: modulo.end_date,
        schedule: modulo.schedule || {},
        aditional_teachers: modulo.aditional_teachers || [],
      });
      setSchedule(modulo.schedule || {});
      // Cargar días seleccionados desde el schedule
      const diasSeleccionados = Object.keys(modulo.schedule || {});
      
      // Si es módulo 1 y no hay días seleccionados, marcar automáticamente el día de inicio
      if (modulo.num_modulo === 1 && diasSeleccionados.length === 0 && modulo.start_date) {
        const diaInicio = getDiaSemanaNombre(new Date(modulo.start_date));
        setSelectedDays([diaInicio]);
      } else {
        setSelectedDays(diasSeleccionados);
      }
      
      // Intentar extraer horario del primer día
      const primerDia = Object.values(modulo.schedule || {})[0];
      if (primerDia && typeof primerDia === 'string' && primerDia.includes('-')) {
        const [inicio, fin] = primerDia.split('-');
        setHorarioInicio(inicio.trim());
        setHorarioFin(fin.trim());
      }
    } else {
      const nextNum = modulos.length > 0 
        ? Math.max(...modulos.map(m => m.num_modulo)) + 1 
        : 1;
      
      setEditingModulo(null);
      setFormData({
        name: `Módulo ${nextNum}`, // Auto-rellenar nombre
        num_modulo: nextNum,
        description: '',
        code: '',
        course_id: selectedCourseId || '',
        teacher_principal_id: course?.teacher_principal_id || '',
        academic_year: course?.academic_year || '',
        semester_year: course?.academic_year + '-' + course?.semester || '',
        is_active: true,
        start_date: '',
        end_date: '',
        schedule: {},
        aditional_teachers: [],
      });
      setSchedule({});
      setSelectedDays([]);
      setHorarioInicio('09:00');
      setHorarioFin('11:00');
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingModulo(null);
    setSchedule({});
  };

  const getDiaSemanaNombre = (fecha: Date): string => {
    const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    return dias[fecha.getDay()];
  };

  const handleScheduleChange = (dia: string, horario: string) => {
    const newSchedule = { ...schedule };
    if (horario) {
      newSchedule[dia] = horario;
    } else {
      delete newSchedule[dia];
    }
    setSchedule(newSchedule);
  };

  const handleDayToggle = (dia: string) => {
    const newSelectedDays = selectedDays.includes(dia)
      ? selectedDays.filter(d => d !== dia)
      : [...selectedDays, dia];
    
    setSelectedDays(newSelectedDays);
    
    // Actualizar schedule con el horario actual
    const newSchedule: ModuloSchedule = {};
    newSelectedDays.forEach(day => {
      newSchedule[day] = `${horarioInicio}-${horarioFin}`;
    });
    setSchedule(newSchedule);
    setFormData({ ...formData, schedule: newSchedule });
  };

  const handleHorarioChange = (inicio: string, fin: string) => {
    setHorarioInicio(inicio);
    setHorarioFin(fin);
    
    // Actualizar todos los días seleccionados con el nuevo horario
    const newSchedule: ModuloSchedule = {};
    selectedDays.forEach(day => {
      newSchedule[day] = `${inicio}-${fin}`;
    });
    setSchedule(newSchedule);
    setFormData({ ...formData, schedule: newSchedule });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.start_date || !formData.end_date) {
      toast({
        title: 'Error',
        description: 'Complete todos los campos obligatorios',
        variant: 'destructive',
      });
      return;
    }

    try {
      // Generar código si no existe
      let code = formData.code;
      // Forzamos que use siempre el código de la EDICIÓN (course.code)
      if (course && formData.num_modulo) {
        code = `${course.code}-M${formData.num_modulo}`;
      }
      const finalCode = course && formData.num_modulo 
        ? `${course.code}-M${formData.num_modulo}` 
        : formData.code;

      const dataToSave = {
        ...formData,
        code: finalCode,
        schedule,
      };

      if (editingModulo) {
        // Actualizar
        const { error } = await supabase
          .from('modulos' as any)
          .update(dataToSave)
          .eq('id', editingModulo.id);

        if (error) throw error;

        toast({
          title: 'Éxito',
          description: 'Módulo actualizado correctamente',
        });
      } else {
        // Crear
        const { error } = await supabase
          .from('modulos' as any)
          .insert(dataToSave as ModuloInsert);

        if (error) throw error;

        toast({
          title: 'Éxito',
          description: 'Módulo creado correctamente',
        });
      }

      handleCloseDialog();
      if (selectedCourseId) {
        fetchData(selectedCourseId);
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: `Error al guardar módulo: ${error.message}`,
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Está seguro de eliminar este módulo?')) return;

    try {
      const { error } = await supabase
        .from('modulos' as any)
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Éxito',
        description: 'Módulo eliminado correctamente',
      });

      if (selectedCourseId) {
        fetchData(selectedCourseId);
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: `Error al eliminar módulo: ${error.message}`,
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return <div className="container mx-auto py-8 text-center">Cargando...</div>;
  }

  // Si no hay courseId seleccionado, mostrar selector de edición
  if (!selectedCourseId) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl flex items-center gap-2">
              <Calendar className="h-6 w-6" />
              Gestión de Módulos
            </CardTitle>
            <CardDescription>
              Seleccione una edición para gestionar sus módulos
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label>Seleccionar Edición</Label>
              <Select
                value={selectedCourseId || ''}
                onValueChange={setSelectedCourseId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccione una edición" />
                </SelectTrigger>
                <SelectContent>
                  {courses.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} - {c.code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!course || !programa) {
    return <div className="container mx-auto py-8 text-center">Edición no encontrada</div>;
  }

  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            {urlCourseId && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/admin/courses')}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <div className="flex-1">
              <CardTitle className="text-2xl flex items-center gap-2">
                <Calendar className="h-6 w-6" />
                Módulos de {course.name}
              </CardTitle>
              <CardDescription>
                Programa: {programa.name} | Código: {course.code}
              </CardDescription>
            </div>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="mr-2 h-4 w-4" />
              Nuevo Módulo
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Módulo</TableHead>
                <TableHead>Código</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Profesor</TableHead>
                <TableHead>Fechas</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {modulos.map((modulo) => {
                const teacher = teachers.find(t => t.id === modulo.teacher_principal_id);
                return (
                  <TableRow key={modulo.id}>
                    <TableCell className="font-medium">M{modulo.num_modulo}</TableCell>
                    <TableCell>{modulo.code}</TableCell>
                    <TableCell>{modulo.name}</TableCell>
                    <TableCell>
                      {teacher ? `${teacher.first_name} ${teacher.last_name}` : '-'}
                    </TableCell>
                    <TableCell>
                      {modulo.start_date} - {modulo.end_date}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`px-2 py-1 rounded-full text-xs ${
                          modulo.is_active
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {modulo.is_active ? 'Activo' : 'Inactivo'}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {/* --- 1. BOTÓN NUEVO: IR AL AULA --- */}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/courses/${modulo.id}`)}
                          className="text-blue-600 border-blue-200 hover:bg-blue-50"
                          title="Ir al Aula Virtual"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                        
                        {/* --- 2. BOTÓN EDITAR (CORREGIDO) --- */}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenDialog(modulo)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDelete(modulo.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialog para crear/editar módulo */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingModulo ? 'Editar Módulo' : 'Nuevo Módulo'}
            </DialogTitle>
            <DialogDescription>
              Complete los datos del módulo
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              {/* Número y Nombre */}
              <div className="grid grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="num_modulo">Nº Módulo *</Label>
                  <Input
                    id="num_modulo"
                    type="number"
                    min="1"
                    value={formData.num_modulo}
                    onChange={(e) => {
                      const numModulo = parseInt(e.target.value);
                      setFormData({ 
                        ...formData, 
                        num_modulo: numModulo,
                        name: `Módulo ${numModulo}` // Actualizar nombre automáticamente
                      });
                    }}
                    required
                  />
                </div>
                <div className="col-span-3 space-y-2">
                  <Label htmlFor="name">Nombre del Módulo *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    placeholder="Ej: Módulo 1"
                    required
                  />
                </div>
              </div>

              {/* Código */}
              <div className="space-y-2">
                <Label htmlFor="code">Código (auto-generado)</Label>
                <Input
                  id="code"
                  value={formData.code}
                  onChange={(e) =>
                    setFormData({ ...formData, code: e.target.value })
                  }
                  placeholder="Se genera automáticamente"
                  disabled={!editingModulo}
                />
              </div>

              {/* Descripción */}
              <div className="space-y-2">
                <Label htmlFor="description">Descripción</Label>
                <Textarea
                  id="description"
                  value={formData.description || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  rows={2}
                />
              </div>

              {/* Profesor */}
              <div className="space-y-2">
                <Label htmlFor="teacher_principal_id">Profesor Principal *</Label>
                <Select
                  value={formData.teacher_principal_id}
                  onValueChange={(value) =>
                    setFormData({ ...formData, teacher_principal_id: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccione un profesor" />
                  </SelectTrigger>
                  <SelectContent>
                    {teachers.map((teacher) => (
                      <SelectItem key={teacher.id} value={teacher.id}>
                        {teacher.first_name} {teacher.last_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Fechas */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start_date">
                    Fecha de Inicio *
                    {editingModulo?.num_modulo === 1 && (
                      <span className="text-sm text-gray-500 ml-2">(Bloqueada para Módulo 1)</span>
                    )}
                  </Label>
                  <Input
                    id="start_date"
                    type="date"
                    value={formData.start_date}
                    onChange={(e) =>
                      setFormData({ ...formData, start_date: e.target.value })
                    }
                    disabled={editingModulo?.num_modulo === 1}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end_date">Fecha de Fin *</Label>
                  <Input
                    id="end_date"
                    type="date"
                    value={formData.end_date}
                    onChange={(e) =>
                      setFormData({ ...formData, end_date: e.target.value })
                    }
                    required
                  />
                </div>
              </div>

              {/* Horario */}
              <div className="space-y-3">
                <Label>Horario Semanal</Label>
                
                {/* Selección de días */}
                <div>
                  <Label className="text-sm text-gray-600 mb-2 block">Días de clase:</Label>
                  <div className="flex flex-wrap gap-2">
                    {DIAS_SEMANA.map((dia) => (
                      <label key={dia} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedDays.includes(dia)}
                          onChange={() => handleDayToggle(dia)}
                          className="w-4 h-4"
                        />
                        <span className="text-sm">{dia}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Rango de horas */}
                {selectedDays.length > 0 && (
                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <div className="space-y-2">
                      <Label htmlFor="horario_inicio" className="text-sm text-gray-600">
                        Hora de inicio:
                      </Label>
                      <Input
                        id="horario_inicio"
                        type="time"
                        value={horarioInicio}
                        onChange={(e) => handleHorarioChange(e.target.value, horarioFin)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="horario_fin" className="text-sm text-gray-600">
                        Hora de fin:
                      </Label>
                      <Input
                        id="horario_fin"
                        type="time"
                        value={horarioFin}
                        onChange={(e) => handleHorarioChange(horarioInicio, e.target.value)}
                      />
                    </div>
                  </div>
                )}

                {/* Vista previa del horario */}
                {selectedDays.length > 0 && (
                  <div className="text-sm text-gray-600 pt-2">
                    <strong>Vista previa:</strong> {selectedDays.join(', ')} de {horarioInicio} a {horarioFin}
                  </div>
                )}
              </div>

              {/* Profesores Adicionales */}
              <div className="space-y-2">
                <Label htmlFor="aditional_teachers">Profesores Adicionales</Label>
                <Select
                  value=""
                  onValueChange={(value) => {
                    const current = formData.aditional_teachers || [];
                    if (!current.includes(value)) {
                      setFormData({ 
                        ...formData, 
                        aditional_teachers: [...current, value] 
                      });
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Agregar profesor" />
                  </SelectTrigger>
                  <SelectContent>
                    {teachers
                      .filter(t => t.id !== formData.teacher_principal_id)
                      .filter(t => !formData.aditional_teachers?.includes(t.id))
                      .map((teacher) => (
                        <SelectItem key={teacher.id} value={teacher.id}>
                          {teacher.first_name} {teacher.last_name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                
                {/* Lista de profesores adicionales */}
                {formData.aditional_teachers && formData.aditional_teachers.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {formData.aditional_teachers.map((teacherId) => {
                      const teacher = teachers.find(t => t.id === teacherId);
                      return teacher ? (
                        <span
                          key={teacherId}
                          className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
                        >
                          {teacher.first_name} {teacher.last_name}
                          <button
                            type="button"
                            onClick={() => {
                              setFormData({
                                ...formData,
                                aditional_teachers: formData.aditional_teachers?.filter(id => id !== teacherId)
                              });
                            }}
                            className="ml-1 hover:text-blue-600"
                          >
                            ×
                          </button>
                        </span>
                      ) : null;
                    })}
                  </div>
                )}
              </div>

              {/* Estado */}
              <div className="flex items-center space-x-2">
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, is_active: checked })
                  }
                />
                <Label htmlFor="is_active">Módulo activo</Label>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCloseDialog}>
                Cancelar
              </Button>
              <Button type="submit">
                {editingModulo ? 'Actualizar' : 'Crear'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}