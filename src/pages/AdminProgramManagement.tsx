import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Package, Edit, Trash2, Loader2, Save } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from "@/hooks/use-toast";

// Interfaz para TypeScript
interface Program {
  id: string;
  name: string;
  code: string;
  description?: string;
  image_url?: string;
}

export function AdminProgramManagement() {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Estados para los Modales
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  // Estado para saber qué estamos editando/borrando
  const [selectedProgram, setSelectedProgram] = useState<Program | null>(null);

  // Formulario
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    image_url: ''
  });

  useEffect(() => {
    fetchPrograms();
  }, []);

  const fetchPrograms = async () => {
    try {
      const { data, error } = await supabase
        .from('programas')
        .select('*')
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      setPrograms(data || []);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  // --- CREAR ---
  const handleCreate = async () => {
    if (!formData.name || !formData.code) {
      toast({ title: "Error", description: "Nombre y Código son obligatorios", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from('programas').insert([{ ...formData }]);
      if (error) throw error;
      toast({ title: "Éxito", description: "Programa creado correctamente" });
      setIsCreateOpen(false);
      resetForm();
      fetchPrograms(); 
    } catch (error) {
      toast({ title: "Error", description: "No se pudo crear", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // --- EDITAR ---
  const openEditModal = (prog: Program) => {
    setSelectedProgram(prog);
    setFormData({
      name: prog.name,
      code: prog.code,
      description: prog.description || '',
      image_url: prog.image_url || ''
    });
    setIsEditOpen(true);
  };

  const handleUpdate = async () => {
    if (!selectedProgram) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('programas')
        .update({ ...formData })
        .eq('id', selectedProgram.id);

      if (error) throw error;
      toast({ title: "Actualizado", description: "Cambios guardados." });
      setIsEditOpen(false);
      fetchPrograms();
    } catch (error) {
      toast({ title: "Error", description: "No se pudo actualizar", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // --- ELIMINAR ---
  const handleDelete = async () => {
    if (!selectedProgram) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('programas').delete().eq('id', selectedProgram.id);
      if (error) throw error;
      toast({ title: "Eliminado", description: "Programa borrado correctamente." });
      setIsDeleteOpen(false);
      fetchPrograms();
    } catch (error) {
      toast({ title: "Error", description: "No se puede borrar (¿Tiene cursos activos?)", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => setFormData({ name: '', code: '', description: '', image_url: '' });

  if (loading) return <div className="p-4"><Loader2 className="animate-spin h-6 w-6" /></div>;

  return (
    <div className="space-y-6">
      {/* Cabecera */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Package className="h-5 w-5" /> Catálogo de Programas
          </h2>
          <p className="text-sm text-gray-500">Gestión de moldes / productos base.</p>
        </div>
        
        <Button onClick={() => { resetForm(); setIsCreateOpen(true); }} className="bg-purple-600 hover:bg-purple-700">
           <Plus className="mr-2 h-4 w-4" /> Nuevo Programa
        </Button>
      </div>

      {/* Lista de Tarjetas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {programs.map((prog) => (
          <Card key={prog.id} className="overflow-hidden border-l-4 border-l-purple-500 flex flex-col justify-between">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex justify-between items-start">
                <span>{prog.name}</span>
                <span className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-600 font-mono ml-2 shrink-0">{prog.code}</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-500 line-clamp-2">{prog.description || "Sin descripción"}</p>
            </CardContent>
            
            {/* --- AQUÍ ESTÁN LOS BOTONES QUE FALTABAN --- */}
            <CardFooter className="pt-0 flex justify-end gap-2 border-t bg-gray-50/50 p-3">
               <Button variant="ghost" size="sm" onClick={() => openEditModal(prog)}>
                  <Edit className="h-4 w-4 text-gray-600" />
               </Button>
               <Button variant="ghost" size="sm" onClick={() => { setSelectedProgram(prog); setIsDeleteOpen(true); }}>
                  <Trash2 className="h-4 w-4 text-red-500" />
               </Button>
            </CardFooter>
          </Card>
        ))}
        {programs.length === 0 && <div className="col-span-3 text-center text-gray-400 py-8">No hay programas creados aún.</div>}
      </div>

      {/* --- MODAL CREAR --- */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
         <DialogContent>
            <DialogHeader><DialogTitle>Crear Nuevo Programa</DialogTitle></DialogHeader>
            <ProgramForm formData={formData} setFormData={setFormData} />
            <DialogFooter>
               <Button onClick={handleCreate} disabled={saving} className="bg-purple-600">Guardar</Button>
            </DialogFooter>
         </DialogContent>
      </Dialog>

      {/* --- MODAL EDITAR --- */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
         <DialogContent>
            <DialogHeader><DialogTitle>Editar Programa</DialogTitle></DialogHeader>
            <ProgramForm formData={formData} setFormData={setFormData} />
            <DialogFooter>
               <Button onClick={handleUpdate} disabled={saving}>Guardar Cambios</Button>
            </DialogFooter>
         </DialogContent>
      </Dialog>

      {/* --- MODAL ELIMINAR --- */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
         <DialogContent>
            <DialogHeader><DialogTitle>¿Estás seguro?</DialogTitle></DialogHeader>
            <p className="text-sm text-gray-600">
               Estás a punto de borrar el programa <strong>{selectedProgram?.name}</strong>.
               <br/>
               Solo se puede borrar si no tiene cursos/ediciones vinculadas.
            </p>
            <DialogFooter>
               <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>Cancelar</Button>
               <Button variant="destructive" onClick={handleDelete} disabled={saving}>Eliminar</Button>
            </DialogFooter>
         </DialogContent>
      </Dialog>
    </div>
  );
}

// Subcomponente para no repetir código del formulario
function ProgramForm({ formData, setFormData }: any) {
   return (
      <div className="space-y-4 py-2">
         <div className="space-y-2">
            <Label>Nombre del Programa</Label>
            <Input placeholder="Ej: Taller de Alta Costura" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} />
         </div>
         <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
               <Label>Código Base</Label>
               <Input placeholder="Ej: P001" value={formData.code} onChange={(e) => setFormData({...formData, code: e.target.value})} />
            </div>
    
         </div>
         <div className="space-y-2">
            <Label>Descripción</Label>
            <Input value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} />
         </div>
      </div>
   );
}
