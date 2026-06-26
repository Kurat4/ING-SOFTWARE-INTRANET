// TODO: Requiere tabla 'messages' en Supabase

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { MessageSquare, AlertCircle } from 'lucide-react';

interface ParentStudentMessagesProps {
  studentId: string;
}

export default function ParentStudentMessages({ studentId }: ParentStudentMessagesProps) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Contactar Profesores
          </CardTitle>
          <CardDescription>
            Envía un mensaje o solicita una reunión con los docentes de tu hijo/a
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Funcionalidad en desarrollo:</strong> El sistema de mensajes requiere configuración.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <label className="text-sm font-medium">Tu mensaje</label>
            <Textarea
              placeholder="Escribe tu consulta o solicitud de reunión..."
              rows={6}
              className="resize-none"
              disabled
            />
          </div>

          <Button disabled className="w-full">
            Función en desarrollo
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
