import { useAuth } from '@/hooks/useAuth';
import { ParentLayout } from '@/components/layout/ParentLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Bell, AlertCircle } from 'lucide-react';

export default function ParentNotifications() {
  const { user } = useAuth();

  return (
    <ParentLayout>
      <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Notificaciones</h1>
              <p className="text-muted-foreground">
                Mantente informado sobre las actividades de tus hijos
              </p>
            </div>

          <Card>
            <CardHeader>
              <CardTitle>Centro de Notificaciones</CardTitle>
            </CardHeader>
            <CardContent>
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Funcionalidad en desarrollo:</strong> El sistema de notificaciones requiere configuración de base de datos (tabla 'notifications').
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
      </div>
    </ParentLayout>
  );
}
