// TODO: Requiere tabla 'schedules' en Supabase

import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

interface ParentStudentScheduleProps {
  studentId: string;
}

export default function ParentStudentSchedule({ studentId }: ParentStudentScheduleProps) {
  return (
    <Card>
      <CardContent className="pt-6">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Funcionalidad en desarrollo:</strong> El horario de clases requiere configuración de base de datos.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
