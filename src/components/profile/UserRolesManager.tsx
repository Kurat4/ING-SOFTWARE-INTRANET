import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Plus, Trash2, CheckCircle } from 'lucide-react';
import { Label } from '@/components/ui/label';

const AVAILABLE_ROLES: { value: UserRole; label: string }[] = [
  { value: 'student', label: 'Estudiante' },
  { value: 'teacher', label: 'Docente' },
  { value: 'tutor', label: 'Tutor' },
  { value: 'parent', label: 'Padre de Familia' },
  { value: 'admin', label: 'Administrador' }
];

export function UserRolesManager() {
  const { profile, user, activeRole, setActiveRole } = useAuth();
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRole, setSelectedRole] = useState<UserRole | ''>('');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (profile) {
      fetchUserRoles();
    }
  }, [profile]);

  const fetchUserRoles = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);

      if (error) throw error;

      const roles = data?.map(r => r.role as UserRole) || [];
      
      // Include profile role if not in user_roles
      if (profile && !roles.includes(profile.role)) {
        roles.push(profile.role);
      }

      setUserRoles(roles);
    } catch (error) {
      console.error('Error fetching roles:', error);
      toast.error('Error al cargar roles');
    } finally {
      setLoading(false);
    }
  };

  const handleAddRole = async () => {
    if (!selectedRole || !user) return;

    // Check if role already exists
    if (userRoles.includes(selectedRole)) {
      toast.error('Este rol ya está asignado');
      return;
    }

    setAdding(true);
    try {
      const { error } = await supabase
        .from('user_roles')
        .insert({ user_id: user.id, role: selectedRole });

      if (error) throw error;

      toast.success('Rol agregado correctamente');
      setSelectedRole('');
      await fetchUserRoles();
    } catch (error: any) {
      console.error('Error adding role:', error);
      toast.error(error.message || 'Error al agregar rol');
    } finally {
      setAdding(false);
    }
  };

  const handleRemoveRole = async (roleToRemove: UserRole) => {
    if (!user) return;

    // Prevent removing the last role
    if (userRoles.length <= 1) {
      toast.error('No puedes eliminar tu único rol');
      return;
    }

    // Prevent removing primary role from profiles table
    if (profile && roleToRemove === profile.role) {
      toast.error('No puedes eliminar tu rol principal. Actualiza primero tu rol en la tabla de perfiles.');
      return;
    }

    try {
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', user.id)
        .eq('role', roleToRemove);

      if (error) throw error;

      toast.success('Rol eliminado correctamente');
      
      // If deleted role was active, switch to primary role
      if (activeRole === roleToRemove) {
        const remainingRoles = userRoles.filter(r => r !== roleToRemove);
        if (remainingRoles.length > 0) {
          setActiveRole(remainingRoles[0]);
        }
      }
      
      await fetchUserRoles();
    } catch (error: any) {
      console.error('Error removing role:', error);
      toast.error(error.message || 'Error al eliminar rol');
    }
  };

  const getRoleLabel = (role: UserRole) => {
    return AVAILABLE_ROLES.find(r => r.value === role)?.label || role;
  };

  const availableRolesToAdd = AVAILABLE_ROLES.filter(
    r => !userRoles.includes(r.value)
  );

  if (loading) {
    return <div>Cargando roles...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Gestión de Roles</CardTitle>
        <CardDescription>
          Administra los roles asignados a tu cuenta. Puedes tener múltiples roles simultáneamente.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {userRoles.length > 1 && (
          <div className="space-y-2">
            <Label htmlFor="active-role" className="text-sm font-medium">
              Rol Activo
            </Label>
            <Select value={activeRole || ''} onValueChange={(value) => setActiveRole(value as UserRole)}>
              <SelectTrigger id="active-role" className="w-full">
                <SelectValue placeholder="Selecciona el rol activo" />
              </SelectTrigger>
              <SelectContent>
                {userRoles.map(role => (
                  <SelectItem key={role} value={role}>
                    {getRoleLabel(role)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              El rol activo determina qué funcionalidades y menús puedes ver en la aplicación.
            </p>
          </div>
        )}
        <div>
          <h3 className="text-sm font-medium mb-3">Roles Actuales</h3>
          <div className="flex flex-wrap gap-2">
            {userRoles.map(role => (
              <Badge 
                key={role} 
                variant={role === activeRole ? "default" : "secondary"} 
                className="flex items-center gap-2"
              >
                {role === activeRole && <CheckCircle className="w-3 h-3" />}
                {getRoleLabel(role)}
                {profile && role === profile.role && (
                  <span className="text-xs">(Principal)</span>
                )}
                {userRoles.length > 1 && role !== profile?.role && (
                  <button
                    onClick={() => handleRemoveRole(role)}
                    className="ml-1 hover:text-destructive"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </Badge>
            ))}
          </div>
        </div>

        {availableRolesToAdd.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Agregar Nuevo Rol</h3>
            <div className="flex gap-2">
              <Select value={selectedRole} onValueChange={(value) => setSelectedRole(value as UserRole)}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Selecciona un rol" />
                </SelectTrigger>
                <SelectContent>
                  {availableRolesToAdd.map(role => (
                    <SelectItem key={role.value} value={role.value}>
                      {role.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button 
                onClick={handleAddRole} 
                disabled={!selectedRole || adding}
              >
                <Plus className="w-4 h-4 mr-2" />
                Agregar
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
