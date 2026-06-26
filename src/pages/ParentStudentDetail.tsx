import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ArrowLeft, User, Calendar, BookOpen, ClipboardList, MessageSquare, AlertCircle } from 'lucide-react';
import { ParentLayout } from '@/components/layout/ParentLayout';
import ParentStudentAttendance from '@/components/parent/ParentStudentAttendance';
import ParentStudentGrades from '@/components/parent/ParentStudentGrades';
import ParentStudentAssignments from '@/components/parent/ParentStudentAssignments';
import ParentStudentSchedule from '@/components/parent/ParentStudentSchedule';
import ParentStudentBehavior from '@/components/parent/ParentStudentBehavior';
import ParentStudentMessages from '@/components/parent/ParentStudentMessages';

interface StudentInfo {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  is_active?: boolean;
}

export default function ParentStudentDetail() {
  const { studentId } = useParams();
  const [student, setStudent] = useState<StudentInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStudentInfo();
  }, [studentId]);

  const loadStudentInfo = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email, is_active')
        .eq('id', studentId)
        .eq('role', 'student')
        .single();

      if (error) throw error;
      setStudent(data);
    } catch (error) {
      console.error('Error loading student info:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <ParentLayout>
        <div className="flex items-center justify-center h-full">
          <p className="text-muted-foreground">Cargando información del estudiante...</p>
        </div>
      </ParentLayout>
    );
  }

  if (!student) {
    return (
      <ParentLayout>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              Estudiante no encontrado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              No se pudo encontrar la información del estudiante.
            </p>
            <Link to="/parent/admin">
              <Button>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Volver al panel
              </Button>
            </Link>
          </CardContent>
        </Card>
      </ParentLayout>
    );
  }

  return (
    <ParentLayout>
      <div className="space-y-6">
        <Button variant="outline" asChild>
          <Link to="/parent/admin">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver al panel
          </Link>
        </Button>

        <Card>
          <CardHeader>
            <div className="flex items-start gap-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${student.first_name}`} />
                <AvatarFallback>
                  <User className="h-8 w-8" />
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <CardTitle className="text-2xl">
                  {student.first_name} {student.last_name}
                </CardTitle>
                <CardDescription className="mt-1">
                  {student.email}
                </CardDescription>
                <div className="mt-2 flex items-center gap-2">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    student.is_active 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {student.is_active ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
              </div>
            </div>
          </CardHeader>
        </Card>

        <Tabs defaultValue="attendance" className="w-full">
          <TabsList className="grid w-full grid-cols-2 lg:grid-cols-6 mb-6">
            <TabsTrigger value="attendance" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <span className="hidden sm:inline">Asistencia</span>
            </TabsTrigger>
            <TabsTrigger value="grades" className="flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              <span className="hidden sm:inline">Calificaciones</span>
            </TabsTrigger>
            <TabsTrigger value="assignments" className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4" />
              <span className="hidden sm:inline">Tareas</span>
            </TabsTrigger>
            <TabsTrigger value="schedule" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <span className="hidden sm:inline">Horario</span>
            </TabsTrigger>
            <TabsTrigger value="behavior" className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              <span className="hidden sm:inline">Comportamiento</span>
            </TabsTrigger>
            <TabsTrigger value="messages" className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              <span className="hidden sm:inline">Mensajes</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="attendance">
            <ParentStudentAttendance studentId={student.id} />
          </TabsContent>

          <TabsContent value="grades">
            <ParentStudentGrades studentId={student.id} />
          </TabsContent>

          <TabsContent value="assignments">
            <ParentStudentAssignments studentId={student.id} />
          </TabsContent>

          <TabsContent value="schedule">
            <ParentStudentSchedule studentId={student.id} />
          </TabsContent>

          <TabsContent value="behavior">
            <ParentStudentBehavior studentId={student.id} />
          </TabsContent>

          <TabsContent value="messages">
            <ParentStudentMessages studentId={student.id} />
          </TabsContent>
        </Tabs>
      </div>
    </ParentLayout>
  );
}
