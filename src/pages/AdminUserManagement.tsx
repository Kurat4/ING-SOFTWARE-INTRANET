import React, { useEffect, useState } from 'react';
import { Card } from '../components/ui/card';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { Table } from '../components/ui/table';
import { Select, SelectTrigger, SelectContent, SelectItem } from '../components/ui/select';
import { Search, ChevronDown } from 'lucide-react';
import { Input } from '../components/ui/input';
import { Skeleton } from '../components/ui/skeleton';
import { Progress } from '../components/ui/progress';
import { useToast } from '../components/ui/use-toast';
import { supabase } from '../integrations/supabase/client';
import { Pencil, Trash2, Eye, User, Mail, Phone, Calendar, MapPin, GraduationCap, FileText } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Badge } from '../components/ui/badge';

import type { UserRole } from '../utils/roleNavigation';
interface Profile {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: UserRole;
  phone?: string | null;
  document_type?: string | null;
  document_number?: string | null;
  student_code?: string | null;
  gender?: string | null;
  birth_date?: string | null;
  country?: string | null;
  education_level?: string | null;
  paternal_surname?: string | null;
  maternal_surname?: string | null;
  created_at?: string;
}

const ROLES = [
  { value: 'admin', label: 'Administrador' },
  { value: 'teacher', label: 'Profesor' },
  { value: 'student', label: 'Estudiante' },
  { value: 'parent', label: 'Padre' },
  { value: 'tutor', label: 'Tutor' },
  { value: 'directivo', label: 'Directivo' },
];


