import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import {
  Course,
  CourseWithRelations,
  Programa,
  generateCourseCode,
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { Plus, Edit, Eye, GraduationCap, Calendar, Trash2 } from 'lucide-react';

interface Profile {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
}

export default function AdminEdicionesManagement() {
  const navigate = useNavigate();
  const [courses, setCourses] = useState<CourseWithRelations[]>([]);
  const [programas, setProgramas] = useState<Programa[]>([]);
  const [teachers, setTeachers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Cargar ediciones con relaciones
      const { data: coursesData, error: coursesError } = await supabase
        .from('courses')
        .select(`
          *,
          programa:programas(*),
          teacher:profiles!courses_teacher_principal_id_fkey(id, first_name, last_name, email)
        `)
        .order('created_at', { ascending: false });

      if (coursesError) throw coursesError;

      // Cargar programas activos
      const { data: programasData, error: programasError } = await supabase
        .from('programas' as any)
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (programasError) throw programasError;

      // Cargar profesores
      const { data: teachersData, error: teachersError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email, role')
        .eq('role', 'teacher')
        .order('first_name');

      if (teachersError) throw teachersError;

      setCourses(coursesData as any || []);
      setProgramas(programasData as any || []);
      setTeachers(teachersData || []);
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

  const handleViewModulos = (courseId: string) => {
    navigate(`/admin/courses?tab=modulos&courseId=${courseId}`);
  };

  const handleCreateEdicion = () => {
    navigate('/admin/ediciones/nueva');
  };

  const handleEditEdicion = (courseId: string) => {
    navigate(`/admin/ediciones/${courseId}/editar`);
  };

  const handleDeleteEdicion = async (courseId: string, courseName: string) => {
    if (!confirm(`¿Está seguro de eliminar la edición "${courseName}"? Esto también eliminará todos sus módulos.`)) {
      return;
    }

    try {
      // Los módulos se eliminarán automáticamente por CASCADE
      const { error } = await supabase
        .from('courses')
        .delete()
        .eq('id', courseId);

      if (error) throw error;

      toast({
        title: 'Éxito',
        description: 'Edición y sus módulos eliminados correctamente',
      });

      fetchData();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: `Error al eliminar: ${error.message}`,
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl flex items-center gap-2">
                <GraduationCap className="h-6 w-6" />
                Gestión de Ediciones
              </CardTitle>
              <CardDescription>
                Ediciones de los programas educativos disponibles
              </CardDescription>
            </div>
            <Button onClick={handleCreateEdicion}>
              <Plus className="mr-2 h-4 w-4" />
              Nueva Edición
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Cargando...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Programa</TableHead>
                  <TableHead>Profesor</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead>Módulos</TableHead>
                  <TableHead>Material</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {courses.map((course) => (
                  <TableRow key={course.id}>
                    <TableCell className="font-medium">{course.code}</TableCell>
                    <TableCell>{course.name}</TableCell>
                    <TableCell>{course.programa?.name || '-'}</TableCell>
                    <TableCell>
                      {course.teacher
                        ? `${course.teacher.first_name} ${course.teacher.last_name}`
                        : '-'}
                    </TableCell>
                    <TableCell>
                      {course.academic_year} - {course.semester}
                    </TableCell>
                    <TableCell>{course.numero_modulos}</TableCell>
                    <TableCell>
                      <span
                        className={`px-2 py-1 rounded-full text-xs ${
                          course.material === 'book'
                            ? 'bg-blue-100 text-blue-800'
                            : course.material === 'kit'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {course.material === 'book'
                          ? 'Libro'
                          : course.material === 'kit'
                          ? 'Kit'
                          : 'Ninguno'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span
                        className={`px-2 py-1 rounded-full text-xs ${
                          course.is_active
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {course.is_active ? 'Activo' : 'Inactivo'}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewModulos(course.id)}
                          title="Ver módulos"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditEdicion(course.id)}
                          title="Editar"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDeleteEdicion(course.id, course.name)}
                          title="Eliminar"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
