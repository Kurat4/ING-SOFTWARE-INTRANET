// TODO: Requiere tabla 'grades' en Supabase

import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

interface ParentStudentGradesProps {
  studentId: string;
}

export default function ParentStudentGrades({ studentId }: ParentStudentGradesProps) {
  return (
    <Card>
      <CardContent className="pt-6">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Funcionalidad en desarrollo:</strong> Las calificaciones requieren configuración de base de datos.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
