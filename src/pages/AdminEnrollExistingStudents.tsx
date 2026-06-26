import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, BookOpen, Users, Search, CheckCircle2, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Course {
  id: string;
  name: string;
  code: string;
  grade?: string;
  section?: string;
  academic_year?: string;
  is_active: boolean;
}

interface Student {
  id: string;
  first_name: string;
  last_name: string;
  paternal_surname: string;
  maternal_surname: string;
  student_code: string;
  email: string;
  document_number?: string;
  gender?: string;
  birth_date?: string;
  is_active: boolean;
}

const AdminEnrollExistingStudents = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [courses, setCourses] = useState<Course[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterGrade, setFilterGrade] = useState<string>('all');
  const [showOnlyNotEnrolled, setShowOnlyNotEnrolled] = useState(false);

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
    fetchStudents();
  }, []);

  useEffect(() => {
    filterStudentsList();
  }, [students, searchTerm, filterGrade, selectedCourse, showOnlyNotEnrolled]);

  const fetchCourses = async () => {
    try {
      const { data, error } = await supabase
        .from('courses')
        .select('*')
        .eq('is_active', true)
        .order('academic_year', { ascending: false })
        .order('name', { ascending: true });

      if (error) throw error;
      setCourses(data || []);
    } catch (error) {
      console.error('Error fetching courses:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los cursos",
        variant: "destructive",
      });
    }
  };

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'student')
        .eq('is_active', true)
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

  const filterStudentsList = async () => {
    let filtered = [...students];

    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(student => {
        const fullName = `${student.paternal_surname} ${student.maternal_surname} ${student.first_name}`.toLowerCase();
        const code = student.student_code?.toLowerCase() || '';
        const doc = student.document_number?.toLowerCase() || '';
        return fullName.includes(term) || code.includes(term) || doc.includes(term);
      });
    }

    // Filter by grade (if needed - this would require adding grade to profiles or fetching from enrollments)
    // For now, we'll skip this filter

    // Filter by enrollment status in selected course
    if (selectedCourse && showOnlyNotEnrolled) {
      const { data: enrollments } = await supabase
        .from('course_enrollments')
        .select('student_id')
        .eq('course_id', selectedCourse.id);

      const enrolledIds = new Set(enrollments?.map(e => e.student_id) || []);
      filtered = filtered.filter(student => !enrolledIds.has(student.id));
    }

    setFilteredStudents(filtered);
  };

  const toggleStudentSelection = (studentId: string) => {
    const newSelection = new Set(selectedStudents);
    if (newSelection.has(studentId)) {
      newSelection.delete(studentId);
    } else {
      newSelection.add(studentId);
    }
    setSelectedStudents(newSelection);
  };

  const selectAll = () => {
    setSelectedStudents(new Set(filteredStudents.map(s => s.id)));
  };

  const clearSelection = () => {
    setSelectedStudents(new Set());
  };

  const handleEnroll = async () => {
    if (!selectedCourse) {
      toast({
        title: "Error",
        description: "Debes seleccionar un curso",
        variant: "destructive",
      });
      return;
    }

    if (selectedStudents.size === 0) {
      toast({
        title: "Error",
        description: "Debes seleccionar al menos un estudiante",
        variant: "destructive",
      });
      return;
    }

    setEnrolling(true);
    try {
      // Check existing enrollments
      const { data: existingEnrollments } = await supabase
        .from('course_enrollments')
        .select('student_id')
        .eq('course_id', selectedCourse.id)
        .in('student_id', Array.from(selectedStudents));

      const alreadyEnrolledIds = new Set(existingEnrollments?.map(e => e.student_id) || []);
      const toEnroll = Array.from(selectedStudents).filter(id => !alreadyEnrolledIds.has(id));

      if (toEnroll.length === 0) {
        toast({
          title: "Información",
          description: "Todos los estudiantes seleccionados ya están matriculados en este curso",
        });
        setEnrolling(false);
        return;
      }

      // Create enrollments
      const enrollmentData = toEnroll.map(studentId => ({
        student_id: studentId,
        course_id: selectedCourse.id,
        enrolled_at: new Date().toISOString()
      }));

      const { error } = await supabase
        .from('course_enrollments')
        .insert(enrollmentData);

      if (error) throw error;

      toast({
        title: "Éxito",
        description: `${toEnroll.length} estudiante${toEnroll.length !== 1 ? 's' : ''} matriculado${toEnroll.length !== 1 ? 's' : ''} exitosamente${alreadyEnrolledIds.size > 0 ? ` (${alreadyEnrolledIds.size} ya estaban matriculados)` : ''}`,
      });

      clearSelection();
      filterStudentsList(); // Refresh the list
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
          <h1 className="text-3xl font-bold mb-2">Matricular Estudiantes Existentes</h1>
          <p className="text-muted-foreground">
            Selecciona un curso y los estudiantes que deseas matricular
          </p>
        </div>

        {/* Course Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Seleccionar Curso Destino
            </CardTitle>
            <CardDescription>
              Elige el curso en el que deseas matricular a los estudiantes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Select
              value={selectedCourse?.id}
              onValueChange={(value) => {
                const course = courses.find(c => c.id === value);
                setSelectedCourse(course || null);
                clearSelection();
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecciona un curso" />
              </SelectTrigger>
              <SelectContent>
                {courses.map((course) => (
                  <SelectItem key={course.id} value={course.id}>
                    {course.name} ({course.code})
                    {course.grade && course.section && ` - ${course.grade}${course.section}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {selectedCourse && (
          <>
            {/* Filters and Search */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Buscar y Filtrar Estudiantes
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-4 items-end">
                  <div className="flex-1">
                    <Label htmlFor="search">Buscar</Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="search"
                        placeholder="Buscar por nombre, código o DNI..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="not-enrolled"
                      checked={showOnlyNotEnrolled}
                      onCheckedChange={(checked) => setShowOnlyNotEnrolled(checked === true)}
                    />
                    <Label htmlFor="not-enrolled" className="cursor-pointer">
                      Solo no matriculados
                    </Label>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    {filteredStudents.length} estudiante{filteredStudents.length !== 1 ? 's' : ''} encontrado{filteredStudents.length !== 1 ? 's' : ''}
                    {selectedStudents.size > 0 && (
                      <span className="ml-2 font-medium text-primary">
                        ({selectedStudents.size} seleccionado{selectedStudents.size !== 1 ? 's' : ''})
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {selectedStudents.size > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={clearSelection}
                      >
                        <X className="h-4 w-4 mr-1" />
                        Limpiar
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={selectAll}
                      disabled={filteredStudents.length === 0}
                    >
                      Seleccionar todos
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Students List */}
            <Card>
              <CardHeader>
                <CardTitle>Lista de Estudiantes</CardTitle>
              </CardHeader>
              <CardContent>
                {filteredStudents.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No se encontraron estudiantes
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[500px] overflow-y-auto">
                    {filteredStudents.map((student) => (
                      <div
                        key={student.id}
                        className={`flex items-center justify-between p-4 border rounded-lg cursor-pointer transition-colors ${
                          selectedStudents.has(student.id)
                            ? 'bg-primary/10 border-primary'
                            : 'hover:bg-muted/50'
                        }`}
                        onClick={() => toggleStudentSelection(student.id)}
                      >
                        <div className="flex items-center gap-3">
                          <Checkbox
                            checked={selectedStudents.has(student.id)}
                            onCheckedChange={() => toggleStudentSelection(student.id)}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <div>
                            <p className="font-medium">
                              {student.paternal_surname} {student.maternal_surname}, {student.first_name}
                            </p>
                            <div className="flex gap-3 text-sm text-muted-foreground">
                              <span>Código: {student.student_code}</span>
                              {student.document_number && (
                                <span>DNI: {student.document_number}</span>
                              )}
                              {student.gender && (
                                <span>Sexo: {student.gender}</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <Badge variant={student.is_active ? 'default' : 'secondary'}>
                          {student.is_active ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Action Button */}
            {selectedStudents.size > 0 && (
              <Card className="bg-gradient-card">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-lg">
                        Matricular {selectedStudents.size} estudiante{selectedStudents.size !== 1 ? 's' : ''}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        En el curso: {selectedCourse.name} ({selectedCourse.code})
                      </p>
                    </div>
                    <Button
                      onClick={handleEnroll}
                      disabled={enrolling}
                      size="lg"
                    >
                      {enrolling ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Matriculando...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          Matricular Ahora
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

export default AdminEnrollExistingStudents;
