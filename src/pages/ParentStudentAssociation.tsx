import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { ParentLayout } from '@/components/layout/ParentLayout';
import { Link } from 'react-router-dom';
import { User, ArrowRight, CheckCircle2 } from 'lucide-react';

/**
 * Panel para que un padre/apoderado asocie su cuenta a un estudiante usando código único y dato de validación.
 */
const ParentStudentAssociation: React.FC = () => {
  const { toast } = useToast();
  const [studentCode, setStudentCode] = useState('');
  const [dni, setDni] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [associatedStudents, setAssociatedStudents] = useState<any[]>([]);

  useEffect(() => {
    fetchAssociatedStudents();
  }, []);

  const fetchAssociatedStudents = async () => {
    try {
      // Usar la función RPC dedicada para obtener los estudiantes
      // Esto evita problemas de RLS y joins complejos
      // @ts-ignore
      const { data, error } = await supabase.rpc('get_my_students');

      if (error) {
        console.error('Error fetching students via RPC:', error);
        // Fallback: intentar consulta directa si RPC falla (aunque RPC es preferible)
        return;
      }

      if (data) {
        console.log('Students fetched via RPC:', data);
        // Asegurar que data es un array y tiene la forma correcta
        const rawData = data as any;
        const students = Array.isArray(rawData) ? rawData : [rawData];
        setAssociatedStudents(students.filter((s: any) => s && s.id));
      }
    } catch (err) {
      console.error('Unexpected error in fetchAssociatedStudents:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuccess(false);

    try {
      console.log('Valores de búsqueda:', { studentCode, dni });
      
      // Buscar estudiante por código y DNI usando RPC seguro para evitar bloqueos de RLS
      // @ts-ignore - La función RPC existe en la BD pero los tipos no se han regenerado
      const { data, error } = await supabase
        .rpc('get_student_by_credentials' as any, {
          p_student_code: studentCode.trim(),
          p_dni: dni.trim()
        })
        .maybeSingle();

      const student = data as { id: string; first_name: string; last_name: string } | null;

      console.log('Resultado de búsqueda:', { student, error });

      if (error) {
        console.error('Error en la búsqueda:', error);
        toast({
          title: 'Error en la búsqueda',
          description: error.message,
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }

      if (!student) {
        toast({
          title: 'No encontrado',
          description: 'No se encontró un estudiante con ese código y DNI. Verifica los datos.',
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }

      // Obtener el usuario actual
      const { data: userData, error: userError } = await supabase.auth.getUser();
      const user = userData?.user;
      
      if (userError || !user) {
        toast({ 
          title: 'Error de autenticación', 
          description: 'No has iniciado sesión correctamente.', 
          variant: 'destructive' 
        });
        setLoading(false);
        return;
      }

      // Obtener el profile del padre usando el user_id
      const { data: parentProfile, error: parentError } = await supabase
        .from('profiles')
        .select('id, role')
        .eq('user_id', user.id)
        .eq('role', 'parent')
        .single();

      console.log('Perfil del padre:', { parentProfile, parentError });

      if (parentError || !parentProfile) {
        toast({ 
          title: 'Error', 
          description: 'Tu cuenta no tiene rol de padre. Contacta al administrador.', 
          variant: 'destructive' 
        });
        setLoading(false);
        return;
      }

      // Verificar si ya existe la relación
      const { data: existing, error: existingError } = await supabase
        .from('parent_student_relationships')
        .select('id')
        .eq('parent_id', parentProfile.id)
        .eq('student_id', student.id)
        .maybeSingle();

      if (existing) {
        toast({
          title: 'Ya asociado',
          description: 'Este estudiante ya está asociado a tu cuenta.',
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }

      // Asociar padre con estudiante en parent_student_relationships
      const { error: assocError } = await supabase
        .from('parent_student_relationships')
        .insert({ 
          parent_id: parentProfile.id, 
          student_id: student.id,
          relationship_type: 'guardian',
          is_primary: true,
          is_active: true
        });

      if (assocError) {
        console.error('Error de asociación:', assocError);
        toast({
          title: 'Error al asociar',
          description: assocError.message || 'No se pudo crear la asociación.',
          variant: 'destructive',
        });
      } else {
        setSuccess(true);
        setStudentCode('');
        setDni('');
        toast({ 
          title: '¡Asociación exitosa!', 
          description: `${student.first_name} ${student.last_name} ahora está vinculado a tu cuenta.` 
        });
        fetchAssociatedStudents(); // Refresh list
      }
    } catch (error) {
      console.error('Error general:', error);
      toast({
        title: 'Error inesperado',
        description: 'Ocurrió un error. Intenta de nuevo.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <ParentLayout>
      <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Asociar con mi hijo/a</h1>
              <p className="text-muted-foreground">
                Vincula tu cuenta con la de tu hijo/a usando su código de estudiante
              </p>
            </div>
            <div className="max-w-2xl">
            <Card>
              <CardHeader>
                <CardTitle>Nueva Asociación</CardTitle>
                <CardDescription>Ingresa los datos del estudiante para vincularlo</CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="studentCode">Código de estudiante</Label>
              <Input
                id="studentCode"
                value={studentCode}
                onChange={e => setStudentCode(e.target.value)}
                required
                placeholder="Ej: 2023-00123"
              />
            </div>
            <div>
              <Label htmlFor="dni">DNI del estudiante</Label>
              <Input
                id="dni"
                value={dni}
                onChange={e => setDni(e.target.value)}
                required
                placeholder="Número de documento"
              />
            </div>
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? 'Asociando...' : 'Asociar'}
            </Button>
            {success && (
              <div className="flex items-center gap-2 text-green-600 font-semibold mt-2 bg-green-50 p-3 rounded-md">
                <CheckCircle2 className="h-5 w-5" />
                <span>¡Asociación exitosa!</span>
              </div>
            )}
          </form>
              </CardContent>
            </Card>

            {associatedStudents.length > 0 && (
              <div className="mt-8">
                <h2 className="text-xl font-semibold mb-4">Estudiantes asociados</h2>
                <div className="grid gap-4 md:grid-cols-2">
                  {associatedStudents.map((student) => (
                    <Card key={student.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="bg-primary/10 p-3 rounded-full">
                            <User className="h-6 w-6 text-primary" />
                          </div>
                          <div>
                            <p className="font-bold text-lg">{student.first_name} {student.last_name}</p>
                            <p className="text-sm text-muted-foreground">
                              Código: {student.student_code}
                              {student.grade && ` • ${student.grade}° ${student.section}`}
                            </p>
                          </div>
                        </div>
                        <Button variant="outline" size="sm" asChild>
                          <Link to={`/parent/student/${student.id}`} className="flex items-center gap-2">
                            Ver perfil <ArrowRight className="h-4 w-4" />
                          </Link>
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
            </div>
      </div>
    </ParentLayout>
  );
};

export default ParentStudentAssociation;
