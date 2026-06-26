import { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface StatsCardProps {
  title: string;
  value: string;
  icon: LucideIcon;
  description?: string;
  color?: "primary" | "secondary" | "accent";
}

export function StatsCard({ 
  title, 
  value, 
  icon: Icon, 
  description, 
  color = "primary" 
}: StatsCardProps) {
  const colorClasses = {
    primary: "bg-gradient-primary text-primary-foreground",
    secondary: "bg-gradient-secondary text-secondary-foreground", 
    accent: "bg-accent text-accent-foreground"
  };

  return (
    <Card className="bg-gradient-card dark:bg-gray-800 shadow-card hover:shadow-soft transition-all duration-300 border-0 dark:border dark:border-gray-700">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground dark:text-gray-400">{title}</p>
            <p className="text-3xl font-bold text-foreground dark:text-white">{value}</p>
            {description && (
              <p className="text-sm text-muted-foreground dark:text-gray-400">{description}</p>
            )}
          </div>
          <div className={`w-12 h-12 rounded-lg ${colorClasses[color]} flex items-center justify-center shadow-soft`}>
            <Icon className="w-6 h-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}