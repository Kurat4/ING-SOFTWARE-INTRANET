import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/hooks/use-toast';
import { Plus, Edit, Trash2, Video, Search, Filter, Clock, CheckCircle2, XCircle } from 'lucide-react';

interface CursoGrabado {
  id: string;
  name: string;
  description: string | null;
  program_id: string | null;
  video_url: string | null;
  duration_hours: number | null;
  is_active: boolean;
  created_at: string;
  programa?: {
    id: string;
    name: string;
    code: string;
  };
}

interface Programa {
  id: string;
  name: string;
  code: string;
}

export default function AdminCursosGrabadosManagement() {
  const [cursosGrabados, setCursosGrabados] = useState<CursoGrabado[]>([]);
  const [programas, setProgramas] = useState<Programa[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCurso, setEditingCurso] = useState<CursoGrabado | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPrograma, setFilterPrograma] = useState('all');
  const [filterEstado, setFilterEstado] = useState('all');
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    program_id: '',
    duration_hours: 0,
    is_active: true,
  });

  useEffect(() => {
    fetchData();
  }, []);

  // Autocompletar nombre según programa seleccionado
  useEffect(() => {
    if (formData.program_id && !editingCurso) {
      const programa = programas.find(p => p.id === formData.program_id);
      if (programa) {
        // Solo autocompletar si el nombre está vacío o es el valor por defecto
        if (!formData.name || formData.name === '') {
          setFormData(prev => ({
            ...prev,
            name: `${programa.name} - Curso Grabado`
          }));
        }
      }
    }
  }, [formData.program_id, programas, editingCurso]);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Cargar cursos grabados
      const { data: cursosData, error: cursosError } = await supabase
        .from('cursos_grabados' as any)
        .select(`
          *,
          programa:programas(id, name, code)
        `)
        .order('created_at', { ascending: false });

      if (cursosError) throw cursosError;

      // Cargar programas
      const { data: programasData, error: programasError } = await supabase
        .from('programas' as any)
        .select('id, name, code')
        .order('name');

      if (programasError) throw programasError;

      setCursosGrabados(cursosData as any || []);
      setProgramas(programasData as any || []);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: `Error al cargar datos: ${error.message}`,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (curso?: CursoGrabado) => {
    if (curso) {
      setEditingCurso(curso);
      setFormData({
        name: curso.name,
        description: curso.description || '',
        program_id: curso.program_id || '',
        duration_hours: curso.duration_hours || 0,
        is_active: curso.is_active,
      });
    } else {
      setEditingCurso(null);
      setFormData({
        name: '',
        description: '',
        program_id: '',
        duration_hours: 0,
        is_active: true,
      });
    }
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name) {
      toast({
        title: 'Error',
        description: 'El nombre es obligatorio',
        variant: 'destructive',
      });
      return;
    }

    try {
      // Verificar si ya existe un curso grabado para este programa (solo al crear)
      if (!editingCurso && formData.program_id) {
        const { data: existingCursos, error: checkError } = await supabase
          .from('cursos_grabados' as any)
          .select('id, name, programa:programas(name)')
          .eq('program_id', formData.program_id);

        if (checkError) throw checkError;

        if (existingCursos && existingCursos.length > 0) {
          const programaNombre = (existingCursos[0] as any).programa?.name || 'este programa';
          toast({
            title: 'Curso duplicado',
            description: `Ya existe un curso grabado registrado para el programa "${programaNombre}". Solo debe haber un curso grabado por programa.`,
            variant: 'destructive',
          });
          return;
        }
      }

      const dataToSave = {
        ...formData,
        program_id: formData.program_id || null,
      };

      if (editingCurso) {
        const { error } = await supabase
          .from('cursos_grabados' as any)
          .update(dataToSave)
          .eq('id', editingCurso.id);

        if (error) throw error;

        toast({
          title: 'Éxito',
          description: 'Curso grabado actualizado correctamente',
        });
      } else {
        const { error } = await supabase
          .from('cursos_grabados' as any)
          .insert(dataToSave);

        if (error) throw error;

        toast({
          title: 'Éxito',
          description: 'Curso grabado creado correctamente',
        });
      }

      setDialogOpen(false);
      fetchData();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: `Error al guardar curso grabado: ${error.message}`,
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Está seguro de eliminar este curso grabado?')) return;

    try {
      const { error } = await supabase
        .from('cursos_grabados' as any)
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Éxito',
        description: 'Curso grabado eliminado correctamente',
      });

      fetchData();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: `Error al eliminar curso grabado: ${error.message}`,
        variant: 'destructive',
      });
    }
  };

  // Filtrar cursos
  const filteredCursos = cursosGrabados.filter(curso => {
    const matchSearch = curso.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        curso.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchPrograma = filterPrograma === 'all' || curso.program_id === filterPrograma;
    const matchEstado = filterEstado === 'all' || 
                       (filterEstado === 'active' && curso.is_active) ||
                       (filterEstado === 'inactive' && !curso.is_active);
    
    return matchSearch && matchPrograma && matchEstado;
  });

  // Estadísticas
  const stats = {
    total: cursosGrabados.length,
    activos: cursosGrabados.filter(c => c.is_active).length,
    inactivos: cursosGrabados.filter(c => !c.is_active).length,
    totalHoras: cursosGrabados.reduce((sum, c) => sum + (c.duration_hours || 0), 0),
  };

  return (
    <DashboardLayout>
      <div className="container mx-auto py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Video className="h-8 w-8" />
              Cursos Grabados
            </h1>
            <p className="text-gray-500 mt-1">
              Gestión del catálogo de cursos en formato video
            </p>
          </div>
          <Button onClick={() => handleOpenDialog()} size="lg">
            <Plus className="mr-2 h-5 w-5" />
            Nuevo Curso Grabado
          </Button>
        </div>

        {/* Estadísticas */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardDescription className="flex items-center gap-2">
                <Video className="h-4 w-4" />
                Total Cursos
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                Activos
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">{stats.activos}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription className="flex items-center gap-2">
                <XCircle className="h-4 w-4 text-gray-400" />
                Inactivos
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-400">{stats.inactivos}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-blue-600" />
                Total Horas
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600">{stats.totalHoras.toFixed(1)}</div>
            </CardContent>
          </Card>
        </div>

        {/* Tabla de cursos */}
        <Card>
          <CardHeader>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl">Listado de Cursos</CardTitle>
                <Badge variant="outline">{filteredCursos.length} resultado(s)</Badge>
              </div>

              {/* Búsqueda y Filtros */}
              <div className="flex flex-col md:flex-row gap-4">
                {/* Búsqueda */}
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Buscar por nombre o descripción..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>

                {/* Filtros */}
                <div className="flex gap-2">
                  <Select value={filterPrograma} onValueChange={setFilterPrograma}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Programa" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los programas</SelectItem>
                      {programas.map((programa) => (
                        <SelectItem key={programa.id} value={programa.id}>
                          {programa.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={filterEstado} onValueChange={setFilterEstado}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="Estado" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="active">Activos</SelectItem>
                      <SelectItem value="inactive">Inactivos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                <p className="mt-2 text-gray-500">Cargando cursos...</p>
              </div>
            ) : filteredCursos.length === 0 ? (
              <div className="text-center py-12">
                <Video className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No se encontraron cursos grabados</p>
                {(searchTerm || filterPrograma !== 'all' || filterEstado !== 'all') && (
                  <Button
                    variant="link"
                    onClick={() => {
                      setSearchTerm('');
                      setFilterPrograma('all');
                      setFilterEstado('all');
                    }}
                    className="mt-2"
                  >
                    Limpiar filtros
                  </Button>
                )}
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Programa</TableHead>
                      <TableHead className="text-center">Duración</TableHead>
                      <TableHead className="text-center">Estado</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCursos.map((curso) => (
                      <TableRow key={curso.id}>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">{curso.name}</span>
                            {curso.description && (
                              <span className="text-xs text-gray-500 line-clamp-1">
                                {curso.description}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {curso.programa ? (
                            <div className="flex flex-col">
                              <span className="font-medium text-sm">{curso.programa.name}</span>
                              <span className="text-xs text-gray-500">{curso.programa.code}</span>
                            </div>
                          ) : (
                            <span className="text-gray-400">Sin programa</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {curso.duration_hours ? (
                            <div className="flex items-center justify-center gap-1">
                              <Clock className="h-3 w-3 text-gray-400" />
                              <span>{curso.duration_hours} hrs</span>
                            </div>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant={curso.is_active ? 'default' : 'secondary'}>
                            {curso.is_active ? 'Activo' : 'Inactivo'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenDialog(curso)}
                            >
                              <Edit className="h-4 w-4 mr-1" />
                              Editar
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleDelete(curso.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Dialog de formulario */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-xl flex items-center gap-2">
                <Video className="h-5 w-5" />
                {editingCurso ? 'Editar Curso Grabado' : 'Nuevo Curso Grabado'}
              </DialogTitle>
              <DialogDescription>
                Complete los datos del curso grabado
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-6">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Información del Curso</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="program_id">Programa</Label>
                    <Select
                      value={formData.program_id}
                      onValueChange={(value) => setFormData({ ...formData, program_id: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sin programa - Seleccione si aplica" />
                      </SelectTrigger>
                      <SelectContent>
                        {programas.map((programa) => (
                          <SelectItem key={programa.id} value={programa.id}>
                            {programa.name} ({programa.code})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-gray-500">
                      💡 El nombre se autocompletará según el programa seleccionado
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="name">Nombre del Curso *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Ej: English Complete Course"
                      required
                    />
                    {formData.program_id && !editingCurso && (
                      <p className="text-xs text-green-600">
                        ✓ Nombre autocompletado - Puede editarlo si lo desea
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Descripción</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Descripción detallada del contenido del curso..."
                      rows={3}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="duration_hours">Duración (horas)</Label>
                      <Input
                        id="duration_hours"
                        type="number"
                        step="0.5"
                        min="0"
                        value={formData.duration_hours}
                        onChange={(e) =>
                          setFormData({ ...formData, duration_hours: parseFloat(e.target.value) || 0 })
                        }
                        placeholder="Ej: 40"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="is_active">Estado</Label>
                      <div className="flex items-center space-x-2 h-10">
                        <Switch
                          id="is_active"
                          checked={formData.is_active}
                          onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                        />
                        <Label htmlFor="is_active" className="cursor-pointer">
                          {formData.is_active ? 'Activo' : 'Inactivo'}
                        </Label>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <DialogFooter className="gap-2">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit">
                  <Video className="mr-2 h-4 w-4" />
                  {editingCurso ? 'Actualizar Curso' : 'Crear Curso'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
