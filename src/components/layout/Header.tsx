import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Bell, Search, User, Settings, LogOut, GraduationCap, Menu } from "lucide-react"
import { Notifications } from "@/components/Notifications";
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from "@/hooks/useAuth"
import { useToast } from "@/hooks/use-toast"

interface HeaderProps {
  showSidebarTrigger?: boolean;
}

export function Header({ showSidebarTrigger = false }: HeaderProps) {
  const { profile, signOut, activeRole } = useAuth();
  const { toast } = useToast();
  const [unreadCount, setUnreadCount] = useState<number>(0);

  const handleSignOut = async () => {
    try {
      await signOut();
      toast({
        title: "Sesión cerrada",
        description: "Has cerrado sesión exitosamente.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo cerrar la sesión.",
        variant: "destructive",
      });
    }
  };

  // Fetch unread notifications count
  const fetchUnreadCount = async () => {
    try {
      if (!profile) return;
      const { data, error } = await supabase
        .from('notifications')
        .select('id')
        .eq('user_id', profile.id)
        .eq('is_read', false);

      if (error) throw error;
      setUnreadCount((data || []).length);
    } catch (err) {
      console.error('Error fetching unread count:', err);
    }
  };

  useEffect(() => {
    if (!profile) return;
    fetchUnreadCount();

    // Setup realtime subscription for notifications for this user
    const channel = supabase.channel(`notifications_user_${profile.id}`);

    channel.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${profile.id}` }, (payload) => {
      // new notification: increment
      setUnreadCount((c) => c + 1);
    });

    channel.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `user_id=eq.${profile.id}` }, (payload) => {
      // on update (e.g., marked as read) refetch to be safe
      fetchUnreadCount();
    });

    channel.subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [profile?.id]);

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'admin': return 'Administrador';
      case 'teacher': return 'Docente';
      case 'student': return 'Estudiante';
      case 'parent': return 'Padre de Familia';
      case 'tutor': return 'Tutor';
      default: return 'Usuario';
    }
  };

  return (
    <header className="border-b border-border bg-white dark:bg-gray-900 shadow-sm">
      <div className="flex h-16 items-center px-6 gap-4">
        {/* Search */}
        <div className="flex-1 max-w-sm">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground dark:text-gray-400 w-4 h-4" />
            <Input
              placeholder="Buscar cursos, tareas..."
              className="pl-10 bg-background dark:bg-gray-800 border-border dark:border-gray-700 focus:border-primary focus:ring-primary dark:text-white"
            />
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-3">
            {/* Notifications */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative hover:bg-secondary/10 dark:hover:bg-gray-800">
                  <Bell className="w-5 h-5 text-primary dark:text-gray-300" />
                  <Badge 
                    variant="destructive" 
                    className="absolute -top-1 -right-1 h-5 min-w-[1.25rem] flex items-center justify-center px-1 text-xs bg-secondary"
                    aria-label={`${unreadCount} notificaciones sin leer`}
                  >
                    {unreadCount}
                  </Badge>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-96 p-0 shadow-lg dark:bg-gray-800 dark:border-gray-700" align="end">
                <div className="max-h-80 overflow-auto">
                  <Notifications />
                </div>
                <DropdownMenuItem asChild>
                  <a href="/profile?tab=notifications" className="w-full text-center text-sm underline text-primary dark:text-blue-400">Ver más</a>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

          {/* User menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-10 w-10 rounded-full hover:bg-secondary/10 dark:hover:bg-gray-800">
                <Avatar className="h-10 w-10 ring-2 ring-secondary/20 dark:ring-gray-700">
                  <AvatarImage src={profile?.avatar_url} alt="Usuario" />
                  <AvatarFallback className="bg-secondary dark:bg-gray-700 text-white font-semibold">
                    {profile ? getInitials(profile.first_name, profile.last_name) : 'U'}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56 bg-white dark:bg-gray-800 shadow-lg dark:border-gray-700" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none text-primary dark:text-white">
                    {profile ? `${profile.first_name} ${profile.last_name}` : 'Usuario'}
                  </p>
                  <p className="text-xs leading-none text-muted-foreground dark:text-gray-400">
                    {profile?.email}
                  </p>
                  <Badge variant="secondary" className="text-xs w-fit bg-secondary dark:bg-gray-700 text-white">{profile ? getRoleLabel(activeRole || profile.role) : 'Usuario'}</Badge>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="dark:bg-gray-700" />
              <DropdownMenuItem className="hover:bg-secondary/10 dark:hover:bg-gray-700 cursor-pointer dark:text-gray-200" asChild>
                <a href="/profile" className="flex items-center w-full">
                  <User className="mr-2 h-4 w-4 text-primary dark:text-gray-300" />
                  <span>Perfil</span>
                </a>
              </DropdownMenuItem>
              <DropdownMenuItem className="hover:bg-secondary/10 dark:hover:bg-gray-700 cursor-pointer dark:text-gray-200" asChild>
                <a href="/settings" className="flex items-center w-full">
                  <Settings className="mr-2 h-4 w-4 text-primary dark:text-gray-300" />
                  <span>Configuración</span>
                </a>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="dark:bg-gray-700" />
              <DropdownMenuItem 
                className="hover:bg-destructive/10 dark:hover:bg-red-900/30 text-destructive dark:text-red-400 cursor-pointer"
                onClick={handleSignOut}
              >
                <LogOut className="mr-2 h-4 w-4" />
                <span>Cerrar sesión</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}