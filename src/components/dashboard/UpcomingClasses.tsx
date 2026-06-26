import { Calendar, Clock, Users, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const upcomingClasses = [
  {
    id: 1,
    subject: "Matemáticas",
    teacher: "Prof. García",
    time: "10:00 AM - 11:00 AM",
    date: "Hoy",
    students: 25,
    isLive: true,
  },
  {
    id: 2,
    subject: "Historia",
    teacher: "Prof. Martínez", 
    time: "2:00 PM - 3:00 PM",
    date: "Hoy",
    students: 28,
    isLive: false,
  },
  {
    id: 3,
    subject: "Química",
    teacher: "Prof. López",
    time: "9:00 AM - 10:00 AM", 
    date: "Mañana",
    students: 22,
    isLive: false,
  },
];

export function UpcomingClasses() {
  return (
    <Card className="bg-gradient-card dark:bg-gray-800 shadow-card border-0 dark:border dark:border-gray-700">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-foreground dark:text-white flex items-center gap-2">
          <Calendar className="w-5 h-5" />
          Próximas Clases
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {upcomingClasses.map((classItem) => (
            <div
              key={classItem.id}
              className="flex items-center justify-between p-4 rounded-lg bg-background/60 dark:bg-gray-700/50 border border-border/50 dark:border-gray-600 hover:shadow-card dark:hover:bg-gray-700 transition-all duration-200"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-medium text-foreground dark:text-gray-200">{classItem.subject}</h4>
                  {classItem.isLive && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-accent dark:bg-yellow-900/40 text-accent-foreground dark:text-yellow-200 text-xs font-medium">
                      <div className="w-2 h-2 bg-accent-foreground dark:bg-yellow-200 rounded-full animate-pulse"></div>
                      En Vivo
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground dark:text-gray-400">{classItem.teacher}</p>
                <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground dark:text-gray-500">
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {classItem.time}
                  </div>
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {classItem.date}
                  </div>
                  <div className="flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    {classItem.students} estudiantes
                  </div>
                </div>
              </div>
              <div className="ml-4">
                <Button 
                  size="sm" 
                  variant={classItem.isLive ? "default" : "outline"}
                  className={classItem.isLive ? "bg-gradient-primary dark:bg-blue-900/60 shadow-glow" : ""}
                >
                  <Video className="w-4 h-4 mr-2" />
                  {classItem.isLive ? "Unirse" : "Programada"}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}