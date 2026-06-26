import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { formatDateTimeInUserTimezone } from '@/lib/timezoneUtils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Bell, CheckCircle, AlertCircle, ExternalLink, FileText, DollarSign, BookOpen, GraduationCap, Package } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

interface NotificationAssignment {
  id: string;
  title: string;
  due_date: string;
}

interface NotificationExam {
  id: string;
  title: string;
  start_time: string;
}

interface Notification {
  id: string;
  assignment_id: string | null;
  exam_id: string | null;
  material_id: string | null;
  pago_id: string | null;
  matricula_id: string | null;
  modulo_id: string | null;
  type: string;
  message: string;
  is_read: boolean;
  created_at: string;
  metadata?: any;
  assignments?: NotificationAssignment;
  exams?: NotificationExam;
}

export function Notifications() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile) {
      fetchNotifications();
    }
  }, [profile]);

  const fetchNotifications = async () => {
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
        .eq('user_id', profile!.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Normalize data to ensure single objects instead of arrays
      const normalizedData = (data || []).map((notif: any) => ({
        ...notif,
        assignments: Array.isArray(notif.assignments) 
          ? notif.assignments[0] 
          : notif.assignments,
        exams: Array.isArray(notif.exams) 
          ? notif.exams[0] 
          : notif.exams
      }));

      setNotifications(normalizedData);
    } catch (error: any) {
      console.error('Error fetching notifications:', error);
      toast.error('Error al cargar notificaciones');
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId);

      if (error) throw error;

      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, is_read: true } : n))
      );

      toast.success('Notificación marcada como leída');
    } catch (error: any) {
      console.error('Error marking notification as read:', error);
      toast.error('Error al actualizar notificación');
    }
  };

  const markAllAsRead = async () => {
    try {
      const unreadIds = notifications.filter((n) => !n.is_read).map((n) => n.id);

      if (unreadIds.length === 0) {
        toast.info('No hay notificaciones sin leer');
        return;
      }

      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .in('id', unreadIds);

      if (error) throw error;

      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));

      toast.success('Todas las notificaciones marcadas como leídas');
    } catch (error: any) {
      console.error('Error marking all as read:', error);
      toast.error('Error al actualizar notificaciones');
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      // Tareas
      case 'assignment_published':
        return <FileText className="h-5 w-5 text-blue-500" />;
      case 'assignment_due_soon':
        return <AlertCircle className="h-5 w-5 text-orange-500" />;
      case 'assignment_overdue':
      case 'overdue':
        return <AlertCircle className="h-5 w-5 text-destructive" />;
        
      // Exámenes
      case 'exam_published':
        return <GraduationCap className="h-5 w-5 text-purple-500" />;
      case 'exam_due_soon':
        return <AlertCircle className="h-5 w-5 text-orange-500" />;
      case 'exam_graded':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
        
      // Materiales
      case 'material_published':
        return <BookOpen className="h-5 w-5 text-cyan-500" />;
      case 'material_updated':
        return <Package className="h-5 w-5 text-cyan-600" />;
      case 'resource_available':
        return <FileText className="h-5 w-5 text-teal-500" />;
        
      // Pagos
      case 'pago_pendiente':
      case 'recordatorio_pago':
        return <DollarSign className="h-5 w-5 text-orange-500" />;
      case 'pago_vencido':
        return <DollarSign className="h-5 w-5 text-destructive" />;
      case 'pago_confirmado':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'material_pago_pendiente':
        return <DollarSign className="h-5 w-5 text-orange-500" />;
      case 'material_acceso_bloqueado':
        return <AlertCircle className="h-5 w-5 text-destructive" />;
        
      // Sistema
      case 'announcement':
      case 'general':
        return <Bell className="h-5 w-5 text-primary" />;
        
      // Compatibilidad
      case 'pending':
        return <Bell className="h-5 w-5 text-warning" />;
        
      default:
        return <Bell className="h-5 w-5" />;
    }
  };

  const getNotificationBadge = (type: string) => {
    switch (type) {
      // Tareas
      case 'assignment_published':
        return <Badge className="bg-blue-500 hover:bg-blue-600">Nueva Tarea</Badge>;
      case 'assignment_due_soon':
        return <Badge className="bg-orange-500 hover:bg-orange-600">Tarea Por Vencer</Badge>;
      case 'assignment_overdue':
      case 'overdue':
        return <Badge variant="destructive">Tarea Vencida</Badge>;
        
      // Exámenes
      case 'exam_published':
        return <Badge className="bg-purple-500 hover:bg-purple-600">Nuevo Examen</Badge>;
      case 'exam_due_soon':
        return <Badge className="bg-orange-500 hover:bg-orange-600">Examen Por Vencer</Badge>;
      case 'exam_graded':
        return <Badge className="bg-green-500 hover:bg-green-600">Examen Calificado</Badge>;
        
      // Materiales
      case 'material_published':
        return <Badge className="bg-cyan-500 hover:bg-cyan-600">Nuevo Material</Badge>;
      case 'material_updated':
        return <Badge className="bg-cyan-600 hover:bg-cyan-700">Material Actualizado</Badge>;
      case 'resource_available':
        return <Badge className="bg-teal-500 hover:bg-teal-600">Recurso Disponible</Badge>;
        
      // Pagos
      case 'pago_pendiente':
      case 'recordatorio_pago':
        return <Badge className="bg-orange-500 hover:bg-orange-600">Pago Pendiente</Badge>;
      case 'pago_vencido':
        return <Badge variant="destructive">Pago Vencido</Badge>;
      case 'pago_confirmado':
        return <Badge className="bg-green-500 hover:bg-green-600">Pago Confirmado</Badge>;
      case 'material_pago_pendiente':
        return <Badge className="bg-orange-500 hover:bg-orange-600">Material - Pago Pendiente</Badge>;
      case 'material_acceso_bloqueado':
        return <Badge variant="destructive">Acceso Bloqueado</Badge>;
        
      // Sistema
      case 'announcement':
        return <Badge className="bg-primary">Anuncio</Badge>;
      case 'general':
        return <Badge variant="secondary">General</Badge>;
        
      // Compatibilidad
      case 'pending':
        return <Badge className="bg-warning text-warning-foreground">Pendiente</Badge>;
        
      default:
        return <Badge variant="secondary">Notificación</Badge>;
    }
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Notificaciones</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Cargando notificaciones...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <CardTitle>Notificaciones</CardTitle>
          {unreadCount > 0 && (
            <Badge variant="secondary">{unreadCount} sin leer</Badge>
          )}
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={markAllAsRead}>
            Marcar todas como leídas
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {notifications.length === 0 ? (
          <div className="text-center py-8">
            <Bell className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No tienes notificaciones</p>
          </div>
        ) : (
          <div className="space-y-4">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className={`p-4 rounded-lg border ${
                  notification.is_read
                    ? 'bg-background'
                    : 'bg-accent/50 border-accent'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1">
                    {getNotificationIcon(notification.type)}
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {getNotificationBadge(notification.type)}
                        <span className="text-sm text-muted-foreground">
                          {formatDistanceToNow(new Date(notification.created_at), {
                            addSuffix: true,
                            locale: es,
                          })}
                        </span>
                      </div>
                       <p className="text-sm">{notification.message}</p>
                      
                      {/* Enlaces contextuales según el tipo de notificación */}
                      {notification.assignments && (
                        <div className="flex items-center gap-2 mt-2">
                          <p className="text-xs text-muted-foreground">
                            Fecha de entrega:{' '}
                            {formatDateTimeInUserTimezone(notification.assignments.due_date)}
                          </p>
                          <Button
                            variant="link"
                            size="sm"
                            className="h-auto p-0 text-xs"
                            onClick={() => {
                              markAsRead(notification.id);
                              navigate('/assignments');
                            }}
                          >
                            <ExternalLink className="h-3 w-3 mr-1" />
                            Ver tarea
                          </Button>
                        </div>
                      )}
                      
                      {notification.exams && (
                        <div className="flex items-center gap-2 mt-2">
                          <p className="text-xs text-muted-foreground">
                            Fecha del examen:{' '}
                            {formatDateTimeInUserTimezone(notification.exams.start_time)}
                          </p>
                          <Button
                            variant="link"
                            size="sm"
                            className="h-auto p-0 text-xs"
                            onClick={() => {
                              markAsRead(notification.id);
                              navigate('/exams');
                            }}
                          >
                            <ExternalLink className="h-3 w-3 mr-1" />
                            Ver examen
                          </Button>
                        </div>
                      )}
                      
                      {/* Notificaciones de materiales - solo mostrar metadata */}
                      {(notification.type === 'material_published' || 
                        notification.type === 'material_updated' ||
                        notification.type === 'resource_available') && notification.metadata && (
                        <div className="flex items-center gap-2 mt-2">
                          {notification.metadata.material_title && (
                            <p className="text-xs text-muted-foreground">
                              Material: {notification.metadata.material_title}
                            </p>
                          )}
                          <Button
                            variant="link"
                            size="sm"
                            className="h-auto p-0 text-xs"
                            onClick={() => {
                              markAsRead(notification.id);
                              navigate('/courses');
                            }}
                          >
                            <ExternalLink className="h-3 w-3 mr-1" />
                            Ver curso
                          </Button>
                        </div>
                      )}
                      
                      {(notification.type === 'pago_pendiente' || 
                        notification.type === 'recordatorio_pago' ||
                        notification.type === 'material_pago_pendiente') && (
                        <div className="mt-2">
                          {notification.metadata && (
                            <div className="text-xs text-muted-foreground space-y-1">
                              {notification.metadata.saldo_pendiente && (
                                <p>Saldo pendiente: ${notification.metadata.saldo_pendiente}</p>
                              )}
                              {notification.metadata.monto && (
                                <p>Monto: ${notification.metadata.monto}</p>
                              )}
                            </div>
                          )}
                          <Button
                            variant="link"
                            size="sm"
                            className="h-auto p-0 text-xs mt-1"
                            onClick={() => {
                              markAsRead(notification.id);
                              // Aquí podrías redirigir a una página de pagos si existe
                              toast.info('Contacta con administración para realizar tu pago');
                            }}
                          >
                            <DollarSign className="h-3 w-3 mr-1" />
                            Información de pago
                          </Button>
                        </div>
                      )}
                      
                      {notification.type === 'pago_confirmado' && notification.metadata && (
                        <div className="mt-2 text-xs text-muted-foreground">
                          <p>Monto: {notification.metadata.monto} {notification.metadata.moneda}</p>
                          {notification.metadata.comprobante && (
                            <p>Comprobante: {notification.metadata.comprobante}</p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  {!notification.is_read && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => markAsRead(notification.id)}
                    >
                      <CheckCircle className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
