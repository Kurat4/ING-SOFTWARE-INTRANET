import { 
  GraduationCap, 
  Settings,
  Users,
  Calendar,
  MessageCircle,
  Bell,
  Download,
  User
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";

const ParentSidebar = () => {
  const location = useLocation();
  const currentPath = location.pathname;

  const isActive = (path: string) => {
    if (path === '/parent/admin') {
      return currentPath === path;
    }
    return currentPath.startsWith(path);
  };

  const navigationItems = [
    { to: '/parent/admin', label: 'Panel Padres', icon: Users },
    { to: '/calendar', label: 'Calendario', icon: Calendar },
    { to: '/messages', label: 'Mensajes', icon: MessageCircle },
    { to: '/parent/children', label: 'Lista de hijos', icon: Users },
    { to: '/parent/notifications', label: 'Notificaciones', icon: Bell },
    { to: '/parent/documents', label: 'Documentos', icon: Download },
    { to: '/parent/profile', label: 'Datos personales', icon: User },
  ];

  return (
    <aside className="w-64 border-r border-border bg-background flex flex-col h-screen">
      <div className="p-4 flex flex-col h-full">
        {/* Logo/Header - exact same as AppSidebar */}
        <div className="mb-6">
          <div className="flex items-center gap-3 px-3">
            <div className="w-8 h-8 bg-gradient-primary rounded-lg flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="font-semibold text-foreground text-sm">Peri Institute</h2>
              <p className="text-xs text-muted-foreground">Aula Virtual</p>
            </div>
          </div>
        </div>

        {/* Navigation Group - replicating SidebarGroup structure */}
        <div>
          {/* SidebarGroupLabel equivalent */}
          <div className="flex h-8 shrink-0 items-center rounded-md px-2 text-xs font-medium text-sidebar-foreground/70 uppercase tracking-wider mb-2">
            PRINCIPAL
          </div>
          {/* SidebarGroupContent + SidebarMenu equivalent */}
          <div className="space-y-1 px-2">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  data-active={active}
                  data-sidebar="menu-button"
                  className={`
                    peer/menu-button flex w-full items-center gap-3 overflow-hidden rounded-md px-2 py-2 
                    text-left text-sm outline-none ring-sidebar-ring 
                    transition-[width,height,padding] 
                    hover:bg-sidebar-accent hover:text-sidebar-accent-foreground 
                    focus-visible:ring-2 
                    active:bg-sidebar-accent active:text-sidebar-accent-foreground 
                    disabled:pointer-events-none disabled:opacity-50 
                    data-[active=true]:bg-sidebar-accent 
                    data-[active=true]:font-medium 
                    data-[active=true]:text-sidebar-accent-foreground
                    ${active ? '' : 'text-sidebar-foreground'}
                  `}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Settings - Footer */}
        <div className="mt-auto pt-6 px-2">
          <Link
            to="/settings"
            data-active={isActive('/settings')}
            data-sidebar="menu-button"
            className={`
              peer/menu-button flex w-full items-center gap-3 overflow-hidden rounded-md px-2 py-2 
              text-left text-sm outline-none ring-sidebar-ring 
              transition-[width,height,padding] 
              hover:bg-sidebar-accent hover:text-sidebar-accent-foreground 
              focus-visible:ring-2 
              active:bg-sidebar-accent active:text-sidebar-accent-foreground 
              disabled:pointer-events-none disabled:opacity-50 
              data-[active=true]:bg-sidebar-accent 
              data-[active=true]:font-medium 
              data-[active=true]:text-sidebar-accent-foreground
              ${isActive('/settings') ? '' : 'text-sidebar-foreground'}
            `}
          >
            <Settings className="w-4 h-4 shrink-0" />
            <span className="truncate">Configuración</span>
          </Link>
        </div>
      </div>
    </aside>
  );
};

export default ParentSidebar;
