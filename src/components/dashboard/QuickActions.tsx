import { BookOpen, FileText, Calendar, ClipboardList } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const quickActions = [
  {
    title: "Mis Cursos",
    description: "Ver todos mis cursos",
    icon: BookOpen,
    color: "primary" as const,
    link: "/courses",
  },
  {
    title: "Tareas",
    description: "Ver tareas pendientes",
    icon: FileText,
    color: "secondary" as const,
    link: "/assignments",
  },
  {
    title: "Exámenes",
    description: "Revisar exámenes",
    icon: ClipboardList,
    color: "accent" as const,
    link: "/exams",
  },
  {
    title: "Calendario",
    description: "Ver calendario académico",
    icon: Calendar,
    color: "primary" as const,
    link: "/calendar",
  },
];

export function QuickActions() {
  return (
    <Card className="bg-gradient-card dark:bg-gray-800 shadow-card border-0 dark:border dark:border-gray-700">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-foreground dark:text-white">
          Acciones Rápidas
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          {quickActions.map((action) => {
            const Icon = action.icon;
            const colorClasses = {
              primary: "bg-gradient-primary dark:bg-blue-900/40 hover:shadow-glow text-primary-foreground dark:text-blue-200",
              secondary: "bg-gradient-secondary dark:bg-purple-900/40 hover:shadow-soft text-secondary-foreground dark:text-purple-200",
              accent: "bg-accent dark:bg-yellow-900/40 hover:shadow-soft text-accent-foreground dark:text-yellow-200"
            };

            return (
              <Link key={action.title} to={action.link}>
                <Button
                  variant="outline"
                  className={`h-auto p-4 flex flex-col gap-2 border-0 w-full ${colorClasses[action.color]} transition-all duration-300`}
                >
                  <Icon className="w-5 h-5" />
                  <div className="text-center">
                    <div className="text-sm font-medium">{action.title}</div>
                    <div className="text-xs opacity-90">{action.description}</div>
                  </div>
                </Button>
              </Link>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}