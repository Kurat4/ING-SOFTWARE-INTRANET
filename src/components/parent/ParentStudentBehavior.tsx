// TODO: Requiere tabla 'behavior_reports' en Supabase

import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

interface ParentStudentBehaviorProps {
  studentId: string;
}

export default function ParentStudentBehavior({ studentId }: ParentStudentBehaviorProps) {
  return (
    <Card>
      <CardContent className="pt-6">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Funcionalidad en desarrollo:</strong> Los reportes de comportamiento requieren configuración de base de datos.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
