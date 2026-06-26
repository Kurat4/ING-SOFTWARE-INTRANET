import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNotifications } from '@/hooks/useNotifications';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatDateTimeInUserTimezone } from '@/lib/timezoneUtils';
import { 
  Bell, 
  CheckCircle, 
  Filter,
  FileText,
  GraduationCap,
  BookOpen,
  DollarSign,
  AlertCircle,
  ExternalLink,
  Package
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';

export default function NotificationsPage() {
  const navigate = useNavigate();
  const { 
    notifications, 
    loading, 
    unreadCount,
    markAsRead,
    markAllAsRead
  } = useNotifications();
  
  const [filterType, setFilterType] = useState<string | null>(null);
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);

  // Filtrar notificaciones
  const getFilteredNotifications = () => {
    let filtered = notifications;
    
    // Filtrar por leído/no leído
    if (showUnreadOnly) {
      filtered = filtered.filter(n => !n.is_read);
    }
    
    // Filtrar por tipo
    if (filterType) {
      filtered = filtered.filter(n => n.type.includes(filterType));
    }
    
    return filtered;
  };

  const filteredNotifications = getFilteredNotifications();

  // Contar notificaciones por categoría
  const counts = {
    all: notifications.length,
    unread: unreadCount,
    assignments: notifications.filter(n => n.type.includes('assignment')).length,
    exams: notifications.filter(n => n.type.includes('exam')).length,
    materials: notifications.filter(n => n.type.includes('material') || n.type.includes('resource')).length,
    payments: notifications.filter(n => n.type.includes('pago')).length,
  };

  const getNotificationIcon = (type: string) => {
    if (type.includes('assignment')) return <FileText className="h-5 w-5 text-blue-500" />;
    if (type.includes('exam')) return <GraduationCap className="h-5 w-5 text-purple-500" />;
    if (type.includes('material')) return <BookOpen className="h-5 w-5 text-cyan-500" />;
    if (type.includes('pago')) return <DollarSign className="h-5 w-5 text-green-500" />;
    if (type.includes('overdue')) return <AlertCircle className="h-5 w-5 text-destructive" />;
    return <Bell className="h-5 w-5 text-primary" />;
  };

  const getNotificationBadge = (type: string) => {
    if (type === 'assignment_published') return <Badge className="bg-blue-500">Nueva Tarea</Badge>;
    if (type === 'assignment_due_soon') return <Badge className="bg-orange-500">Tarea Por Vencer</Badge>;
    if (type === 'exam_published') return <Badge className="bg-purple-500">Nuevo Examen</Badge>;
    if (type === 'pago_confirmado') return <Badge className="bg-green-500">Pago Confirmado</Badge>;
    if (type === 'recordatorio_pago') return <Badge className="bg-orange-500">Pago Pendiente</Badge>;
    return <Badge variant="secondary">{type}</Badge>;
  };

  const handleNotificationClick = (notification: any) => {
    markAsRead(notification.id);
    
    // Navegar según el tipo
    if (notification.assignments) navigate('/assignments');
    else if (notification.exams) navigate('/exams');
    else if (notification.type.includes('material')) navigate('/courses');
  };

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">Cargando notificaciones...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Notificaciones</h1>
          <p className="text-muted-foreground">
            {unreadCount > 0 
              ? `Tienes ${unreadCount} notificación${unreadCount > 1 ? 'es' : ''} sin leer`
              : 'Estás al día con tus notificaciones'
            }
          </p>
        </div>

        <div className="flex gap-2">
          {/* Filtro de tipo */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Filter className="h-4 w-4" />
                {filterType ? filterType.charAt(0).toUpperCase() + filterType.slice(1) : 'Todas'}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Filtrar por categoría</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setFilterType(null)}>
                Todas ({counts.all})
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilterType('assignment')}>
                <FileText className="h-4 w-4 mr-2" />
                Tareas ({counts.assignments})
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilterType('exam')}>
                <GraduationCap className="h-4 w-4 mr-2" />
                Exámenes ({counts.exams})
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilterType('material')}>
                <BookOpen className="h-4 w-4 mr-2" />
                Materiales ({counts.materials})
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilterType('pago')}>
                <DollarSign className="h-4 w-4 mr-2" />
                Pagos ({counts.payments})
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Toggle sin leer */}
          <Button
            variant={showUnreadOnly ? "default" : "outline"}
            onClick={() => setShowUnreadOnly(!showUnreadOnly)}
            className="gap-2"
          >
            <CheckCircle className="h-4 w-4" />
            Sin leer ({unreadCount})
          </Button>

          {/* Marcar todas como leídas */}
          {unreadCount > 0 && (
            <Button variant="secondary" onClick={markAllAsRead}>
              Marcar todas leídas
            </Button>
          )}
        </div>
      </div>

      {/* Lista de notificaciones */}
      <Card>
        <CardHeader>
          <CardTitle>
            {showUnreadOnly ? 'Sin leer' : filterType ? `Filtradas por ${filterType}` : 'Todas las notificaciones'}
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              ({filteredNotifications.length})
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredNotifications.length === 0 ? (
            <div className="text-center py-12">
              <Bell className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                {showUnreadOnly 
                  ? '¡Excelente! No tienes notificaciones sin leer'
                  : 'No hay notificaciones'
                }
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredNotifications.map((notification) => (
                <div
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={`p-4 rounded-lg border cursor-pointer hover:bg-accent/50 transition-colors ${
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
                        
                        {/* Información adicional */}
                        {notification.assignments && (
                          <p className="text-xs text-muted-foreground mt-2">
                            Fecha de entrega: {formatDateTimeInUserTimezone(notification.assignments.due_date)}
                          </p>
                        )}
                        {notification.exams && (
                          <p className="text-xs text-muted-foreground mt-2">
                            Fecha del examen: {formatDateTimeInUserTimezone(notification.exams.start_time)}
                          </p>
                        )}
                      </div>
                    </div>
                    {!notification.is_read && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          markAsRead(notification.id);
                        }}
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
    </div>
  );
}
