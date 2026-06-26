import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { formatDate } from '@/lib/dateUtils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  TableRow 
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { 
  BarChart3, 
  Download, 
  Users, 
  BookOpen, 
  TrendingUp,
  Calendar,
  GraduationCap,
  Search
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface CourseStats {
  id: string;
  name: string;
  code: string;
  program_name: string;
  program_id: string | null;
  is_active: boolean;
  total_students: number;
  active_students: number;
  completed_students: number;
  average_grade: number;
  total_assignments: number;
  total_exams: number;
  completion_rate: number;
}

interface ModuleStats {
  id: string;
  name: string;
  code: string;
  course_name: string;
  teacher_name: string;
  total_enrolled: number;
  start_date: string;
  end_date: string;
  is_active: boolean;
}

const AdminCourseReport = () => {
  const [loading, setLoading] = useState(true);
  const [courseStats, setCourseStats] = useState<CourseStats[]>([]);
  const [moduleStats, setModuleStats] = useState<ModuleStats[]>([]);
  const [programs, setPrograms] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterProgram, setFilterProgram] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [globalStats, setGlobalStats] = useState({
    totalCourses: 0,
    totalModules: 0,
    totalEnrollments: 0,
    averageStudentsPerCourse: 0,
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Obtener programas para filtros
      const { data: programsData, error: programsError } = await supabase
        .from('programas')
        .select('id, name, code')
        .eq('is_active', true)
        .order('name');

      if (programsError) throw programsError;
      setPrograms(programsData || []);

      // Obtener cursos con estadísticas
      const { data: courses, error: coursesError } = await supabase
        .from('courses')
        .select(`
          id,
          name,
          code,
          is_active,
          program:programas(id, name)
        `)
        .order('name');

      if (coursesError) throw coursesError;

      // Obtener módulos con estadísticas
      const { data: modules, error: modulesError } = await supabase
        .from('modulos' as any)
        .select(`
          id,
          name,
          code,
          start_date,
          end_date,
          is_active,
          course:courses(name),
          teacher:profiles!modulos_teacher_principal_id_fkey(first_name, last_name)
        `)
        .order('start_date', { ascending: false });

      if (modulesError) throw modulesError;

      // Obtener todas las inscripciones
      const { data: enrollments, error: enrollmentsError } = await supabase
        .from('course_enrollments')
        .select(`
          id, 
          modulo_id,
          student_id,
          is_active,
          modulo:modulos!course_enrollments_modulo_id_fkey(course_id)
        `);

      if (enrollmentsError) throw enrollmentsError;

      // Obtener tareas y exámenes
      const { data: assignments, error: assignmentsError } = await supabase
        .from('assignments')
        .select('id, course_id');

      if (assignmentsError) throw assignmentsError;

      const { data: exams, error: examsError } = await supabase
        .from('exams' as any)
        .select('id, course_id');

      if (examsError) throw examsError;

      // Procesar estadísticas por curso
      const courseStatsData: CourseStats[] = (courses || []).map((course: any) => {
        const courseEnrollments = (enrollments || []).filter(
          (e: any) => e.modulo?.course_id === course.id
        );
        
        // Obtener estudiantes únicos (evitar contar el mismo estudiante varias veces)
        const uniqueStudentIds = new Set(courseEnrollments.map((e: any) => e.student_id));
        const uniqueStudents = Array.from(uniqueStudentIds);
        
        const activeEnrollments = courseEnrollments.filter((e: any) => e.is_active === true);
        const uniqueActiveStudentIds = new Set(activeEnrollments.map((e: any) => e.student_id));
        
        const inactiveEnrollments = courseEnrollments.filter((e: any) => e.is_active === false);
        const uniqueInactiveStudentIds = new Set(inactiveEnrollments.map((e: any) => e.student_id));
        
        // Las calificaciones finales no están disponibles en course_enrollments
        const averageGrade = 0;

        const courseAssignments = (assignments || []).filter((a: any) => a.course_id === course.id);
        const courseExams = (exams || []).filter((e: any) => e.course_id === course.id);

        return {
          id: course.id,
          name: course.name,
          code: course.code,
          program_name: course.program?.name || 'Sin programa',
          program_id: course.program?.id || null,
          is_active: course.is_active,
          total_students: uniqueStudents.length,
          active_students: uniqueActiveStudentIds.size,
          completed_students: uniqueInactiveStudentIds.size,
          average_grade: averageGrade,
          total_assignments: courseAssignments.length,
          total_exams: courseExams.length,
          completion_rate: uniqueStudents.length > 0
            ? (uniqueInactiveStudentIds.size / uniqueStudents.length) * 100
            : 0,
        };
      });

      // Procesar estadísticas por módulo
      const moduleStatsData: ModuleStats[] = (modules || []).map((module: any) => {
        const moduleEnrollments = (enrollments || []).filter(
          (e: any) => e.modulo_id === module.id
        );
        
        // Contar estudiantes únicos en el módulo
        const uniqueStudentIds = new Set(moduleEnrollments.map((e: any) => e.student_id));
        const enrolledCount = uniqueStudentIds.size;

        return {
          id: module.id,
          name: module.name,
          code: module.code,
          course_name: module.course?.name || 'Sin curso',
          teacher_name: module.teacher
            ? `${module.teacher.first_name} ${module.teacher.last_name}`
            : 'Sin asignar',
          total_enrolled: enrolledCount,
          start_date: module.start_date,
          end_date: module.end_date,
          is_active: module.is_active,
        };
      });

      setCourseStats(courseStatsData);
      setModuleStats(moduleStatsData);

      // Calcular estadísticas globales
      // Contar estudiantes únicos totales (sin duplicados entre cursos/módulos)
      const allUniqueStudentIds = new Set(
        (enrollments || []).map((e: any) => e.student_id)
      );
      const totalEnrollments = allUniqueStudentIds.size;
      const totalCourses = courses?.length || 0;
      
      setGlobalStats({
        totalCourses,
        totalModules: modules?.length || 0,
        totalEnrollments,
        averageStudentsPerCourse: totalCourses > 0 ? totalEnrollments / totalCourses : 0,
      });

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

  // Filtrar cursos
  const filteredCourses = courseStats.filter(course => {
    const matchesSearch = searchTerm === '' || 
      course.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      course.code.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesProgram = filterProgram === 'all' || course.program_id === filterProgram;
    const matchesStatus = filterStatus === 'all' || 
      (filterStatus === 'active' && course.is_active) ||
      (filterStatus === 'inactive' && !course.is_active);
    
    return matchesSearch && matchesProgram && matchesStatus;
  });

  const exportToExcel = () => {
    try {
      // Hoja 1: Estadísticas por curso
      const courseData = courseStats.map(course => ({
        'Código': course.code,
        'Nombre del Curso': course.name,
        'Programa': course.program_name,
        'Total Estudiantes': course.total_students,
        'Estudiantes Activos': course.active_students,
        'Estudiantes Completados': course.completed_students,
        'Promedio de Notas': course.average_grade.toFixed(2),
        'Total Tareas': course.total_assignments,
        'Total Exámenes': course.total_exams,
        'Tasa de Completitud (%)': course.completion_rate.toFixed(1),
      }));

      // Hoja 2: Estadísticas por módulo
      const moduleData = moduleStats.map(module => ({
        'Código': module.code,
        'Nombre del Módulo': module.name,
        'Curso': module.course_name,
        'Docente': module.teacher_name,
        'Estudiantes Inscritos': module.total_enrolled,
        'Fecha Inicio': formatDate(module.start_date),
        'Fecha Fin': formatDate(module.end_date),
        'Estado': module.is_active ? 'Activo' : 'Inactivo',
      }));

      // Hoja 3: Resumen global
      const summaryData = [
        { Métrica: 'Total de Cursos', Valor: globalStats.totalCourses },
        { Métrica: 'Total de Módulos', Valor: globalStats.totalModules },
        { Métrica: 'Total de Inscripciones', Valor: globalStats.totalEnrollments },
        { Métrica: 'Promedio de Estudiantes por Curso', Valor: globalStats.averageStudentsPerCourse.toFixed(1) },
      ];

      const wb = XLSX.utils.book_new();
      const ws1 = XLSX.utils.json_to_sheet(courseData);
      const ws2 = XLSX.utils.json_to_sheet(moduleData);
      const ws3 = XLSX.utils.json_to_sheet(summaryData);

      XLSX.utils.book_append_sheet(wb, ws1, 'Estadísticas por Curso');
      XLSX.utils.book_append_sheet(wb, ws2, 'Estadísticas por Módulo');
      XLSX.utils.book_append_sheet(wb, ws3, 'Resumen Global');

      const fileName = `Reporte_Cursos_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, fileName);

      toast({
        title: 'Éxito',
        description: 'Reporte exportado correctamente',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: `Error al exportar: ${error.message}`,
        variant: 'destructive',
      });
    }
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <BarChart3 className="h-8 w-8" />
              Reporte de Cursos
            </h1>
            <p className="text-muted-foreground mt-2">
              Estadísticas de cursos, inscripciones y desempeño general
            </p>
          </div>
          <Button onClick={exportToExcel} disabled={loading}>
            <Download className="mr-2 h-4 w-4" />
            Exportar a Excel
          </Button>
        </div>

        {/* Estadísticas Globales */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Cursos</CardTitle>
              <BookOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{globalStats.totalCourses}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Módulos</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{globalStats.totalModules}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Inscripciones</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{globalStats.totalEnrollments}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Promedio por Curso</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {globalStats.averageStudentsPerCourse.toFixed(1)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filtros y Búsqueda */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Filtros de Búsqueda</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="search">Buscar Curso</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="search"
                    placeholder="Nombre o código..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="program">Programa</Label>
                <Select value={filterProgram} onValueChange={setFilterProgram}>
                  <SelectTrigger id="program">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los programas</SelectItem>
                    {programs.map((program) => (
                      <SelectItem key={program.id} value={program.id}>
                        {program.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Estado</Label>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="active">Activos</SelectItem>
                    <SelectItem value="inactive">Inactivos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
              <BarChart3 className="h-4 w-4" />
              <span>
                Mostrando {filteredCourses.length} de {courseStats.length} curso(s)
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Tabla de Estadísticas por Curso */}
        <Card>
          <CardHeader>
            <CardTitle>Estadísticas por Curso</CardTitle>
            <CardDescription>
              Detalle de inscripciones, desempeño y recursos por curso
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Cargando estadísticas...</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Curso</TableHead>
                      <TableHead>Programa</TableHead>
                      <TableHead className="text-center">Estudiantes</TableHead>
                      <TableHead className="text-center">Activos</TableHead>
                      <TableHead className="text-center">Completados</TableHead>
                      <TableHead className="text-center">Promedio</TableHead>
                      <TableHead className="text-center">Tareas</TableHead>
                      <TableHead className="text-center">Exámenes</TableHead>
                      <TableHead className="text-center">Completitud</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCourses.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                          {searchTerm || filterProgram !== 'all' || filterStatus !== 'all'
                            ? 'No se encontraron cursos con los filtros aplicados'
                            : 'No hay datos disponibles'}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredCourses.map((course) => (
                        <TableRow key={course.id}>
                          <TableCell className="font-medium">
                            <div>
                              <div>{course.name}</div>
                              <div className="text-xs text-muted-foreground">{course.code}</div>
                            </div>
                          </TableCell>
                          <TableCell>{course.program_name}</TableCell>
                          <TableCell className="text-center">{course.total_students}</TableCell>
                          <TableCell className="text-center">
                            <Badge variant="default">{course.active_students}</Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="secondary">{course.completed_students}</Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="secondary">
                              N/A
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">{course.total_assignments}</TableCell>
                          <TableCell className="text-center">{course.total_exams}</TableCell>
                          <TableCell className="text-center">
                            <Badge 
                              variant={course.completion_rate >= 50 ? 'default' : 'secondary'}
                              className={course.completion_rate >= 50 ? 'bg-blue-500 hover:bg-blue-600' : ''}
                            >
                              {course.completion_rate.toFixed(1)}%
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tabla de Estadísticas por Módulo */}
        <Card>
          <CardHeader>
            <CardTitle>Estadísticas por Módulo</CardTitle>
            <CardDescription>
              Información de módulos activos e históricos con sus inscripciones
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Cargando módulos...</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Módulo</TableHead>
                      <TableHead>Curso</TableHead>
                      <TableHead>Docente</TableHead>
                      <TableHead className="text-center">Inscritos</TableHead>
                      <TableHead>Inicio</TableHead>
                      <TableHead>Fin</TableHead>
                      <TableHead className="text-center">Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {moduleStats.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                          No hay módulos registrados
                        </TableCell>
                      </TableRow>
                    ) : (
                      moduleStats.map((module) => (
                        <TableRow key={module.id}>
                          <TableCell className="font-medium">
                            <div>
                              <div>{module.name}</div>
                              <div className="text-xs text-muted-foreground">{module.code}</div>
                            </div>
                          </TableCell>
                          <TableCell>{module.course_name}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <GraduationCap className="h-3 w-3" />
                              {module.teacher_name}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline">{module.total_enrolled}</Badge>
                          </TableCell>
                          <TableCell className="text-sm">
                            {formatDate(module.start_date)}
                          </TableCell>
                          <TableCell className="text-sm">
                            {new Date(module.end_date).toLocaleDateString('es-PE')}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge 
                              variant={module.is_active ? 'default' : 'secondary'}
                              className={module.is_active ? 'bg-green-500 hover:bg-green-600' : ''}
                            >
                              {module.is_active ? 'Activo' : 'Finalizado'}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default AdminCourseReport;