const AdminUserManagement: React.FC = () => {
  const [profiles, setProfiles] = useState<Profile[]>([]);
    const [page, setPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(10);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkRole, setBulkRole] = useState<UserRole | "">("");
  const [bulkLoading, setBulkLoading] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchProfiles();
  }, []);

  // Obtener perfiles desde Supabase (tabla 'profiles')
  const fetchProfiles = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('profiles').select('*');
      if (error) throw error;
      setProfiles((data || []) as Profile[]);
    } catch (e) {
      toast({
        title: 'Error',
        description: 'Error al cargar usuarios',
        variant: 'destructive',
      });
    }
    setLoading(false);
  };

  const handleViewDetails = async (profile: Profile) => {
    setSelectedProfile(profile);
    setDetailsModalOpen(true);
  };

  // Actualizar rol de usuario en Supabase
  const handleRoleChange = async (id: string, newRole: UserRole) => {
    setSaving(id);
    try {
      const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', id);
      if (error) throw error;
      setProfiles((prev) =>
        prev.map((p) => (p.id === id ? { ...p, role: newRole as UserRole } : p))
      );
      toast({
        title: 'Éxito',
        description: 'Rol actualizado',
        variant: 'default',
      });
    } catch (e) {
      toast({
        title: 'Error',
        description: 'No se pudo actualizar el rol',
        variant: 'destructive',
      });
    }
    setSaving(null);
  };

  const [roleFilter, setRoleFilter] = useState<UserRole | "">("");
  const filteredProfiles = profiles.filter(
    (p) =>
      (!roleFilter || p.role === roleFilter) &&
      (`${p.first_name} ${p.last_name}`.toLowerCase().includes(search.toLowerCase()) ||
      p.email.toLowerCase().includes(search.toLowerCase()))
  );

  // Paginación
  const totalPages = Math.ceil(filteredProfiles.length / rowsPerPage);
  const paginatedProfiles = filteredProfiles.slice((page - 1) * rowsPerPage, page * rowsPerPage);

  // Números resumen
  const totalUsuarios = profiles.length;
  const totalEstudiantes = profiles.filter(u => u.role === 'student').length;
  const totalProfesores = profiles.filter(u => u.role === 'teacher').length;

  return (
    <DashboardLayout>
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="hover:shadow-lg transition-shadow">
            <div className="p-4">
              <div className="text-sm font-medium text-gray-600 flex items-center justify-between">
                Total Usuarios
                <span className="text-blue-600"><Pencil className="inline h-4 w-4" /></span>
              </div>
              <div className="text-2xl font-bold">{totalUsuarios}</div>
              <p className="text-xs text-gray-500 mt-1">Usuarios registrados en el sistema</p>
            </div>
          </Card>
          <Card className="hover:shadow-lg transition-shadow">
            <div className="p-4">
              <div className="text-sm font-medium text-gray-600 flex items-center justify-between">
                Estudiantes
                <span className="text-green-600"><Pencil className="inline h-4 w-4" /></span>
              </div>
              <div className="text-2xl font-bold">{totalEstudiantes}</div>
              <p className="text-xs text-gray-500 mt-1">Estudiantes activos</p>
            </div>
          </Card>
          <Card className="hover:shadow-lg transition-shadow">
            <div className="p-4">
              <div className="text-sm font-medium text-gray-600 flex items-center justify-between">
                Profesores
                <span className="text-purple-600"><Pencil className="inline h-4 w-4" /></span>
              </div>
              <div className="text-2xl font-bold">{totalProfesores}</div>
              <p className="text-xs text-gray-500 mt-1">Profesores registrados</p>
            </div>
          </Card>
        </div>
        <Card title="Gestión de Usuarios">
          {/* Barra de acciones masivas */}
          {selectedIds.length > 0 && (
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg animate-fade-in">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-blue-700">Acción masiva:</span>
                <Select value={bulkRole} onValueChange={val => setBulkRole(val as UserRole | "") }>
                  <SelectTrigger className="w-40 bg-white border border-blue-200">
                    <span>{bulkRole ? (ROLES.find(r => r.value === bulkRole)?.label) : 'Seleccionar nuevo rol'}</span>
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((role) => (
                      <SelectItem key={role.value} value={role.value}>
                        {role.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  className="bg-blue-600 text-white hover:bg-blue-700"
                  size="sm"
                  onClick={async () => {
                    if (!bulkRole) return;
                    setBulkLoading(true);
                    try {
                      const { error } = await supabase.from('profiles')
                        .update({ role: bulkRole })
                        .in('id', selectedIds);
                      if (error) throw error;
                      setProfiles(prev => prev.map(p => selectedIds.includes(p.id) ? { ...p, role: bulkRole as UserRole } : p));
                      setSelectedIds([]);
                      setBulkRole("");
                      toast({
                        title: 'Éxito',
                        description: 'Roles actualizados correctamente',
                        variant: 'default',
                      });
                    } catch (e) {
                      toast({
                        title: 'Error',
                        description: 'No se pudieron actualizar los roles',
                        variant: 'destructive',
                      });
                    }
                    setBulkLoading(false);
                  }}
                  disabled={!bulkRole || bulkLoading}
                >
                  Cambiar rol a seleccionados
                </Button>
              </div>
              <span className="text-xs text-gray-500">{selectedIds.length} usuario(s) seleccionado(s)</span>
            </div>
          )}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
            {/* Buscador y filtro rápido de rol */}
            <div className="flex flex-col md:flex-row gap-2 w-full">
              <div className="relative flex-1 max-w-xl">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                  <Search className="h-4 w-4" />
                </span>
                <Input
                  placeholder="Buscar por nombre o correo..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-200 border border-gray-200 w-full"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant={roleFilter === 'student' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setRoleFilter(roleFilter === 'student' ? '' : 'student')}
                  className="whitespace-nowrap"
                >
                  Solo Estudiantes
                </Button>
                <Select value={roleFilter} onValueChange={val => setRoleFilter(val as UserRole | "") }>
                  <SelectTrigger className="w-40 bg-white border border-gray-200">
                    <span>{roleFilter ? (ROLES.find(r => r.value === roleFilter)?.label) : 'Todos los roles'}</span>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={undefined}>Todos los roles</SelectItem>
                    {ROLES.map((role) => (
                      <SelectItem key={role.value} value={role.value}>
                        {role.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {/* Selector de cantidad de usuarios */}
            <div className="flex items-center gap-2 md:ml-24 mt-1 pl-2">
              <span className="text-sm text-gray-600">Mostrar</span>
              <Select value={String(rowsPerPage)} onValueChange={val => { setRowsPerPage(Number(val)); setPage(1); }}>
                <SelectTrigger className="w-20 rounded-lg border border-gray-200 shadow-sm focus:ring-2 focus:ring-blue-200 flex justify-between items-center">
                  <span>{rowsPerPage}</span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-sm text-gray-600 md:pr-16">usuarios</span>
            </div>
          </div>
          {loading ? (
            <div className="w-full flex justify-center py-8">
              <Progress className="w-1/2" value={100} />
            </div>
          ) : (
            <>
              <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
                <Table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">
                        <input
                          type="checkbox"
                          checked={selectedIds.length === paginatedProfiles.length && paginatedProfiles.length > 0}
                          onChange={e => {
                            if (e.target.checked) {
                              setSelectedIds(paginatedProfiles.map(p => p.id));
                            } else {
                              setSelectedIds([]);
                            }
                          }}
                        />
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Nombre</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Correo</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Rol</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {paginatedProfiles.map((profile) => (
                      <tr key={profile.id} className="hover:bg-gray-50 transition">
                        <td className="px-4 py-2 align-middle">
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(profile.id)}
                            onChange={e => {
                              if (e.target.checked) {
                                setSelectedIds(ids => [...ids, profile.id]);
                              } else {
                                setSelectedIds(ids => ids.filter(id => id !== profile.id));
                              }
                            }}
                          />
                        </td>
                        <td className="px-4 py-2 align-middle whitespace-nowrap">{profile.first_name} {profile.last_name}</td>
                        <td className="px-4 py-2 align-middle whitespace-nowrap">{profile.email}</td>
                        <td className="px-4 py-2 align-middle">
                          {editingId === profile.id ? (
                            <Select
                              value={profile.role}
                              onValueChange={async (val) => {
                                await handleRoleChange(profile.id, val as UserRole);
                                setEditingId(null);
                              }}
                              disabled={saving === profile.id}
                            >
                              <SelectTrigger />
                              <SelectContent>
                                {ROLES.map((role) => (
                                  <SelectItem key={role.value} value={role.value}>
                                    {role.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            ROLES.find(r => r.value === profile.role)?.label || profile.role
                          )}
                        </td>
                        <td className="px-4 py-2 align-middle text-center">
                          <div className="flex gap-2 items-center justify-center">
                            {saving === profile.id && <Skeleton className="h-4 w-4 rounded-full" />}
                            {(profile.role === 'student' || profile.role === 'teacher') && (
                              <Button
                                size="icon"
                                variant="outline"
                                className="border-green-200 hover:bg-green-100"
                                onClick={() => handleViewDetails(profile)}
                                disabled={saving === profile.id}
                                title="Ver detalles"
                              >
                                <Eye className="h-5 w-5 text-green-600" />
                              </Button>
                            )}
                            <Button
                              size="icon"
                              variant="outline"
                              className="border-blue-200 hover:bg-blue-100"
                              onClick={() => setEditingId(profile.id)}
                              disabled={saving === profile.id}
                              title="Editar"
                            >
                              <Pencil className="h-5 w-5 text-blue-600" />
                            </Button>
                            <Button
                              size="icon"
                              variant="outline"
                              className="border-red-200 hover:bg-red-100"
                              onClick={async () => {
                                setSaving(profile.id);
                                try {
                                  const { error } = await supabase.from('profiles').delete().eq('id', profile.id);
                                  if (error) throw error;
                                  setProfiles(prev => prev.filter(p => p.id !== profile.id));
                                  toast({
                                    title: 'Usuario eliminado',
                                    description: 'El usuario ha sido eliminado correctamente',
                                    variant: 'default',
                                  });
                                } catch (e) {
                                  toast({
                                    title: 'Error',
                                    description: 'No se pudo eliminar el usuario',
                                    variant: 'destructive',
                                  });
                                }
                                setSaving(null);
                              }}
                              disabled={saving === profile.id}
                              title="Eliminar"
                            >
                              <Trash2 className="h-5 w-5 text-red-600" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
              {/* Paginación */}
              <div className="flex flex-col items-center justify-center mt-4">
                <div className="text-sm text-gray-600 mb-2">
                  {paginatedProfiles.length} de {filteredProfiles.length}
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="px-2 py-1"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    Anterior
                  </Button>
                  <span className="text-sm">Página {page} de {totalPages}</span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="px-2 py-1"
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                  >
                    Siguiente
                  </Button>
                </div>
              </div>
            </>
          )}
        </Card>

        {/* Modal de Detalles */}
        <Dialog open={detailsModalOpen} onOpenChange={setDetailsModalOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Detalles del Usuario
              </DialogTitle>
            </DialogHeader>
            {selectedProfile && (
              <div className="space-y-6">
                {/* Información Básica */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Información Básica</h3>
                    <Badge variant={selectedProfile.role === 'student' ? 'default' : 'secondary'}>
                      {ROLES.find(r => r.value === selectedProfile.role)?.label || selectedProfile.role}
                    </Badge>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                      <User className="h-5 w-5 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="text-xs text-muted-foreground">Nombre Completo</p>
                        <p className="font-medium">{selectedProfile.first_name} {selectedProfile.last_name}</p>
                      </div>
                    </div>
                    
                    {selectedProfile.paternal_surname && (
                      <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                        <User className="h-5 w-5 text-muted-foreground mt-0.5" />
                        <div>
                          <p className="text-xs text-muted-foreground">Apellidos</p>
                          <p className="font-medium">{selectedProfile.paternal_surname} {selectedProfile.maternal_surname}</p>
                        </div>
                      </div>
                    )}
                    
                    <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                      <Mail className="h-5 w-5 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="text-xs text-muted-foreground">Correo Electrónico</p>
                        <p className="font-medium text-sm break-all">{selectedProfile.email}</p>
                      </div>
                    </div>
                    
                    {selectedProfile.phone && (
                      <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                        <Phone className="h-5 w-5 text-muted-foreground mt-0.5" />
                        <div>
                          <p className="text-xs text-muted-foreground">Teléfono</p>
                          <p className="font-medium">{selectedProfile.phone}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Información de Documento (Solo Estudiantes) */}
                {selectedProfile.role === 'student' && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Información Académica</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {selectedProfile.student_code && (
                        <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                          <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
                          <div>
                            <p className="text-xs text-muted-foreground">Código de Estudiante</p>
                            <p className="font-medium">{selectedProfile.student_code}</p>
                          </div>
                        </div>
                      )}
                      
                      {selectedProfile.document_number && (
                        <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                          <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
                          <div>
                            <p className="text-xs text-muted-foreground">{selectedProfile.document_type || 'Documento'}</p>
                            <p className="font-medium">{selectedProfile.document_number}</p>
                          </div>
                        </div>
                      )}
                      
                      {selectedProfile.education_level && (
                        <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                          <GraduationCap className="h-5 w-5 text-muted-foreground mt-0.5" />
                          <div>
                            <p className="text-xs text-muted-foreground">Nivel Educativo</p>
                            <p className="font-medium">{selectedProfile.education_level}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Información Personal */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Información Personal</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {selectedProfile.birth_date && (
                      <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                        <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                        <div>
                          <p className="text-xs text-muted-foreground">Fecha de Nacimiento</p>
                          <p className="font-medium">{new Date(selectedProfile.birth_date).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                        </div>
                      </div>
                    )}
                    
                    {selectedProfile.gender && (
                      <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                        <User className="h-5 w-5 text-muted-foreground mt-0.5" />
                        <div>
                          <p className="text-xs text-muted-foreground">Género</p>
                          <p className="font-medium">{selectedProfile.gender === 'M' ? 'Masculino' : selectedProfile.gender === 'F' ? 'Femenino' : selectedProfile.gender}</p>
                        </div>
                      </div>
                    )}
                    
                    {selectedProfile.country && (
                      <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                        <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                        <div>
                          <p className="text-xs text-muted-foreground">País</p>
                          <p className="font-medium">{selectedProfile.country}</p>
                        </div>
                      </div>
                    )}
                    
                    {selectedProfile.created_at && (
                      <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                        <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                        <div>
                          <p className="text-xs text-muted-foreground">Registrado</p>
                          <p className="font-medium">{new Date(selectedProfile.created_at).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex justify-end pt-4">
                  <Button onClick={() => setDetailsModalOpen(false)}>
                    Cerrar
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default AdminUserManagement;
