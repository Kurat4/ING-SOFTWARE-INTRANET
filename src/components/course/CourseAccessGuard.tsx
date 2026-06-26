import { ReactNode, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { AlertCircle, Lock, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

interface CourseAccessGuardProps {
  courseId: string;
  children: ReactNode;
}

export const CourseAccessGuard = ({ courseId, children }: CourseAccessGuardProps) => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAccess();
  }, [courseId, profile]);

  const checkAccess = async () => {
    if (!profile) {
      setLoading(false);
      return;
    }

    // Admins y profesores siempre tienen acceso
    if (profile.role === 'admin' || profile.role === 'teacher') {
      setHasAccess(true);
      setLoading(false);
      return;
    }

    // Para estudiantes, verificar el estado de acceso
    if (profile.role === 'student') {
      try {
        const { data, error } = await supabase
          .from('course_enrollments')
          .select('id, access_status')
          .eq('student_id', profile.id)
          .eq('modulo_id', courseId)
          .maybeSingle();

        if (error) {
          console.error('Error checking course access:', error);
          setHasAccess(false);
          setLoading(false);
          return;
        }

        if (!data) {
          // No está matriculado
          setHasAccess(false);
          setPaymentStatus(null);
        } else {
          const status = (data.access_status as string) || 'pending';
          setPaymentStatus(status);
          // Solo tiene acceso si el estado es 'granted'
          setHasAccess(status === 'granted');
        }
      } catch (error) {
        console.error('Error:', error);
        setHasAccess(false);
      }
    }

    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Si tiene acceso, mostrar el contenido
  if (hasAccess) {
    return <>{children}</>;
  }

  // Si no tiene acceso, mostrar mensaje apropiado
  return (
    <div className="p-6">
      <Card className="bg-gradient-card shadow-card border-0 max-w-2xl mx-auto">
        <CardContent className="p-8">
          <div className="text-center space-y-4">
            {paymentStatus === 'blocked' ? (
              <>
                <div className="flex justify-center">
                  <div className="rounded-full bg-destructive/10 p-4">
                    <Lock className="w-12 h-12 text-destructive" />
                  </div>
                </div>
                <h2 className="text-2xl font-bold text-destructive">Acceso Bloqueado</h2>
                <p className="text-muted-foreground">
                  Tu acceso a este curso ha sido bloqueado debido a pagos pendientes.
                </p>
                <p className="text-sm text-muted-foreground">
                  Por favor, contacta con la administración para regularizar tu situación.
                </p>
              </>
            ) : paymentStatus === 'pending' ? (
              <>
                <div className="flex justify-center">
                  <div className="rounded-full bg-yellow-500/10 p-4">
                    <DollarSign className="w-12 h-12 text-yellow-600" />
                  </div>
                </div>
                <h2 className="text-2xl font-bold">Pago Pendiente</h2>
                <p className="text-muted-foreground">
                  Tu matrícula está en proceso de verificación.
                </p>
                <p className="text-sm text-muted-foreground">
                  Una vez que el administrador verifique tu pago, tendrás acceso completo al curso.
                </p>
              </>
            ) : (
              <>
                <div className="flex justify-center">
                  <div className="rounded-full bg-destructive/10 p-4">
                    <AlertCircle className="w-12 h-12 text-destructive" />
                  </div>
                </div>
                <h2 className="text-2xl font-bold text-destructive">Acceso Denegado</h2>
                <p className="text-muted-foreground">
                  No estás matriculado en este curso o no tienes permisos para acceder.
                </p>
              </>
            )}
            
            <div className="pt-4">
              <Button 
                onClick={() => navigate('/courses')}
                variant="outline"
              >
                Volver a Mis Cursos
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
