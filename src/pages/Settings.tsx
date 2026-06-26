import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { setUserTimezone } from '@/lib/timezoneUtils';
import { Input } from '@/components/ui/input';
import { 
  Shield, 
  Lock,
  Save,
  Loader2,
  Moon,
  Sun,
  Clock,
  Eye,
  EyeOff,
  KeyRound
} from 'lucide-react';

interface UserPreferences {
  darkMode: boolean;
  timezone: string;
}

export default function Settings() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [loadingPrefs, setLoadingPrefs] = useState(true);
  const [loadingPassword, setLoadingPassword] = useState(false);

  // Estados para cambio de contraseña
  const [passwordForm, setPasswordForm] = useState({
    newPassword: '',
    confirmPassword: '',
  });
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Estados para configuraciones
  const [preferences, setPreferences] = useState<UserPreferences>({
    darkMode: false,
    timezone: 'America/Lima', // Perú por defecto
  });

  // Cargar preferencias del usuario
  useEffect(() => {
    if (profile?.id) {
      loadUserPreferences();
    }
  }, [profile?.id]);

  const loadUserPreferences = async () => {
    try {
      setLoadingPrefs(true);
      // Intentar obtener las preferencias de la tabla profiles si existen
      const { data, error } = await supabase
        .from('profiles')
        .select('metadata')
        .eq('id', profile!.id)
        .single();

      if (!error && data?.metadata?.preferences) {
        const prefs = data.metadata.preferences;
        setPreferences({
          darkMode: prefs.darkMode ?? false,
          timezone: prefs.timezone ?? 'America/Lima',
        });
        
        // Aplicar tema oscuro si está activado
        if (prefs.darkMode) {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      }
    } catch (error) {
      console.error('Error loading preferences:', error);
    } finally {
      setLoadingPrefs(false);
    }
  };

  const handleSaveSettings = async () => {
    if (!profile?.id) return;
    
    setLoading(true);
    try {
      // Guardar zona horaria en localStorage
      setUserTimezone(preferences.timezone);
      
      // DEBUG: Verificar que se guardó
      console.log('Zona horaria guardada:', preferences.timezone);
      console.log('Zona horaria en localStorage:', localStorage.getItem('userTimezone'));
      
      // Guardar preferencias en el metadata del perfil
      const { error } = await supabase
        .from('profiles')
        .update({
          metadata: {
            preferences
          }
        })
        .eq('id', profile.id);

      if (error) throw error;
      
      toast({
        title: 'Configuración guardada',
        description: 'Tus preferencias han sido actualizadas correctamente. Recarga la página para ver los cambios.',
      });
    } catch (error: any) {
      console.error('Error saving settings:', error);
      toast({
        title: 'Error',
        description: 'No se pudo guardar la configuración.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async () => {
    const { newPassword, confirmPassword } = passwordForm;

    if (!newPassword || !confirmPassword) {
      toast({ title: 'Error', description: 'Completa todos los campos.', variant: 'destructive' });
      return;
    }
    if (newPassword.length < 6) {
      toast({ title: 'Error', description: 'La contraseña debe tener al menos 6 caracteres.', variant: 'destructive' });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: 'Error', description: 'Las contraseñas no coinciden.', variant: 'destructive' });
      return;
    }

    setLoadingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;

      toast({ title: '✅ Contraseña actualizada', description: 'Tu contraseña ha sido cambiada correctamente.' });
      setPasswordForm({ newPassword: '', confirmPassword: '' });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'No se pudo cambiar la contraseña.',
        variant: 'destructive',
      });
    } finally {
      setLoadingPassword(false);
    }
  };

  const updatePreference = (key: keyof UserPreferences, value: boolean | string) => {
    setPreferences(prev => {
      const newPrefs = { ...prev, [key]: value };
      
      // Aplicar tema oscuro inmediatamente al cambiar el switch
      if (key === 'darkMode') {
        if (value) {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      }
      
      return newPrefs;
    });
  };

  if (loadingPrefs) {
    return (
      <DashboardLayout>
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">Configuración</h1>
          <p className="text-muted-foreground mt-2">
            Administra tus preferencias de apariencia y seguridad
          </p>
        </div>

        <div className="space-y-6">
          {/* Apariencia */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Moon className="w-5 h-5 text-primary" />
                Apariencia
              </CardTitle>
              <CardDescription>
                Personaliza la apariencia de la plataforma
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="dark-mode">Modo Oscuro</Label>
                  <p className="text-sm text-muted-foreground">
                    Cambia entre modo claro y oscuro
                  </p>
                </div>
                <Switch
                  id="dark-mode"
                  checked={preferences.darkMode}
                  onCheckedChange={(val) => updatePreference('darkMode', val)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Zona Horaria */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary" />
                Zona Horaria
              </CardTitle>
              <CardDescription>
                Configura tu zona horaria local para mostrar las fechas correctamente
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="timezone">Zona Horaria</Label>
                <select
                  id="timezone"
                  value={preferences.timezone}
                  onChange={(e) => updatePreference('timezone', e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="America/Lima">Perú - Lima (GMT-5)</option>
                  <option value="America/Bogota">Colombia - Bogotá (GMT-5)</option>
                  <option value="America/Guayaquil">Ecuador - Guayaquil (GMT-5)</option>
                  <option value="America/Mexico_City">México - Ciudad de México (GMT-6)</option>
                  <option value="America/Caracas">Venezuela - Caracas (GMT-4)</option>
                  <option value="America/Argentina/Buenos_Aires">Argentina - Buenos Aires (GMT-3)</option>
                  <option value="America/Santiago">Chile - Santiago (GMT-4/-3)</option>
                  <option value="America/Montevideo">Uruguay - Montevideo (GMT-3)</option>
                  <option value="America/Asuncion">Paraguay - Asunción (GMT-4/-3)</option>
                  <option value="America/La_Paz">Bolivia - La Paz (GMT-4)</option>
                  <option value="America/Panama">Panamá (GMT-5)</option>
                  <option value="America/Costa_Rica">Costa Rica (GMT-6)</option>
                  <option value="America/Guatemala">Guatemala (GMT-6)</option>
                  <option value="America/Managua">Nicaragua (GMT-6)</option>
                  <option value="America/Tegucigalpa">Honduras (GMT-6)</option>
                  <option value="America/El_Salvador">El Salvador (GMT-6)</option>
                  <option value="America/Havana">Cuba - La Habana (GMT-5/-4)</option>
                  <option value="America/Santo_Domingo">República Dominicana (GMT-4)</option>
                  <option value="Europe/Madrid">España - Madrid (GMT+1/+2)</option>
                  <option value="UTC">UTC (GMT+0)</option>
                </select>
                <div className="mt-3 p-3 bg-muted rounded-md">
                  <p className="text-sm font-medium mb-1">Vista previa de zona horaria:</p>
                  <p className="text-xs text-muted-foreground">
                    Las fechas y horas se mostrarán según tu zona horaria seleccionada.
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    <strong>Ejemplo:</strong> Una tarea con límite a las 23:55 hora Perú se mostrará en tu hora local.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Seguridad */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-primary" />
                Seguridad
              </CardTitle>
              <CardDescription>
                Cambia tu contraseña de acceso directamente desde aquí
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                {/* Nueva contraseña */}
                <div className="space-y-2">
                  <Label htmlFor="new-password">Nueva contraseña</Label>
                  <div className="relative">
                    <Input
                      id="new-password"
                      type={showNew ? 'text' : 'password'}
                      placeholder="Mínimo 6 caracteres"
                      value={passwordForm.newPassword}
                      onChange={(e) => setPasswordForm(p => ({ ...p, newPassword: e.target.value }))}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNew(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Confirmar contraseña */}
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirmar nueva contraseña</Label>
                  <div className="relative">
                    <Input
                      id="confirm-password"
                      type={showConfirm ? 'text' : 'password'}
                      placeholder="Repite la nueva contraseña"
                      value={passwordForm.confirmPassword}
                      onChange={(e) => setPasswordForm(p => ({ ...p, confirmPassword: e.target.value }))}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {/* Indicador de coincidencia */}
                  {passwordForm.confirmPassword.length > 0 && (
                    <p className={`text-xs font-medium ${
                      passwordForm.newPassword === passwordForm.confirmPassword
                        ? 'text-green-600'
                        : 'text-destructive'
                    }`}>
                      {passwordForm.newPassword === passwordForm.confirmPassword
                        ? '✓ Las contraseñas coinciden'
                        : '✗ Las contraseñas no coinciden'}
                    </p>
                  )}
                </div>

                <Button
                  onClick={handlePasswordChange}
                  disabled={loadingPassword}
                  className="w-full"
                >
                  {loadingPassword ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Cambiando...</>
                  ) : (
                    <><KeyRound className="w-4 h-4 mr-2" />Cambiar contraseña</>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Botón Guardar */}
          <div className="flex justify-end gap-4">
            <Button 
              onClick={handleSaveSettings} 
              disabled={loading}
              className="min-w-[150px]"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Guardar Cambios
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
