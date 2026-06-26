// TODO: Este componente requiere que se creen las siguientes tablas en Supabase:
// - attendance (con campos: id, student_id, course_id, date, status, notes)

import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

interface ParentStudentAttendanceProps {
  studentId: string;
}

export default function ParentStudentAttendance({ studentId }: ParentStudentAttendanceProps) {
  return (
    <Card>
      <CardContent className="pt-6">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Funcionalidad en desarrollo:</strong> El componente de asistencia requiere configuración de base de datos.
            <br />
            <br />
            <strong>Próximos pasos:</strong>
            <ul className="list-disc ml-5 mt-2">
              <li>Crear/configurar tabla 'attendance' en Supabase</li>
              <li>Implementar registro de asistencias por curso y fecha</li>
              <li>Agregar observaciones y justificaciones</li>
            </ul>
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
