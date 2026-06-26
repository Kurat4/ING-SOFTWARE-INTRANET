// TODO: Requiere tabla 'documents' en Supabase

import { useAuth } from '@/hooks/useAuth';
import { ParentLayout } from '@/components/layout/ParentLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { FileText, AlertCircle } from 'lucide-react';

export default function ParentDocuments() {
  const { user } = useAuth();

  return (
    <ParentLayout>
      <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Documentos</h1>
              <p className="text-muted-foreground">
                Accede a documentos importantes y constancias
              </p>
            </div>

            <Card>
              <CardContent className="pt-6">
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Funcionalidad en desarrollo:</strong> El sistema de documentos requiere configuración de base de datos.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </div>
        </ParentLayout>
  );
}
