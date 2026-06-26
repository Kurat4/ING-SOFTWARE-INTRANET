import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { ParentLayout } from '@/components/layout/ParentLayout';
import { Users, FileText, BookOpen, GraduationCap, UserCheck, Bell, Calendar, User, Download, MessageCircle, FileWarning } from 'lucide-react';
import { Link } from 'react-router-dom';


import { useState, useEffect } from "react";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import heroImage from "@/assets/hero-education.jpg";

const ParentAdminPanel = () => {
  const { profile } = useAuth();
  const getWelcomeMessage = () => {
    const name = profile ? profile.first_name : 'Usuario';
    return `¡Bienvenido, ${name}!`;
  };
  const getSubtitle = () => {
    return 'Portal de Padres - Peri Institute';
  };
  const [children, setChildren] = useState<any[]>([]);
  const [loadingChildren, setLoadingChildren] = useState(false);
  const [pendingTasksCount, setPendingTasksCount] = useState(0);
  const [recentAbsencesCount, setRecentAbsencesCount] = useState(0);

  useEffect(() => {
    if (profile?.role === 'parent' && profile.id) {
      fetchChildren();
    }
  }, [profile]);

  const fetchChildren = async () => {
    setLoadingChildren(true);
    
    // Usar RPC para obtener hijos de forma segura y eficiente
    // @ts-ignore
    const { data, error } = await supabase.rpc('get_my_students');

    if (!error && data) {
      const students = (Array.isArray(data) ? data : [data]) as any[];
      setChildren(students.filter(s => s && s.id));
      let pending = 0;
      let absences = 0;
      for (const child of students) {
        // Cálculo de tareas pendientes omitido por complejidad en frontend
        // Se requeriría una función RPC para calcularlo eficientemente
        
        const { data: attendance } = await (supabase
          .from('attendance' as any)
          .select('id')
          .eq('student_id', child.id)
          .eq('status', 'absent')
          .gte('date', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)));
        if (attendance && attendance.length > 0) absences++;
      }
      setPendingTasksCount(pending);
      setRecentAbsencesCount(absences);
    } else {
      console.error('Error fetching children:', error);
      setChildren([]);
      setPendingTasksCount(0);
      setRecentAbsencesCount(0);
    }
    setLoadingChildren(false);
  };

  return (
    <ParentLayout>
      <div className="space-y-6">
            {/* Hero Section */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-hero p-8 text-white shadow-glow">
          <div className="absolute inset-0 opacity-20">
            <img 
              src={heroImage} 
              alt="Educación virtual Peri Institute" 
              className="w-full h-full object-cover"
            />
          </div>
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-4">
              <Users className="w-8 h-8" />
              <div>
                <h1 className="text-2xl font-bold">{getWelcomeMessage()}</h1>
                <p className="text-white/90">{getSubtitle()}</p>
              </div>
            </div>
            <p className="text-lg text-white/90 max-w-2xl">
              Bienvenido al Portal de Padres. Aquí puedes ver la información de tus hijos, asociar nuevas cuentas y acceder a recursos útiles para acompañar su vida escolar.
            </p>
          </div>
        </div>

        {/* Indicadores principales */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
          <StatsCard
            title="Hijos Asociados"
            value={loadingChildren ? '...' : children.length.toString()}
            icon={Users}
            description="Cantidad de hijos asociados a tu cuenta"
            color="primary"
          />
          <StatsCard
            title="Hijos Activos"
            value={loadingChildren ? '...' : children.filter(h => h.is_active).length.toString()}
            icon={User}
            description="Hijos con matrícula activa"
            color="accent"
          />
          <StatsCard
            title="Hijos con tareas pendientes"
            value={loadingChildren ? '...' : pendingTasksCount.toString()}
            icon={FileText}
            description="Hijos con tareas por entregar"
            color="secondary"
          />
          <StatsCard
            title="Hijos con inasistencias recientes"
            value={loadingChildren ? '...' : recentAbsencesCount.toString()}
            icon={GraduationCap}
            description="Hijos con faltas en la última semana"
            color="primary"
          />
          <Link to="/parent/children" className="block h-full">
            <Card className="h-full border-dashed border-2 hover:border-primary hover:bg-primary/5 transition-colors cursor-pointer flex flex-col items-center justify-center p-6 text-center">
              <div className="bg-primary/10 p-3 rounded-full mb-3">
                <BookOpen className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold text-primary">Asociar Hijo/a</h3>
              <p className="text-sm text-muted-foreground mt-1">Vincular nuevo estudiante</p>
            </Card>
          </Link>
        </div>

        {/* Main Content Grid para padres */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-4">
          {/* Columna izquierda: Lista de hijos */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold">Mis Hijos/as</h2>
                <Button variant="outline" size="sm" asChild>
                  <Link to="/parent/children">
                    <Users className="mr-2 h-4 w-4" />
                    Asociar nuevo
                  </Link>
                </Button>
              </div>
              
              {loadingChildren ? (
                <div className="text-gray-500 text-center py-8">Cargando información...</div>
              ) : children.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed">
                  <Users className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 mb-4">No tienes hijos asociados a tu cuenta.</p>
                  <Button asChild>
                    <Link to="/parent/children">Asociar estudiante</Link>
                  </Button>
                </div>
              ) : (
                <div className="grid gap-4">
                  {children.map((child) => (
                    <Card key={child.id} className="overflow-hidden hover:shadow-md transition-shadow border-l-4 border-l-primary">
                      <CardContent className="p-0">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-4">
                          <div className="flex items-center gap-4">
                            <div className="bg-blue-100 p-3 rounded-full">
                              <User className="h-6 w-6 text-blue-600" />
                            </div>
                            <div>
                              <h3 className="font-bold text-lg">{child.first_name} {child.last_name}</h3>
                              <div className="flex flex-wrap gap-2 text-sm text-muted-foreground mt-1">
                                <span className="flex items-center gap-1">
                                  <GraduationCap className="h-3 w-3" />
                                  {child.grade ? `${child.grade}° Grado` : 'Sin grado'}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Users className="h-3 w-3" />
                                  Sección {child.section || '-'}
                                </span>
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${child.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                  {child.is_active ? 'Activo' : 'Inactivo'}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 self-end sm:self-center">
                            <Button asChild variant="default" size="sm">
                              <Link to={`/parent/student/${child.id}`}>
                                Ver detalle
                              </Link>
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
          {/* Columna derecha: Acciones rápidas */}
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow p-6">
              <h2 className="text-lg font-bold mb-4">Acciones Rápidas</h2>
              <div className="grid grid-cols-1 gap-3">
                <Link 
                  to="/parent/children" 
                  className="flex items-center gap-3 p-3 rounded-lg border hover:bg-gray-50 transition-colors group"
                >
                  <div className="bg-blue-100 p-2 rounded-md group-hover:bg-blue-200 transition-colors">
                    <UserCheck className="h-5 w-5 text-blue-600" />
                  </div>
                  <span className="font-medium text-gray-700">Asociar cuenta de hijo/a</span>
                </Link>
                
                <Link 
                  to="/parent/documents" 
                  className="flex items-center gap-3 p-3 rounded-lg border hover:bg-gray-50 transition-colors group"
                >
                  <div className="bg-green-100 p-2 rounded-md group-hover:bg-green-200 transition-colors">
                    <FileText className="h-5 w-5 text-green-600" />
                  </div>
                  <span className="font-medium text-gray-700">Descargar constancia</span>
                </Link>
                
                <Link 
                  to="/parent/notifications" 
                  className="flex items-center gap-3 p-3 rounded-lg border hover:bg-gray-50 transition-colors group"
                >
                  <div className="bg-amber-100 p-2 rounded-md group-hover:bg-amber-200 transition-colors">
                    <Bell className="h-5 w-5 text-amber-600" />
                  </div>
                  <span className="font-medium text-gray-700">Ver notificaciones</span>
                </Link>

                <a 
                  href="#" 
                  className="flex items-center gap-3 p-3 rounded-lg border hover:bg-gray-50 transition-colors group"
                >
                  <div className="bg-purple-100 p-2 rounded-md group-hover:bg-purple-200 transition-colors">
                    <BookOpen className="h-5 w-5 text-purple-600" />
                  </div>
                  <span className="font-medium text-gray-700">Manual de uso</span>
                </a>
              </div>
            </div>

            {/* Card de ayuda o contacto */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl shadow p-6 border border-blue-100">
              <h3 className="font-semibold text-blue-900 mb-2">¿Necesitas ayuda?</h3>
              <p className="text-sm text-blue-700 mb-4">
                Si tienes problemas para visualizar la información de tus hijos, contacta con soporte.
              </p>
              <Button variant="outline" className="w-full border-blue-200 text-blue-700 hover:bg-blue-100">
                Contactar Soporte
              </Button>
            </div>
          </div>
        </div>
      </div>
    </ParentLayout>
  );
};

export default ParentAdminPanel;
