import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Users, BookOpen, FileText, Activity, GraduationCap, UserCheck, ClipboardList, UserPlus, School, BarChart3, Calendar, DollarSign, Video, Award } from 'lucide-react';

interface AdminStats {
  totalUsers: number;
  totalStudents: number;
  totalTeachers: number;
  totalParents: number;
  totalCourses: number;
  totalAssignments: number;
  activeUsers: number;
}

interface RecentActivity {
  id: string;
  type: 'usuario' | 'curso' | 'matricula' | 'pago';
  description: string;
  created_at: string;
}

const AdminDashboard = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [stats, setStats] = useState<AdminStats>({
    totalUsers: 0,
    totalStudents: 0,
    totalTeachers: 0,
    totalParents: 0,
    totalCourses: 0,
    totalAssignments: 0,
    activeUsers: 0
  });
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile?.role === 'admin') {
      fetchAdminStats();
      fetchRecentActivities();
    }
  }, [profile]);

  const fetchAdminStats = async () => {
    try {
      // Fetch user counts by role
      const { data: usersData } = await supabase
        .from('profiles')
        .select('role, is_active');

      const { data: coursesData } = await supabase
        .from('courses')
        .select('id', { count: 'exact', head: true });

      const { data: assignmentsData } = await supabase
        .from('assignments')
        .select('id', { count: 'exact', head: true });

      if (usersData) {
        const totalUsers = usersData.length;
        const totalStudents = usersData.filter(u => u.role === 'student').length;
        const totalTeachers = usersData.filter(u => u.role === 'teacher').length;
        const totalParents = usersData.filter(u => u.role === 'parent').length;
        const activeUsers = usersData.filter(u => u.is_active).length;

        setStats({
          totalUsers,
          totalStudents,
          totalTeachers,
          totalParents,
          totalCourses: coursesData?.length || 0,
          totalAssignments: assignmentsData?.length || 0,
          activeUsers
        });
      }
    } catch (error) {
      console.error('Error fetching admin stats:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar las estadísticas del sistema",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchRecentActivities = async () => {
    try {
      const activities: RecentActivity[] = [];

      // Obtener últimos usuarios creados
      const { data: newUsers } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, role, created_at')
        .order('created_at', { ascending: false })
        .limit(3);

      if (newUsers) {
        newUsers.forEach(user => {
          activities.push({
            id: user.id,
            type: 'usuario',
            description: `Nuevo ${user.role === 'student' ? 'estudiante' : user.role === 'teacher' ? 'profesor' : 'usuario'} registrado: ${user.first_name} ${user.last_name}`,
            created_at: user.created_at
          });
        });
      }

      // Obtener últimas matrículas
      const { data: enrollments, error: enrollmentError } = await supabase
        .from('matriculas' as any)
        .select('id, created_at, estudiante_id, cod_matricula, modulos_matriculados')
        .order('created_at', { ascending: false })
        .limit(3);

      if (enrollments && !enrollmentError) {
        for (const enrollment of enrollments as any[]) {
          try {
            const { data: student } = await supabase
              .from('profiles')
              .select('first_name, last_name')
              .eq('id', enrollment.estudiante_id)
              .single();

            const modulos: any[] = enrollment.modulos_matriculados || [];
            const cursoNombre = modulos.length > 0 ? (modulos[0].course_name || modulos[0].nombre || 'Módulo') : 'Curso';

            activities.push({
              id: enrollment.id,
              type: 'matricula',
              description: `Nueva matrícula: ${student?.first_name || ''} ${student?.last_name || ''} en ${cursoNombre}`,
              created_at: enrollment.created_at
            });
          } catch (err) {
            console.error('Error fetching enrollment details:', err);
          }
        }
      }

      // Obtener últimos pagos
      const { data: payments, error: paymentsError } = await supabase
        .from('pagos' as any)
        .select('id, monto_pago, moneda_pago, created_at, estudiante_id, codigo_producto, categoria_producto')
        .order('created_at', { ascending: false })
        .limit(3);

      if (payments && !paymentsError) {
        for (const payment of payments as any[]) {
          try {
            let studentName = '';
            if (payment.estudiante_id) {
              const { data: student } = await supabase
                .from('profiles')
                .select('first_name, last_name')
                .eq('id', payment.estudiante_id)
                .single();
              studentName = `${student?.first_name || ''} ${student?.last_name || ''}`.trim();
            }

            const moneda = payment.moneda_pago === 'USD' ? '$' : 'S/';
            activities.push({
              id: payment.id,
              type: 'pago',
              description: `Pago registrado: ${moneda}${payment.monto_pago}${studentName ? ` de ${studentName}` : ''}`,
              created_at: payment.created_at
            });
          } catch (err) {
            console.error('Error fetching payment details:', err);
          }
        }
      }

      // Ordenar por fecha y tomar las 6 más recientes
      const sorted = activities
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 6);

      setRecentActivities(sorted);
    } catch (error) {
      console.error('Error fetching recent activities:', error);
    }
  };

  const getActivityBadgeVariant = (type: string) => {
    switch (type) {
      case 'usuario': return 'default';
      case 'curso': return 'secondary';
      case 'matricula': return 'outline';
      case 'pago': return 'default';
      default: return 'outline';
    }
  };

  const getTimeAgo = (date: string) => {
    const now = new Date();
    const past = new Date(date);
    const diffMs = now.getTime() - past.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `Hace ${diffMins} min`;
    if (diffHours < 24) return `Hace ${diffHours}h`;
    return `Hace ${diffDays}d`;
  };

  // Redirect if not admin
  if (profile?.role !== 'admin') {
    return (
      <DashboardLayout>
        <div className="container mx-auto px-4 py-8">
          <Card>
            <CardContent className="p-6">
              <h1 className="text-2xl font-bold text-red-600 dark:text-red-400">Acceso Denegado</h1>
              <p className="mt-2 text-gray-600 dark:text-gray-400">No tienes permisos para acceder al panel de administración.</p>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="p-6 space-y-6">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-1/3"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-32 bg-muted rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Panel de Administración</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Gestiona usuarios, cursos y contenido de Peri Institute
        </p>
      </div>

      {/* Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {[
          {
            title: "Total Usuarios",
            value: stats.totalUsers,
            icon: Users,
            description: "Usuarios registrados en el sistema",
            color: "text-blue-600"
          },
          {
            title: "Estudiantes",
            value: stats.totalStudents,
            icon: GraduationCap,
            description: "Estudiantes activos",
            color: "text-green-600"
          },
          {
            title: "Profesores",
            value: stats.totalTeachers,
            icon: UserCheck,
            description: "Profesores registrados",
            color: "text-purple-600"
          },
          {
            title: "Cursos",
            value: stats.totalCourses,
            icon: BookOpen,
            description: "Cursos disponibles",
            color: "text-indigo-600"
          }
        ].map((stat, index) => {
          const IconComponent = stat.icon;
          return (
            <Card key={index} className="hover:shadow-lg transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  {stat.title}
                </CardTitle>
                <IconComponent className={`h-4 w-4 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold dark:text-white">{stat.value}</div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {stat.description}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Resumen */}
      <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Actividad Reciente</CardTitle>
                <CardDescription>
                  Últimas acciones en el sistema
                </CardDescription>
              </CardHeader>
              <CardContent>
                {recentActivities.length > 0 ? (
                  <div className="space-y-4">
                    {recentActivities.map((activity) => (
                      <div key={activity.id} className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Badge variant={getActivityBadgeVariant(activity.type)}>
                            {activity.type.charAt(0).toUpperCase() + activity.type.slice(1)}
                          </Badge>
                          <span className="text-sm dark:text-gray-300">{activity.description}</span>
                        </div>
                        <span className="text-xs text-gray-500 dark:text-gray-400">{getTimeAgo(activity.created_at)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                    No hay actividad reciente
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Acciones Rápidas</CardTitle>
                <CardDescription>
                  Tareas administrativas comunes
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button 
                  className="w-full justify-start" 
                  variant="outline"
                  onClick={() => navigate('/admin/users')}
                >
                  <UserPlus className="mr-2 h-4 w-4" />
                  Gestión de Usuarios
                </Button>
                <Button 
                  className="w-full justify-start" 
                  variant="outline"
                  onClick={() => navigate('/admin/students')}
                >
                  <GraduationCap className="mr-2 h-4 w-4" />
                  Gestión de Estudiantes
                </Button>
                <Button 
                  className="w-full justify-start" 
                  variant="outline"
                  onClick={() => navigate('/admin/courses')}
                >
                  <School className="mr-2 h-4 w-4" />
                  Gestión de Cursos
                </Button>
                <Button 
                  className="w-full justify-start" 
                  variant="outline"
                  onClick={() => navigate('/admin/pagos')}
                >
                  <DollarSign className="mr-2 h-4 w-4" />
                  Gestión de Pagos
                </Button>
                <Button 
                  className="w-full justify-start" 
                  variant="outline"
                  onClick={() => navigate('/admin/attendance-report')}
                >
                  <ClipboardList className="mr-2 h-4 w-4" />
                  Reporte de Asistencia
                </Button>
                <Button 
                  className="w-full justify-start" 
                  variant="outline"
                  onClick={() => navigate('/admin/certificates')}
                >
                  <Award className="mr-2 h-4 w-4" />
                  Certificados
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default AdminDashboard;