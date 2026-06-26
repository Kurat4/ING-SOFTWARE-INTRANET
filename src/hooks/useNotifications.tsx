import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from './useAuth';

export interface Notification {
  id: string;
  user_id: string;
  assignment_id: string | null;
  exam_id: string | null;
  material_id: string | null;
  pago_id: string | null;
  matricula_id: string | null;
  modulo_id: string | null;
  type: string;
  message: string;
  is_read: boolean;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at?: string;
  assignments?: {
    id: string;
    title: string;
    due_date: string;
  };
  exams?: {
    id: string;
    title: string;
    start_time: string;
  };
}

export function useNotifications() {
  const { profile } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  // Cargar notificaciones
  const fetchNotifications = useCallback(async () => {
    if (!profile?.id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('notifications')
        .select(`
          *,
          assignments (
            id,
            title,
            due_date
          ),
          exams (
            id,
            title,
            start_time
          )
        `)
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(50); // Limitar a las últimas 50 notificaciones

      if (error) throw error;

      // Normalizar datos
      const normalizedData = (data || []).map((notif: any) => ({
        ...notif,
        assignments: Array.isArray(notif.assignments)
          ? notif.assignments[0]
          : notif.assignments,
        exams: Array.isArray(notif.exams) ? notif.exams[0] : notif.exams
      }));

      setNotifications(normalizedData);
      setUnreadCount(normalizedData.filter((n) => !n.is_read).length);
    } catch (error: any) {
      console.error('Error fetching notifications:', error);
      toast.error('Error al cargar notificaciones');
    } finally {
      setLoading(false);
    }
  }, [profile?.id]);

  // Marcar una notificación como leída
  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true, updated_at: new Date().toISOString() })
        .eq('id', notificationId);

      if (error) throw error;

      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, is_read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));

      return true;
    } catch (error: any) {
      console.error('Error marking notification as read:', error);
      toast.error('Error al actualizar notificación');
      return false;
    }
  }, []);

  // Marcar todas las notificaciones como leídas
  const markAllAsRead = useCallback(async () => {
    if (!profile?.id) return false;

    try {
      const unreadIds = notifications.filter((n) => !n.is_read).map((n) => n.id);

      if (unreadIds.length === 0) {
        toast.info('No hay notificaciones sin leer');
        return true;
      }

      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true, updated_at: new Date().toISOString() })
        .in('id', unreadIds);

      if (error) throw error;

      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);

      toast.success(`${unreadIds.length} notificaciones marcadas como leídas`);
      return true;
    } catch (error: any) {
      console.error('Error marking all as read:', error);
      toast.error('Error al actualizar notificaciones');
      return false;
    }
  }, [profile?.id, notifications]);

  // Eliminar una notificación (solo admin/directivo)
  const deleteNotification = useCallback(
    async (notificationId: string) => {
      try {
        const { error } = await supabase
          .from('notifications')
          .delete()
          .eq('id', notificationId);

        if (error) throw error;

        setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
        setUnreadCount((prev) => {
          const notification = notifications.find((n) => n.id === notificationId);
          return notification && !notification.is_read ? prev - 1 : prev;
        });

        toast.success('Notificación eliminada');
        return true;
      } catch (error: any) {
        console.error('Error deleting notification:', error);
        toast.error('Error al eliminar notificación');
        return false;
      }
    },
    [notifications]
  );

  // Obtener notificaciones por tipo
  const getNotificationsByType = useCallback(
    (type: string) => {
      return notifications.filter((n) => n.type === type);
    },
    [notifications]
  );

  // Obtener notificaciones no leídas
  const getUnreadNotifications = useCallback(() => {
    return notifications.filter((n) => !n.is_read);
  }, [notifications]);

  // Suscripción en tiempo real a nuevas notificaciones
  useEffect(() => {
    if (!profile?.id) return;

    // Cargar notificaciones iniciales
    fetchNotifications();

    // Configurar suscripción en tiempo real
    const channel = supabase
      .channel('notifications-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${profile.id}`,
        },
        (payload) => {
          console.log('Nueva notificación recibida:', payload.new);
          
          // Agregar la nueva notificación al inicio
          setNotifications((prev) => [payload.new as Notification, ...prev]);
          setUnreadCount((prev) => prev + 1);

          // Mostrar toast con la nueva notificación
          const newNotif = payload.new as Notification;
          toast.info(newNotif.message, {
            duration: 5000,
            action: {
              label: 'Ver',
              onClick: () => {
                // Aquí podrías navegar a la notificación específica
                markAsRead(newNotif.id);
              },
            },
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${profile.id}`,
        },
        (payload) => {
          console.log('Notificación actualizada:', payload.new);
          setNotifications((prev) =>
            prev.map((n) =>
              n.id === payload.new.id ? (payload.new as Notification) : n
            )
          );
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${profile.id}`,
        },
        (payload) => {
          console.log('Notificación eliminada:', payload.old);
          setNotifications((prev) => prev.filter((n) => n.id !== payload.old.id));
        }
      )
      .subscribe();

    // Cleanup al desmontar
    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.id, fetchNotifications, markAsRead]);

  return {
    notifications,
    loading,
    unreadCount,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    getNotificationsByType,
    getUnreadNotifications,
  };
}
