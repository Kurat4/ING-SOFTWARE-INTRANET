import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Bell, Send, Trash2, Pin } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

interface Announcement {
  id: string;
  content: string;
  created_at: string;
  is_pinned: boolean;
}

export const CourseAnnouncements = ({ courseId, canEdit }: { courseId: string, canEdit: boolean }) => {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [newNotice, setNewNotice] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnnouncements();
  }, [courseId]);

  const fetchAnnouncements = async () => {
    const { data } = await supabase
      .from('course_announcements')
      .select('*')
      .eq('modulo_id', courseId)
      .order('created_at', { ascending: false }); // Los más nuevos primero
    setAnnouncements(data as any || []);
    setLoading(false);
  };

  const handlePost = async () => {
    if (!newNotice.trim()) return;
    
    const { error } = await supabase.from('course_announcements').insert({
      modulo_id: courseId,
      content: newNotice
    });

    if (error) toast.error('Error al publicar');
    else {
      toast.success('Aviso publicado');
      setNewNotice('');
      fetchAnnouncements();
    }
  };

  const handleDelete = async (id: string) => {
    if(!confirm('¿Borrar aviso?')) return;
    await supabase.from('course_announcements').delete().eq('id', id);
    fetchAnnouncements();
  };

  if (loading) return null;
  if (announcements.length === 0 && !canEdit) return null; // Si no hay avisos y soy alumno, no muestres nada vacio

  return (
    <Card className="mb-8 border-l-4 border-l-yellow-500 bg-yellow-50/30">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2 text-yellow-800">
          <Bell className="h-5 w-5" /> Tablón de Avisos
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Input para el profesor */}
        {canEdit && (
          <div className="flex gap-2 mb-6">
            <Textarea 
              placeholder="Escribe un aviso para la clase... (Ej: 'Entregar sus portafolaios ... ')" 
              value={newNotice}
              onChange={(e) => setNewNotice(e.target.value)}
              className="bg-white"
              rows={2}
            />
            <Button onClick={handlePost} className="h-auto bg-yellow-600 hover:bg-yellow-700">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Lista de Avisos */}
        <div className="space-y-3">
          {announcements.map((aviso) => (
            <div key={aviso.id} className="bg-white p-4 rounded-lg border shadow-sm relative group">
              <p className="text-gray-800 whitespace-pre-wrap">{aviso.content}</p>
              <div className="flex justify-between items-center mt-2">
                <span className="text-xs text-gray-400">
                  {formatDistanceToNow(new Date(aviso.created_at), { addSuffix: true, locale: es })}
                </span>
                
                {canEdit && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => handleDelete(aviso.id)}
                    className="h-6 w-6 p-0 text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
          ))}
          
          {announcements.length === 0 && canEdit && (
            <p className="text-sm text-gray-400 text-center italic">No hay avisos publicados aún.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};