import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Programa, ProgramaInsert, ProgramaUpdate } from '@/integrations/supabase/peri-types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
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
import { toast } from '@/hooks/use-toast';
import { Plus, Edit, Trash2, BookOpen } from 'lucide-react';

export default function ProgramasManagement() {
  const [programas, setProgramas] = useState<Programa[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPrograma, setEditingPrograma] = useState<Programa | null>(null);
  const [formData, setFormData] = useState<Partial<ProgramaInsert>>({
    name: '',
    code: '',
    description: '',
    is_active: true,
  });

  useEffect(() => {
    fetchProgramas();
  }, []);

  const fetchProgramas = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('programas' as any)
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProgramas(data || []);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: `Error al cargar programas: ${error.message}`,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (programa?: Programa) => {
    if (programa) {
      setEditingPrograma(programa);
      setFormData({
        name: programa.name,
        code: programa.code,
        description: programa.description,
        is_active: programa.is_active,
      });
    } else {
      setEditingPrograma(null);
      setFormData({
        name: '',
        code: '',
        description: '',
        is_active: true,
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingPrograma(null);
    setFormData({
      name: '',
      code: '',
      description: '',
      is_active: true,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.code) {
      toast({
        title: 'Error',
        description: 'El nombre y código son obligatorios',
        variant: 'destructive',
      });
      return;
    }

    try {
      if (editingPrograma) {
        // Actualizar
        const { error } = await supabase
          .from('programas' as any)
          .update(formData as ProgramaUpdate)
          .eq('id', editingPrograma.id);

        if (error) throw error;

        toast({
          title: 'Éxito',
          description: 'Programa actualizado correctamente',
        });
      } else {
        // Crear
        const { error } = await supabase
          .from('programas' as any)
          .insert(formData as ProgramaInsert);

        if (error) throw error;

        toast({
          title: 'Éxito',
          description: 'Programa creado correctamente',
        });
      }

      handleCloseDialog();
      fetchProgramas();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: `Error al guardar programa: ${error.message}`,
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Está seguro de eliminar este programa?')) return;

    try {
      const { error } = await supabase
        .from('programas' as any)
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Éxito',
        description: 'Programa eliminado correctamente',
      });

      fetchProgramas();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: `Error al eliminar programa: ${error.message}`,
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl flex items-center gap-2">
                <BookOpen className="h-6 w-6" />
                Gestión de Programas
              </CardTitle>
              <CardDescription>
                Catálogo de programas educativos disponibles
              </CardDescription>
            </div>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="mr-2 h-4 w-4" />
              Nuevo Programa
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Cargando...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {programas.map((programa) => (
                  <TableRow key={programa.id}>
                    <TableCell className="font-medium">{programa.code}</TableCell>
                    <TableCell>{programa.name}</TableCell>
                    <TableCell className="max-w-md truncate">
                      {programa.description || '-'}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`px-2 py-1 rounded-full text-xs ${
                          programa.is_active
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {programa.is_active ? 'Activo' : 'Inactivo'}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenDialog(programa)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDelete(programa.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialog para crear/editar */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingPrograma ? 'Editar Programa' : 'Nuevo Programa'}
            </DialogTitle>
            <DialogDescription>
              Complete los datos del programa educativo
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="code">Código *</Label>
                  <Input
                    id="code"
                    value={formData.code}
                    onChange={(e) =>
                      setFormData({ ...formData, code: e.target.value.toUpperCase() })
                    }
                    placeholder="Ej: PROG001"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name">Nombre *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    placeholder="Ej: Programación Básica"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descripción</Label>
                <Textarea
                  id="description"
                  value={formData.description || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="Descripción del programa"
                  rows={3}
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, is_active: checked })
                  }
                />
                <Label htmlFor="is_active">Programa activo</Label>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCloseDialog}>
                Cancelar
              </Button>
              <Button type="submit">
                {editingPrograma ? 'Actualizar' : 'Crear'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
