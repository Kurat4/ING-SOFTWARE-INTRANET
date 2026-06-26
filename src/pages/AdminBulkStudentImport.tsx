import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { BulkStudentImport } from '@/components/students/BulkStudentImport';
import { Loader2, BookOpen, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { DashboardLayout } from '@/components/layout/DashboardLayout';

interface Course {
  id: string;
  name: string;
  code: string;
  grade?: string;
  section?: string;
  academic_year?: string;
  is_active: boolean;
  profiles?: {
    first_name: string;
    last_name: string;
  };
  enrollments?: { count: number }[];
}

const AdminBulkStudentImport = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);

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
    fetchCourses();
  }, []);

  const fetchCourses = async () => {
    setLoading(true);
    try {
      console.log('Fetching courses...');
      const { data, error } = await supabase
        .from('courses')
        .select('*')
        .eq('is_active', true)
        .order('academic_year', { ascending: false })
        .order('name', { ascending: true });

      if (error) {
        console.error('Error fetching courses:', error);
        toast({
          title: "Error",
          description: "No se pudieron cargar los cursos",
          variant: "destructive",
        });
        return;
      }
      
      console.log('Courses fetched:', data);
      
      // Fetch enrollment counts and teacher info
      const coursesWithEnrollments = await Promise.all(
        (data || []).map(async (course) => {
          // Get enrollment count
          const { data: enrollments } = await supabase
            .from('course_enrollments')
            .select('student_id')
            .eq('course_id', course.id);
          
          const uniqueStudents = new Set(enrollments?.map(e => e.student_id) || []);
          
          // Get teacher info
          const { data: teachers } = await supabase
            .from('course_teachers')
            .select('profiles!course_teachers_teacher_id_fkey(first_name, last_name)')
            .eq('course_id', course.id)
            .limit(1)
            .single();
          
          return { 
            ...course, 
            enrollments: [{ count: uniqueStudents.size }],
            profiles: (teachers as any)?.profiles
          };
        })
      );
      
      console.log('Courses with enrollments:', coursesWithEnrollments);
      setCourses(coursesWithEnrollments as Course[]);
    } catch (error) {
      console.error('Error:', error);
      toast({
        title: "Error",
        description: "Ocurrió un error al cargar los datos",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getEnrollmentCount = (course: Course): number => {
    return course.enrollments?.[0]?.count || 0;
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
        <h1 className="text-3xl font-bold mb-2">Importación Masiva de Estudiantes</h1>
        <p className="text-muted-foreground">
          Selecciona un curso y carga el archivo Excel con los datos de los estudiantes
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {courses.map((course) => (
          <Card
            key={course.id}
            className={`cursor-pointer transition-all hover:shadow-lg ${
              selectedCourse?.id === course.id
                ? 'ring-2 ring-primary shadow-lg'
                : ''
            }`}
            onClick={() => setSelectedCourse(course)}
          >
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5" />
                  {course.name}
                </div>
                <Badge variant={course.is_active ? 'default' : 'secondary'}>
                  {course.is_active ? 'Activo' : 'Inactivo'}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Código:</span>
                <span className="font-medium">{course.code}</span>
              </div>
              {course.grade && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Grado:</span>
                  <span className="font-medium">{course.grade}{course.section}</span>
                </div>
              )}
              {course.academic_year && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Año:</span>
                  <span className="font-medium">{course.academic_year}</span>
                </div>
              )}
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  <Users className="h-3 w-3 inline mr-1" />
                  Estudiantes:
                </span>
                <span className="font-medium">{getEnrollmentCount(course)}</span>
              </div>
              {course.profiles && (
                <div className="text-xs text-muted-foreground pt-2 border-t">
                  Profesor: {course.profiles.first_name} {course.profiles.last_name}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {courses.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              No hay cursos activos disponibles
            </p>
          </CardContent>
        </Card>
      )}

      {selectedCourse && (
        <div className="mt-8">
          <BulkStudentImport
            classroom={selectedCourse}
            onImportComplete={fetchCourses}
          />
        </div>
      )}
      </div>
    </DashboardLayout>
  );
};

export default AdminBulkStudentImport;
