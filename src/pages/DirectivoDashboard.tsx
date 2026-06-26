import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { formatDate } from '@/lib/dateUtils';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertCircle,
  CheckCircle,
  Clock,
  FileText,
  GraduationCap,
  Search,
  TrendingUp,
  Users,
  AlertTriangle,
  BookOpen,
  Calendar,
  Award,
  Download,
  Mail,
  Phone,
  Star,
  Flag,
  TrendingDown,
  Minus,
  Eye,
  EyeOff,
  HelpCircle,
  Trophy,
  ArrowUp,
  ArrowDown,
  UserCheck,
} from "lucide-react";
import { toast } from "sonner";

interface TeacherMetrics {
  teacher_id: string;
  first_name: string;
  last_name: string;
  email: string;
  is_active: boolean;
  total_courses: number;
  total_assignments: number;
  published_assignments: number;
  assignments_last_week: number;
  assignments_last_month: number;
  pending_grading: number;
  graded_submissions: number;
  total_exams: number;
  attendance_records: number;
  last_grading_date: string | null;
  alert_level: "high" | "medium" | "low" | null;
  alert_reasons: string[];
}

interface GradeStats {
  AD: number;
  A: number;
  B: number;
  C: number;
}

const DirectivoDashboard = () => {
  const navigate = useNavigate();
  const [teachers, setTeachers] = useState<TeacherMetrics[]>([]);
  const [filteredTeachers, setFilteredTeachers] = useState<TeacherMetrics[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<"all" | "active" | "needs-attention">("all");
  const [selectedSeverity, setSelectedSeverity] = useState<string>("all");
  const [isSimpleMode, setIsSimpleMode] = useState(true);
  const [showCalendar, setShowCalendar] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<"week" | "month" | "quarter" | "all">("month");
  const [historicalData, setHistoricalData] = useState<{ total_assignments: number; total_submissions: number }>({ total_assignments: 0, total_submissions: 0 });

  useEffect(() => {
    fetchTeacherData();
  }, []);

  useEffect(() => {
    filterTeachers();
  }, [teachers, searchTerm, activeFilter, selectedSeverity]);

  const fetchTeacherData = async () => {
    setIsLoading(true);
    try {
      // Fetch all teachers
      const { data: teachersData, error: teachersError } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, email, is_active")
        .in("role", ["teacher", "tutor"])
        .order("last_name");

      if (teachersError) throw teachersError;

      const metricsPromises = teachersData.map(async (teacher) => {
        // Get teacher's modulos (como profesor principal o adicional)
        const { data: modulosAsPrincipal, error: principalError } = await supabase
          .from("modulos")
          .select("id")
          .eq("teacher_principal_id", teacher.id);

        if (principalError) {
          console.error(`Error fetching modulos as principal for ${teacher.first_name}:`, principalError);
        }

        // Get modulos where teacher is additional teacher
        const { data: allModulos, error: modulosError } = await supabase
          .from("modulos")
          .select("id, aditional_teachers");

        if (modulosError) {
          console.error(`Error fetching all modulos for ${teacher.first_name}:`, modulosError);
        }

        const modulosAsAdditional = allModulos?.filter(m => 
          m.aditional_teachers && m.aditional_teachers.includes(teacher.id)
        ) || [];

        // Combine both lists and remove duplicates
        const principalModuloIds = modulosAsPrincipal?.map((m) => m.id) || [];
        const additionalModuloIds = modulosAsAdditional.map((m) => m.id);
        const moduloIds = [...new Set([...principalModuloIds, ...additionalModuloIds])];
        
        // Debug: Log para ver si se están obteniendo los módulos
        if (moduloIds.length > 0) {
          console.log(`${teacher.first_name} ${teacher.last_name}: ${moduloIds.length} módulos encontrados (${principalModuloIds.length} principal, ${additionalModuloIds.length} adicional)`, moduloIds);
        }

        const now = new Date();
        const weekAgo = new Date();
        weekAgo.setDate(now.getDate() - 7);
        const monthAgo = new Date();
        monthAgo.setDate(now.getDate() - 30);
        const twoMonthsAgo = new Date();
        twoMonthsAgo.setDate(now.getDate() - 60);
        const quarterAgo = new Date();
        quarterAgo.setDate(now.getDate() - 90);

        // Get ALL assignments metrics (including historical) - now using modulo_id
        const { data: assignments, error: assignmentsError } = await supabase
          .from("assignments")
          .select("id, is_published, created_at")
          .in("modulo_id", moduloIds)
          .order("created_at", { ascending: false });

        if (assignmentsError) {
          console.error(`Error fetching assignments for ${teacher.first_name}:`, assignmentsError);
        }

        // Debug: Log para ver las tareas encontradas
        if (assignments && assignments.length > 0) {
          console.log(`${teacher.first_name} ${teacher.last_name}: ${assignments.length} tareas encontradas`);
        }

        const totalAssignments = assignments?.length || 0;
        const publishedAssignments = assignments?.filter((a) => a.is_published).length || 0;
        const assignmentsLastWeek = assignments?.filter((a) => new Date(a.created_at) >= weekAgo).length || 0;
        const assignmentsLastMonth = assignments?.filter((a) => new Date(a.created_at) >= monthAgo).length || 0;
        const assignmentsPreviousMonth = assignments?.filter((a) => {
          const createdDate = new Date(a.created_at);
          return createdDate >= twoMonthsAgo && createdDate < monthAgo;
        }).length || 0;
        const assignmentsLastQuarter = assignments?.filter((a) => new Date(a.created_at) >= quarterAgo).length || 0;

        // Get submissions metrics
        const assignmentIds = assignments?.map((a) => a.id) || [];
        const { data: submissions } = await supabase
          .from("assignment_submissions")
          .select("id, graded_at, submitted_at")
          .in("assignment_id", assignmentIds);

        const pendingGrading = submissions?.filter((s) => !s.graded_at && s.submitted_at).length || 0;
        const gradedSubmissions = submissions?.filter((s) => s.graded_at).length || 0;
        const lastGrading = submissions
          ?.filter((s) => s.graded_at)
          .sort((a, b) => new Date(b.graded_at!).getTime() - new Date(a.graded_at!).getTime())[0];

        // Get exams - now using modulo_id
        const { count: examsCount } = await supabase
          .from("exams")
          .select("*", { count: "exact", head: true })
          .in("modulo_id", moduloIds);

        // Get attendance records
        const { count: attendanceCount } = await supabase
          .from("attendance")
          .select("*", { count: "exact", head: true })
          .eq("recorded_by", teacher.id);

        // Calculate alerts
        const alertReasons: string[] = [];
        let alertLevel: "high" | "medium" | "low" | null = null;

        if (pendingGrading > 10 || assignmentsLastMonth === 0) {
          alertLevel = "high";
        } else if (pendingGrading > 5 || assignmentsLastWeek === 0) {
          alertLevel = "medium";
        } else if (pendingGrading > 0) {
          alertLevel = "low";
        }

        if (pendingGrading > 5) {
          alertReasons.push(`${pendingGrading} tareas pendientes de calificar`);
        }
        if (assignmentsLastMonth === 0) {
          alertReasons.push("Sin crear tareas este mes");
        }
        if (assignmentsLastWeek === 0 && totalAssignments > 0) {
          alertReasons.push("Sin actividad esta semana");
        }

        return {
          teacher_id: teacher.id,
          first_name: teacher.first_name,
          last_name: teacher.last_name,
          email: teacher.email,
          is_active: teacher.is_active,
          total_courses: moduloIds.length, // ahora representa módulos
          total_assignments: totalAssignments,
          published_assignments: publishedAssignments,
          assignments_last_week: assignmentsLastWeek,
          assignments_last_month: assignmentsLastMonth,
          assignments_previous_month: assignmentsPreviousMonth,
          assignments_last_quarter: assignmentsLastQuarter,
          pending_grading: pendingGrading,
          graded_submissions: gradedSubmissions,
          total_exams: examsCount || 0,
          attendance_records: attendanceCount || 0,
          last_grading_date: lastGrading?.graded_at || null,
          alert_level: alertLevel,
          alert_reasons: alertReasons,
        } as any;
      });

      const metrics = await Promise.all(metricsPromises);
      setTeachers(metrics);
    } catch (error: any) {
      toast.error("Error al cargar los datos de profesores");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const filterTeachers = () => {
    let filtered = [...teachers];

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(
        (t) =>
          t.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          t.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          t.email.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Active filter
    if (activeFilter === "active") {
      filtered = filtered.filter((t) => t.is_active);
    } else if (activeFilter === "needs-attention") {
      filtered = filtered.filter((t) => t.alert_level !== null);
    }

    // Severity filter
    if (selectedSeverity !== "all") {
      filtered = filtered.filter((t) => t.alert_level === selectedSeverity);
    }

    setFilteredTeachers(filtered);
  };

  // Funciones auxiliares para las nuevas funcionalidades
  const getStatusColor = (teacher: TeacherMetrics) => {
    if (!teacher.is_active) return "bg-gray-400";
    if (teacher.alert_level === "high") return "bg-red-500";
    if (teacher.alert_level === "medium") return "bg-yellow-500";
    if (teacher.pending_grading > 10) return "bg-orange-500";
    return "bg-green-500";
  };

  const getStatusText = (teacher: TeacherMetrics) => {
    if (!teacher.is_active) return "Inactivo";
    if (teacher.alert_level === "high") return "Requiere Atención Urgente";
    if (teacher.alert_level === "medium") return "Necesita Seguimiento";
    if (teacher.pending_grading > 10) return "Atención Recomendada";
    return "Desempeño Normal";
  };

  const getTopPerformers = () => {
    return [...teachers]
      .filter((t) => t.is_active)
      .sort((a, b) => {
        const scoreA = a.graded_submissions - a.pending_grading + a.assignments_last_month * 2;
        const scoreB = b.graded_submissions - b.pending_grading + b.assignments_last_month * 2;
        return scoreB - scoreA;
      })
      .slice(0, 3);
  };

  const getNeedsAttention = () => {
    return [...teachers]
      .filter((t) => t.alert_level === "high" || t.alert_level === "medium" || t.pending_grading > 10)
      .sort((a, b) => {
        const priorityA = a.alert_level === "high" ? 3 : a.alert_level === "medium" ? 2 : 1;
        const priorityB = b.alert_level === "high" ? 3 : b.alert_level === "medium" ? 2 : 1;
        return priorityB - priorityA;
      })
      .slice(0, 3);
  };

  const exportToPDF = () => {
    toast.info("Generando reporte PDF... (Funcionalidad en desarrollo)");
    // Implementación futura con jsPDF o similar
  };

  const sendReminder = (teacherId: string, teacherName: string) => {
    toast.success(`Recordatorio enviado a ${teacherName}`);
    // Implementación futura con envío de email
  };

  const getTrendIcon = (current: number, previous: number) => {
    if (current > previous) return <ArrowUp className="h-4 w-4 text-green-500" />;
    if (current < previous) return <ArrowDown className="h-4 w-4 text-red-500" />;
    return <Minus className="h-4 w-4 text-gray-400 dark:text-gray-500" />;
  };

  const getTrendPercentage = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? "+100%" : "0%";
    const change = ((current - previous) / previous) * 100;
    return change >= 0 ? `+${change.toFixed(0)}%` : `${change.toFixed(0)}%`;
  };

  const getAssignmentsForPeriod = () => {
    switch (selectedPeriod) {
      case "week":
        return stats.totalAssignmentsWeek;
      case "month":
        return stats.totalAssignmentsMonth;
      case "quarter":
        return stats.totalAssignmentsQuarter;
      case "all":
        return stats.totalAssignmentsAllTime;
      default:
        return stats.totalAssignmentsMonth;
    }
  };

  const getPeriodLabel = () => {
    switch (selectedPeriod) {
      case "week":
        return "Últimos 7 días";
      case "month":
        return "Últimos 30 días";
      case "quarter":
        return "Últimos 90 días";
      case "all":
        return "Todo el tiempo";
      default:
        return "Últimos 30 días";
    }
  };

  const getSeverityColor = (severity: string | null) => {
    switch (severity) {
      case "high":
        return "destructive";
      case "medium":
        return "default";
      case "low":
        return "secondary";
      default:
        return "outline";
    }
  };

  const getSeverityLabel = (severity: string | null) => {
    switch (severity) {
      case "high":
        return "Urgente";
      case "medium":
        return "Atención";
      case "low":
        return "Revisar";
      default:
        return "";
    }
  };

  // Calculate summary statistics
  const stats = {
    totalTeachers: teachers.length,
    activeTeachers: teachers.filter((t) => t.is_active).length,
    teachersWithAlerts: teachers.filter((t) => t.alert_level !== null).length,
    highPriorityAlerts: teachers.filter((t) => t.alert_level === "high").length,
    avgPendingGrading:
      teachers.length > 0
        ? Math.round(teachers.reduce((sum, t) => sum + t.pending_grading, 0) / teachers.length)
        : 0,
    totalPendingGrading: teachers.reduce((sum, t) => sum + t.pending_grading, 0),
    totalAssignmentsWeek: teachers.reduce((sum, t) => sum + t.assignments_last_week, 0),
    totalAssignmentsMonth: teachers.reduce((sum, t) => sum + t.assignments_last_month, 0),
    totalAssignmentsPreviousMonth: teachers.reduce((sum, t) => sum + (t.assignments_previous_month || 0), 0),
    totalAssignmentsQuarter: teachers.reduce((sum, t) => sum + (t.assignments_last_quarter || 0), 0),
    totalAssignmentsAllTime: teachers.reduce((sum, t) => sum + t.total_assignments, 0),
    totalExams: teachers.reduce((sum, t) => sum + t.total_exams, 0),
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header con botones de acción */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold">📊 Panel de Supervisión Docente</h1>
            <p className="text-lg text-muted-foreground mt-2">
              Monitoreo y análisis de actividad de profesores
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setIsSimpleMode(!isSimpleMode)} variant="outline" size="lg">
              {isSimpleMode ? <Eye className="mr-2 h-5 w-5" /> : <EyeOff className="mr-2 h-5 w-5" />}
              {isSimpleMode ? "Vista Avanzada" : "Vista Simple"}
            </Button>
            <Button onClick={exportToPDF} variant="outline" size="lg">
              <Download className="mr-2 h-5 w-5" />
              Exportar PDF
            </Button>
            <Button onClick={fetchTeacherData} variant="default" size="lg">
              <TrendingUp className="mr-2 h-5 w-5" />
              Actualizar
            </Button>
          </div>
        </div>

        {/* Resumen Ejecutivo - Top destacado */}
        <Card className="border-2 border-primary shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl flex items-center gap-2">
              <Trophy className="h-6 w-6 text-yellow-500" />
              📋 Resumen Ejecutivo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Selector de Periodo */}
            <div className="flex justify-end mb-4">
              <Select value={selectedPeriod} onValueChange={(v: any) => setSelectedPeriod(v)}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Seleccionar periodo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="week">Última semana</SelectItem>
                  <SelectItem value="month">Último mes</SelectItem>
                  <SelectItem value="quarter">Último trimestre</SelectItem>
                  <SelectItem value="all">Todo el tiempo</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Estado General */}
            <div className="grid gap-6 md:grid-cols-3">
              <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-300">
                <CardHeader>
                  <CardTitle className="text-lg">Estado General</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-5xl font-bold text-green-700">
                    {Math.round((stats.activeTeachers / stats.totalTeachers) * 100)}%
                  </div>
                  <p className="text-base text-green-800 mt-2">Profesores Activos</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {stats.activeTeachers} de {stats.totalTeachers} profesores
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-300">
                <CardHeader>
                  <CardTitle className="text-lg">Tareas - {getPeriodLabel()}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-5xl font-bold text-blue-700">
                    {getAssignmentsForPeriod()}
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    {selectedPeriod === "month" && getTrendIcon(stats.totalAssignmentsMonth, stats.totalAssignmentsPreviousMonth)}
                    <span className="text-sm">
                      {selectedPeriod === "month" 
                        ? getTrendPercentage(stats.totalAssignmentsMonth, stats.totalAssignmentsPreviousMonth)
                        : selectedPeriod === "all" 
                        ? `Total histórico` 
                        : `En el periodo`}
                    </span>
                  </div>
                  {selectedPeriod === "all" && stats.totalAssignmentsAllTime > 0 && (
                    <p className="text-xs text-muted-foreground mt-2">
                      {stats.totalAssignmentsMonth} en el último mes
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card className={`bg-gradient-to-br ${stats.highPriorityAlerts > 0 ? 'from-red-50 to-red-100 border-red-300' : 'from-green-50 to-green-100 border-green-300'}`}>
                <CardHeader>
                  <CardTitle className="text-lg">Alertas Urgentes</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className={`text-5xl font-bold ${stats.highPriorityAlerts > 0 ? 'text-red-700' : 'text-green-700'}`}>
                    {stats.highPriorityAlerts}
                  </div>
                  <p className={`text-base mt-2 ${stats.highPriorityAlerts > 0 ? 'text-red-800' : 'text-green-800'}`}>
                    {stats.highPriorityAlerts > 0 ? 'Requieren Atención' : '¡Todo en Orden!'}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Top 3 Destacados y Top 3 Necesitan Atención */}
            <div className="grid gap-6 md:grid-cols-2">
              {/* Top 3 Destacados */}
              <Card className="border-green-300 bg-green-50">
                <CardHeader>
                  <CardTitle className="text-xl flex items-center gap-2">
                    <Star className="h-6 w-6 text-yellow-500 fill-yellow-500" />
                    ⭐ Profesores Destacados
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {getTopPerformers().length > 0 ? (
                    getTopPerformers().map((teacher, idx) => (
                      <div key={teacher.teacher_id} className="flex items-center gap-4 p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
                        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-yellow-500 text-white font-bold text-xl">
                          {idx + 1}
                        </div>
                        <div className="flex-1">
                          <p className="text-lg font-bold">
                            {teacher.first_name} {teacher.last_name}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {teacher.graded_submissions} tareas calificadas • {teacher.total_assignments} tareas históricas
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Actividad reciente: {teacher.assignments_last_month} este mes
                          </p>
                        </div>
                        <Trophy className="h-8 w-8 text-yellow-500" />
                      </div>
                    ))
                  ) : (
                    <p className="text-muted-foreground text-center py-4">
                      No hay datos de profesores disponibles
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Top 3 Necesitan Atención */}
              <Card className="border-orange-300 bg-orange-50">
                <CardHeader>
                  <CardTitle className="text-xl flex items-center gap-2">
                    <Flag className="h-6 w-6 text-red-500" />
                    🚩 Requieren Seguimiento
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {getNeedsAttention().length > 0 ? (
                    getNeedsAttention().map((teacher, idx) => (
                      <div key={teacher.teacher_id} className="flex items-center gap-4 p-4 bg-white dark:bg-gray-800 rounded-lg shadow border-l-4 border-orange-500">
                        <AlertTriangle className="h-8 w-8 text-orange-500 flex-shrink-0" />
                        <div className="flex-1">
                          <p className="text-lg font-bold">
                            {teacher.first_name} {teacher.last_name}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {teacher.pending_grading} pendientes • {teacher.alert_reasons.join(", ")}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => sendReminder(teacher.teacher_id, `${teacher.first_name} ${teacher.last_name}`)}
                          >
                            <Mail className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8">
                      <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-2" />
                      <p className="text-lg font-medium">¡Excelente!</p>
                      <p className="text-sm text-muted-foreground">No hay profesores que requieran atención especial</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </CardContent>
        </Card>

        {/* Panel de Historial de Actividad */}
        <Card className="border-2 border-indigo-300 shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl flex items-center gap-2">
              <TrendingUp className="h-6 w-6 text-indigo-500" />
              📈 Historial de Actividad
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              <Card className={selectedPeriod === "week" ? "border-2 border-indigo-500" : ""}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Última Semana</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-indigo-600">
                    {stats.totalAssignmentsWeek}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">tareas creadas</p>
                </CardContent>
              </Card>

              <Card className={selectedPeriod === "month" ? "border-2 border-indigo-500" : ""}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Último Mes</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-indigo-600">
                    {stats.totalAssignmentsMonth}
                  </div>
                  <div className="flex items-center gap-1 mt-1">
                    {getTrendIcon(stats.totalAssignmentsMonth, stats.totalAssignmentsPreviousMonth)}
                    <span className="text-xs text-muted-foreground">
                      vs mes anterior ({stats.totalAssignmentsPreviousMonth})
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card className={selectedPeriod === "quarter" ? "border-2 border-indigo-500" : ""}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Último Trimestre</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-indigo-600">
                    {stats.totalAssignmentsQuarter}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">últimos 90 días</p>
                </CardContent>
              </Card>

              <Card className={selectedPeriod === "all" ? "border-2 border-indigo-500" : ""}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Histórico Total</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-purple-600">
                    {stats.totalAssignmentsAllTime}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">todas las tareas</p>
                </CardContent>
              </Card>
            </div>

            {/* Análisis de tendencia */}
            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
              <h3 className="font-bold text-lg mb-3">📊 Análisis de Tendencia</h3>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <p className="text-sm font-medium">Comparación Mensual</p>
                  <div className="flex items-center gap-2 mt-1">
                    {stats.totalAssignmentsMonth > stats.totalAssignmentsPreviousMonth ? (
                      <>
                        <ArrowUp className="h-5 w-5 text-green-600" />
                        <span className="text-green-600 font-bold">
                          {getTrendPercentage(stats.totalAssignmentsMonth, stats.totalAssignmentsPreviousMonth)}
                        </span>
                        <span className="text-sm text-muted-foreground">de incremento</span>
                      </>
                    ) : stats.totalAssignmentsMonth < stats.totalAssignmentsPreviousMonth ? (
                      <>
                        <ArrowDown className="h-5 w-5 text-red-600" />
                        <span className="text-red-600 font-bold">
                          {getTrendPercentage(stats.totalAssignmentsMonth, stats.totalAssignmentsPreviousMonth)}
                        </span>
                        <span className="text-sm text-muted-foreground">de disminución</span>
                      </>
                    ) : (
                      <span className="text-sm text-muted-foreground">Sin cambios respecto al mes anterior</span>
                    )}
                  </div>
                </div>
                
                <div>
                  <p className="text-sm font-medium">Promedio Semanal</p>
                  <div className="text-2xl font-bold text-indigo-600 mt-1">
                    {Math.round(stats.totalAssignmentsMonth / 4.3)}
                  </div>
                  <p className="text-xs text-muted-foreground">tareas por semana (aprox.)</p>
                </div>
              </div>

              {stats.totalAssignmentsMonth === 0 && stats.totalAssignmentsAllTime > 0 && (
                <div className="mt-4 p-3 bg-yellow-100 border-l-4 border-yellow-500 rounded">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
                    <div>
                      <p className="font-medium text-yellow-800">⚠️ Atención: Inactividad Detectada</p>
                      <p className="text-sm text-yellow-700 mt-1">
                        No hay tareas creadas en el último mes, pero hay {stats.totalAssignmentsAllTime} tareas en el historial total.
                        Esto puede indicar una disminución en la actividad docente.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Stats mejoradas con barras visuales - Solo en modo avanzado */}
        {!isSimpleMode && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Card className="group hover:shadow-lg transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base font-medium">Total Profesores</CardTitle>
                  <div className="group relative">
                    <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block bg-gray-900 text-white text-xs rounded py-1 px-2 whitespace-nowrap z-10">
                      Número total de profesores en el sistema
                    </div>
                  </div>
                </div>
                <Users className="h-5 w-5 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stats.totalTeachers}</div>
                <div className="mt-2">
                  <div className="flex justify-between text-xs mb-1">
                    <span>Activos</span>
                    <span className="font-medium">{stats.activeTeachers}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div 
                      className="bg-green-500 h-3 rounded-full transition-all"
                      style={{ width: `${(stats.activeTeachers / stats.totalTeachers) * 100}%` }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="group hover:shadow-lg transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base font-medium">Alertas Activas</CardTitle>
                  <div className="group relative">
                    <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block bg-gray-900 text-white text-xs rounded py-1 px-2 whitespace-nowrap z-10">
                      Profesores que requieren seguimiento
                    </div>
                  </div>
                </div>
                <AlertCircle className="h-5 w-5 text-orange-500" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stats.teachersWithAlerts}</div>
                <div className="mt-2">
                  <div className="flex justify-between text-xs mb-1">
                    <span>Urgentes</span>
                    <span className="font-medium text-red-600">{stats.highPriorityAlerts}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div 
                      className="bg-red-500 h-3 rounded-full transition-all"
                      style={{ width: stats.teachersWithAlerts > 0 ? `${(stats.highPriorityAlerts / stats.teachersWithAlerts) * 100}%` : '0%' }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="group hover:shadow-lg transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base font-medium">Tareas Pendientes</CardTitle>
                  <div className="group relative">
                    <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block bg-gray-900 text-white text-xs rounded py-1 px-2 whitespace-nowrap z-10">
                      Entregas esperando calificación
                    </div>
                  </div>
                </div>
                <Clock className="h-5 w-5 text-yellow-500" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stats.totalPendingGrading}</div>
                <div className="mt-2">
                  <div className="flex justify-between text-xs mb-1">
                    <span>Promedio por profesor</span>
                    <span className="font-medium">{stats.avgPendingGrading}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div 
                      className={`h-3 rounded-full transition-all ${stats.avgPendingGrading > 10 ? 'bg-red-500' : stats.avgPendingGrading > 5 ? 'bg-yellow-500' : 'bg-green-500'}`}
                      style={{ width: `${Math.min((stats.avgPendingGrading / 20) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="group hover:shadow-lg transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base font-medium">Tareas Semanales</CardTitle>
                  <div className="group relative">
                    <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block bg-gray-900 text-white text-xs rounded py-1 px-2 whitespace-nowrap z-10">
                      Tareas publicadas en los últimos 7 días
                    </div>
                  </div>
                </div>
                <FileText className="h-5 w-5 text-purple-500" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stats.totalAssignmentsWeek}</div>
                <p className="text-sm text-muted-foreground mt-1">Últimos 7 días</p>
              </CardContent>
            </Card>

            <Card className="group hover:shadow-lg transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base font-medium">Tareas Mensuales</CardTitle>
                  <div className="group relative">
                    <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block bg-gray-900 text-white text-xs rounded py-1 px-2 whitespace-nowrap z-10">
                      Tareas publicadas en los últimos 30 días
                    </div>
                  </div>
                </div>
                <BookOpen className="h-5 w-5 text-indigo-500" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stats.totalAssignmentsMonth}</div>
                <p className="text-sm text-muted-foreground mt-1">Últimos 30 días</p>
              </CardContent>
            </Card>

            <Card className="group hover:shadow-lg transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base font-medium">Exámenes Totales</CardTitle>
                  <div className="group relative">
                    <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block bg-gray-900 text-white text-xs rounded py-1 px-2 whitespace-nowrap z-10">
                      Exámenes creados por todos los profesores
                    </div>
                  </div>
                </div>
                <GraduationCap className="h-5 w-5 text-teal-500" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stats.totalExams}</div>
                <p className="text-sm text-muted-foreground mt-1">Total creados</p>
              </CardContent>
            </Card>
          </div>
        )}

      {/* Filters and Search */}
      <Card>
        <CardHeader>
          <CardTitle>Filtros de Búsqueda</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4 flex-wrap">
            <div className="flex-1 min-w-[250px]">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nombre o email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <Select value={activeFilter} onValueChange={(v: any) => setActiveFilter(v)}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los profesores</SelectItem>
                <SelectItem value="active">Solo activos</SelectItem>
                <SelectItem value="needs-attention">Necesitan atención</SelectItem>
              </SelectContent>
            </Select>
            <Select value={selectedSeverity} onValueChange={setSelectedSeverity}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Severidad" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las severidades</SelectItem>
                <SelectItem value="high">Urgente</SelectItem>
                <SelectItem value="medium">Atención</SelectItem>
                <SelectItem value="low">Revisar</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Teachers Table con sistema de semáforo */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="text-2xl">👥 Profesores ({filteredTeachers.length})</CardTitle>
            <div className="flex gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-green-500"></div>
                <span>Normal</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-yellow-500"></div>
                <span>Seguimiento</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-orange-500"></div>
                <span>Atención</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-red-500"></div>
                <span>Urgente</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-gray-400"></div>
                <span>Inactivo</span>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="text-base">
                  <TableHead className="w-8"></TableHead>
                  <TableHead className="text-base">Profesor</TableHead>
                  <TableHead className="text-base">Estado</TableHead>
                  <TableHead className="text-base">Tareas Periodo</TableHead>
                  <TableHead className="text-base">Total Histórico</TableHead>
                  <TableHead className="text-base">Pendientes</TableHead>
                  <TableHead className="text-base">Exámenes</TableHead>
                  <TableHead className="text-base">Última Actividad</TableHead>
                  <TableHead className="text-base">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTeachers.map((teacher) => {
                  const statusColor = getStatusColor(teacher);
                  const statusText = getStatusText(teacher);
                  
                  return (
                    <TableRow key={teacher.teacher_id} className="text-base">
                      {/* Indicador de semáforo */}
                      <TableCell>
                        <div className="relative group">
                          <div className={`w-6 h-6 rounded-full ${statusColor} shadow-lg`}></div>
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block bg-gray-900 text-white text-xs rounded py-1 px-2 whitespace-nowrap z-10">
                            {statusText}
                          </div>
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        <div>
                          <div className="font-bold text-base">
                            {teacher.first_name} {teacher.last_name}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {teacher.email}
                          </div>
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        <div className="text-lg font-bold">{statusText}</div>
                      </TableCell>
                      
                      <TableCell>
                        <div className="space-y-1">
                          <div className="text-2xl font-bold text-center">
                            {selectedPeriod === "week" ? teacher.assignments_last_week :
                             selectedPeriod === "month" ? teacher.assignments_last_month :
                             selectedPeriod === "quarter" ? teacher.assignments_last_quarter || 0 :
                             teacher.total_assignments}
                          </div>
                          <div className="text-xs text-muted-foreground text-center">
                            {getPeriodLabel()}
                          </div>
                          {teacher.assignments_last_month > 0 && (
                            <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                              <div 
                                className="bg-blue-500 h-2 rounded-full"
                                style={{ width: `${Math.min((teacher.assignments_last_month / 20) * 100, 100)}%` }}
                              />
                            </div>
                          )}
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="space-y-1">
                          <div className="text-xl font-bold text-center text-purple-600">
                            {teacher.total_assignments}
                          </div>
                          <div className="text-xs text-muted-foreground text-center">
                            todas las tareas
                          </div>
                          {teacher.total_assignments === 0 && (
                            <Badge variant="outline" className="text-xs">
                              Sin historial
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        <div className="space-y-1">
                          <Badge
                            variant={
                              teacher.pending_grading > 10
                                ? "destructive"
                                : teacher.pending_grading > 5
                                ? "default"
                                : "secondary"
                            }
                            className="text-lg px-3 py-1"
                          >
                            {teacher.pending_grading}
                          </Badge>
                          <div className="text-xs text-muted-foreground text-center">
                            {teacher.graded_submissions} calificadas
                          </div>
                        </div>
                      </TableCell>
                      
                      <TableCell className="text-center">
                        <div className="text-xl font-bold">{teacher.total_exams}</div>
                      </TableCell>
                      
                      <TableCell>
                        <div className="text-base">
                          {teacher.last_grading_date ? (
                            <>
                              <div className="font-medium">
                                {formatDate(teacher.last_grading_date)}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {Math.floor((Date.now() - new Date(teacher.last_grading_date).getTime()) / (1000 * 60 * 60 * 24))} días
                              </div>
                            </>
                          ) : (
                            <span className="text-muted-foreground">Sin actividad</span>
                          )}
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            size="lg"
                            variant="outline"
                            onClick={() => navigate(`/teacher/${teacher.teacher_id}`)}
                          >
                            📋 Ver Detalles
                          </Button>
                          {teacher.alert_level && (
                            <Button
                              size="lg"
                              variant="outline"
                              onClick={() => sendReminder(teacher.teacher_id, `${teacher.first_name} ${teacher.last_name}`)}
                            >
                              <Mail className="h-5 w-5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Sistema de Rankings - Solo en modo avanzado */}
      {!isSimpleMode && (
        <div className="grid gap-6 md:grid-cols-3">
          <Card className="border-yellow-300 bg-gradient-to-br from-yellow-50 to-orange-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Trophy className="h-6 w-6 text-yellow-600" />
                🏆 Más Productivos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[...teachers]
                  .filter((t) => t.is_active)
                  .sort((a, b) => b.assignments_last_month - a.assignments_last_month)
                  .slice(0, 5)
                  .map((teacher, idx) => (
                    <div key={teacher.teacher_id} className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
                      <div className={`flex items-center justify-center w-8 h-8 rounded-full ${idx === 0 ? 'bg-yellow-500' : idx === 1 ? 'bg-gray-400' : idx === 2 ? 'bg-orange-600' : 'bg-gray-200'} text-white font-bold`}>
                        {idx + 1}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-sm dark:text-gray-200">
                          {teacher.first_name} {teacher.last_name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {teacher.assignments_last_month} tareas este mes
                        </p>
                      </div>
                      <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                        {teacher.assignments_last_month}
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-green-300 bg-gradient-to-br from-green-50 to-emerald-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <UserCheck className="h-6 w-6 text-green-600" />
                ⚡ Más Rápidos Calificando
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[...teachers]
                  .filter((t) => t.is_active && t.graded_submissions > 0)
                  .sort((a, b) => a.pending_grading - b.pending_grading)
                  .slice(0, 5)
                  .map((teacher, idx) => (
                    <div key={teacher.teacher_id} className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
                      <div className={`flex items-center justify-center w-8 h-8 rounded-full ${idx === 0 ? 'bg-yellow-500' : idx === 1 ? 'bg-gray-400' : idx === 2 ? 'bg-orange-600' : 'bg-gray-200'} text-white font-bold`}>
                        {idx + 1}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-sm dark:text-gray-200">
                          {teacher.first_name} {teacher.last_name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {teacher.graded_submissions} calificadas
                        </p>
                      </div>
                      <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                        {teacher.pending_grading}
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-purple-300 bg-gradient-to-br from-purple-50 to-pink-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <GraduationCap className="h-6 w-6 text-purple-600" />
                📝 Más Exámenes Creados
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[...teachers]
                  .filter((t) => t.is_active && t.total_exams > 0)
                  .sort((a, b) => b.total_exams - a.total_exams)
                  .slice(0, 5)
                  .map((teacher, idx) => (
                    <div key={teacher.teacher_id} className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
                      <div className={`flex items-center justify-center w-8 h-8 rounded-full ${idx === 0 ? 'bg-yellow-500' : idx === 1 ? 'bg-gray-400' : idx === 2 ? 'bg-orange-600' : 'bg-gray-200'} text-white font-bold`}>
                        {idx + 1}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-sm dark:text-gray-200">
                          {teacher.first_name} {teacher.last_name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {teacher.total_exams} exámenes
                        </p>
                      </div>
                      <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                        {teacher.total_exams}
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      </div>
    </DashboardLayout>
  );
};

export default DirectivoDashboard;
