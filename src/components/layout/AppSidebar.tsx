import { 
  GraduationCap, 
  Settings, 
  Shield
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { getNavigationForRole, adminNavigationItems } from "@/utils/roleNavigation";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

export function AppSidebar() {
  const { profile, activeRole } = useAuth();
  const { state } = useSidebar();
  const location = useLocation();
  const currentPath = location.pathname;
  const collapsed = state === "collapsed";

  const isActive = (path: string) => currentPath === path;
  
  // Get navigation items based on active role
  const currentRole = activeRole || profile?.role;
  const navigationItems = profile && currentRole ? getNavigationForRole(currentRole, profile.roles) : [];
  const mainItems = navigationItems.filter(item => 
    !adminNavigationItems.some(adminItem => adminItem.url === item.url)
  );

  return (
    <Sidebar className={`border-r border-sidebar-border bg-sidebar ${collapsed ? "w-16" : "w-64"}`}>
      <SidebarContent className="p-4">
        {/* Logo/Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 px-3">
            <div className="w-10 h-10 flex-shrink-0 rounded-full overflow-hidden bg-white">
              <img 
                src="/peri-logo.png" 
                alt="Peri Institute Logo" 
                className="w-full h-full object-cover"
              />
            </div>
            {!collapsed && (
              <div>
                <h2 className="font-semibold text-sidebar-foreground text-sm">Peri Institute</h2>
                <p className="text-xs text-sidebar-foreground/70">Plataforma Intranet</p>
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-medium text-sidebar-foreground/60 uppercase tracking-wider mb-2">
            {!collapsed && (currentRole === 'admin' ? 'Navegación' : 'Principal')}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {mainItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <Link to={item.url} className="flex items-center gap-3">
                      <item.icon className="w-4 h-4" />
                      {!collapsed && <span className="text-sm">{item.title}</span>}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Admin Panel - Only for admin users */}
        {currentRole === 'admin' && (
          <SidebarGroup className="mt-6">
            <SidebarGroupLabel className="text-xs font-medium text-sidebar-foreground/60 uppercase tracking-wider mb-2">
              {!collapsed && (
                <div className="flex items-center gap-2">
                  <Shield className="w-3 h-3" />
                  Administración
                </div>
              )}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="space-y-1">
                {adminNavigationItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive(item.url)}>
                      <Link to={item.url} className="flex items-center gap-3">
                        <item.icon className="w-4 h-4" />
                        {!collapsed && <span className="text-sm">{item.title}</span>}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Settings - Available for all roles */}
        <div className="mt-auto pt-6">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={isActive("/settings")}>
                <Link to="/settings" className="flex items-center gap-3">
                  <Settings className="w-4 h-4" />
                  {!collapsed && <span className="text-sm">Configuración</span>}
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </div>
      </SidebarContent>
    </Sidebar>
  );
}