import React from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { BarChart3, Calendar, DollarSign, FileText, Users, TrendingUp } from 'lucide-react';

interface ReportCard {
  title: string;
  description: string;
  icon: any;
  path: string;
  color: string;
  available: boolean;
}

const AdminReports = () => {
  const navigate = useNavigate();

  const reports: ReportCard[] = [
    {
      title: 'Reporte de Asistencia',
      description: 'Genera reportes detallados de asistencia por curso y fecha. Exporta a Excel con estadísticas completas.',
      icon: Calendar,
      path: '/admin/attendance-report',
      color: 'bg-blue-500',
      available: true,
    },
    {
      title: 'Reporte de Estudiantes',
      description: 'Analiza el rendimiento académico, inscripciones y estado de los estudiantes.',
      icon: Users,
      path: '/admin/student-report',
      color: 'bg-green-500',
      available: false,
    },
    {
      title: 'Reporte de Pagos',
      description: 'Visualiza el estado de pagos, matrículas pendientes y estadísticas financieras.',
      icon: DollarSign,
      path: '/admin/payment-report',
      color: 'bg-yellow-500',
      available: false,
    },
    {
      title: 'Reporte de Cursos',
      description: 'Estadísticas de cursos, inscripciones por curso y desempeño general.',
      icon: BarChart3,
      path: '/admin/course-report',
      color: 'bg-purple-500',
      available: true,
    },
    {
      title: 'Reporte de Tareas y Exámenes',
      description: 'Analiza el rendimiento en tareas, exámenes y entregas por curso.',
      icon: FileText,
      path: '/admin/assessment-report',
      color: 'bg-red-500',
      available: false,
    },
    {
      title: 'Métricas Generales',
      description: 'Dashboard con métricas clave del sistema, tendencias y análisis comparativo.',
      icon: TrendingUp,
      path: '/admin/metrics-report',
      color: 'bg-indigo-500',
      available: false,
    },
  ];

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Reportes del Sistema</h1>
          <p className="text-muted-foreground mt-2">
            Genera y visualiza reportes detallados sobre diferentes aspectos de la plataforma educativa
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {reports.map((report) => (
            <Card 
              key={report.path} 
              className={`hover:shadow-lg transition-shadow ${!report.available ? 'opacity-60' : ''}`}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className={`w-12 h-12 ${report.color} rounded-lg flex items-center justify-center mb-4`}>
                    <report.icon className="w-6 h-6 text-white" />
                  </div>
                  {!report.available && (
                    <span className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded">
                      Próximamente
                    </span>
                  )}
                </div>
                <CardTitle className="text-xl">{report.title}</CardTitle>
                <CardDescription className="text-sm">
                  {report.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={() => navigate(report.path)}
                  disabled={!report.available}
                  className="w-full"
                  variant={report.available ? 'default' : 'secondary'}
                >
                  {report.available ? 'Ver Reporte' : 'Próximamente'}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Sección de ayuda */}
        <Card className="bg-blue-50 border-blue-200">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              ¿Necesitas ayuda con los reportes?
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Los reportes te permiten analizar datos importantes de tu institución educativa:
            </p>
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 ml-2">
              <li>Exporta datos en formato Excel para análisis externos</li>
              <li>Filtra por fechas, cursos y otros criterios relevantes</li>
              <li>Visualiza estadísticas y métricas clave</li>
              <li>Identifica tendencias y áreas de mejora</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default AdminReports;
