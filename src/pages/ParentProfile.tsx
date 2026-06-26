import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { ParentLayout } from '@/components/layout/ParentLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Save, Mail, Phone } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ProfileData {
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
}

export default function ParentProfile() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [profile, setProfile] = useState<ProfileData>({
    first_name: '',
    last_name: '',
    email: '',
    phone: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadProfile();
  }, [user]);

  const loadProfile = async () => {
    try {
      setLoading(true);

      // Changed from .single() to .maybeSingle() to handle 0 rows without error 406
      const { data, error } = await supabase
        .from('profiles')
        .select('first_name, last_name, email, phone')
        .eq('id', user?.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setProfile({
          first_name: data.first_name || '',
          last_name: data.last_name || '',
          email: data.email || '',
          phone: data.phone || ''
        });
      } else {
        // Profile not found - this might happen if RLS is blocking access
        console.warn('Profile not found or access denied for user:', user?.id);
        toast({
          title: 'Advertencia',
          description: 'No se pudo cargar el perfil. Por favor, contacta al administrador.',
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      toast({
        title: 'Error',
        description: 'Error al cargar el perfil',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      const { error } = await supabase
        .from('profiles')
        .update({
          first_name: profile.first_name,
          last_name: profile.last_name,
          phone: profile.phone
        })
        .eq('id', user?.id);

      if (error) throw error;

      toast({
        title: 'Perfil actualizado',
        description: 'Tus datos han sido guardados correctamente',
      });
    } catch (error) {
      console.error('Error saving profile:', error);
      toast({
        title: 'Error',
        description: 'No se pudo guardar los cambios',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field: keyof ProfileData, value: string) => {
    setProfile(prev => ({ ...prev, [field]: value }));
  };

  if (loading) {
    return (
      <ParentLayout>
        <p className="text-center text-muted-foreground">Cargando perfil...</p>
      </ParentLayout>
    );
  }

  return (
    <ParentLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Datos Personales</h1>
          <p className="text-muted-foreground">
            Mantén actualizados tus datos de contacto
          </p>
        </div>

        <div className="max-w-2xl">
          <Card>
            <CardHeader>
              <CardTitle>Información Personal</CardTitle>
              <CardDescription>
                Actualiza tu información de contacto y datos personales
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="first_name">Nombre</Label>
                  <Input
                    id="first_name"
                    value={profile.first_name}
                    onChange={(e) => handleChange('first_name', e.target.value)}
                    placeholder="Tu nombre"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="last_name">Apellido</Label>
                  <Input
                    id="last_name"
                    value={profile.last_name}
                    onChange={(e) => handleChange('last_name', e.target.value)}
                    placeholder="Tu apellido"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Correo Electrónico
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={profile.email}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">
                  El correo no puede ser modificado
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone" className="flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  Teléfono
                </Label>
                <Input
                  id="phone"
                  type="tel"
                  value={profile.phone}
                  onChange={(e) => handleChange('phone', e.target.value)}
                  placeholder="Tu número de teléfono"
                />
              </div>

              <Alert>
                <AlertDescription>
                  Campos adicionales como DNI y dirección estarán disponibles próximamente.
                </AlertDescription>
              </Alert>

              <Alert>
                <AlertDescription>
                  Mantén tus datos de contacto actualizados para recibir comunicaciones importantes del instituto.
                </AlertDescription>
              </Alert>

              <Button
                onClick={handleSave}
                disabled={saving}
                className="w-full"
              >
                {saving ? (
                  <>Guardando...</>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Guardar Cambios
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </ParentLayout>
  );
}
