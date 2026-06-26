import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, ArrowLeft, Mail } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';

const Auth = () => {
  const { user, profile, loading: authLoading, signIn } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);

  // Form states
  const [loginData, setLoginData] = useState({ email: '', password: '' });

  // Redirect if already authenticated - wait for profile to load
  if (user && !authLoading && profile) {
    // Redirect based on role
    const roleRoutes: Record<string, string> = {
      'parent': '/parent/admin',
      'admin': '/admin/dashboard',
      'directivo': '/directivo-dashboard',
      'tutor': '/tutor-dashboard',
      'teacher': '/',
      'student': '/'
    };
    
    const redirectPath = roleRoutes[profile.role] || '/';
    return <Navigate to={redirectPath} replace />;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { error } = await signIn(loginData.email, loginData.password);
      if (error) {
        setError(error.message);
      } else {
        toast({
          title: "¡Bienvenido!",
          description: "Has iniciado sesión correctamente.",
        });
      }
    } catch (err) {
      setError('Error inesperado al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail) return;
    setForgotLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setForgotSent(true);
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'No se pudo enviar el correo.',
        variant: 'destructive',
      });
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/20 via-background to-secondary/20 p-4">
      <Card className="w-full max-w-md bg-gradient-card shadow-glow border-0">
        <CardHeader className="text-center">
          <div className="flex flex-col items-center justify-center gap-3 mb-2">
            <div className="w-20 h-20 rounded-full overflow-hidden bg-white shadow-lg">
              <img 
                src="/peri-logo.png" 
                alt="Peri Institute Logo" 
                className="w-full h-full object-cover"
              />
            </div>
            <CardTitle className="text-2xl font-bold text-foreground">
              Peri Institute
            </CardTitle>
          </div>
          <p className="text-muted-foreground">Plataforma Intranet</p>
        </CardHeader>
        <CardContent>
          {/* ── Panel: Olvidé mi contraseña ── */}
          {showForgot ? (
            <div className="space-y-4">
              {forgotSent ? (
                <div className="text-center space-y-3 py-2">
                  <div className="flex justify-center">
                    <Mail className="h-10 w-10 text-[#C9438C]" />
                  </div>
                  <p className="font-semibold text-[#2B3F5C]">Revisa tu correo</p>
                  <p className="text-sm text-muted-foreground">
                    Enviamos un enlace de recuperación a <strong>{forgotEmail}</strong>.
                    Puede tardar unos minutos.
                  </p>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => { setShowForgot(false); setForgotSent(false); setForgotEmail(''); }}
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" /> Volver al inicio de sesión
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Ingresa tu correo y te enviaremos un enlace para restablecer tu contraseña.
                  </p>
                  <div className="space-y-2">
                    <Label htmlFor="forgot-email">Correo electrónico</Label>
                    <Input
                      id="forgot-email"
                      type="email"
                      placeholder="tucorreo@ejemplo.com"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      required
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full bg-gradient-primary shadow-glow"
                    disabled={forgotLoading}
                  >
                    {forgotLoading ? 'Enviando...' : 'Enviar enlace de recuperación'}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full"
                    onClick={() => { setShowForgot(false); setForgotEmail(''); }}
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" /> Volver
                  </Button>
                </form>
              )}
            </div>
          ) : (
            /* ── Panel: Login normal ── */
            <div className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email">Correo electrónico</Label>
                  <Input
                    id="login-email"
                    type="email"
                    placeholder="estudiante@periinstitute.edu.co"
                    value={loginData.email}
                    onChange={(e) => setLoginData(prev => ({ ...prev, email: e.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">Contraseña</Label>
                  <Input
                    id="login-password"
                    type="password"
                    placeholder="••••••••"
                    value={loginData.password}
                    onChange={(e) => setLoginData(prev => ({ ...prev, password: e.target.value }))}
                    required
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full bg-gradient-primary shadow-glow"
                  disabled={loading}
                >
                  {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
                </Button>
              </form>
              <div className="text-center">
                <button
                  type="button"
                  className="text-sm text-[#C9438C] hover:underline"
                  onClick={() => setShowForgot(true)}
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;