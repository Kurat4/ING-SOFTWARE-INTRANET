import { 
  Home, 
  BookOpen, 
  FileText, 
  School, 
  ClipboardList,
  Users,
  UserCog,
  BarChart3,
  Calendar,
  MessageSquare,
  Library,
  Brain,
  HelpCircle,
  Settings,
  Eye,
  Award,
  DollarSign,
  Layers,
  ShoppingBag,
  Video
} from 'lucide-react';

export type UserRole = 'admin' | 'teacher' | 'student' | 'parent' | 'tutor' | 'directivo';

export interface NavItem {
  title: string;
  url: string;
  icon: any;
  roles: UserRole[];
}

export const navigationItems: NavItem[] = [
  // Menú para padres en el orden solicitado
  {
    title: 'Panel Padres',
    url: '/parent/admin',
    icon: Users,
    roles: ['parent']
  },
  {
    title: 'Calendario',
    url: '/parent/calendar',
    icon: Calendar,
    roles: ['parent']
  },
  {
    title: 'Mensajes',
    url: '/parent/messages',
    icon: MessageSquare,
    roles: ['parent']
  },
  {
    title: 'Lista de hijos',
    url: '/parent/children',
    icon: Users,
    roles: ['parent']
  },
  {
    title: 'Notificaciones',
    url: '/parent/notifications',
    icon: MessageSquare,
    roles: ['parent']
  },
  {
    title: 'Documentos',
    url: '/parent/documents',
    icon: FileText,
    roles: ['parent']
  },
  {
    title: 'Datos personales',
    url: '/parent/profile',
    icon: UserCog,
    roles: ['parent']
  },
  // Menú general para otros roles
  {
    title: 'Dashboard',
    url: '/',
    icon: Home,
    roles: ['admin', 'teacher', 'student', 'tutor', 'directivo']
  },
  {
    title: 'Calendario',
    url: '/calendar',
    icon: Calendar,
    roles: ['admin', 'teacher', 'student', 'tutor', 'directivo']
  },
  {
    title: 'Mensajes',
    url: '/messages',
    icon: MessageSquare,
    roles: ['tutor', 'directivo']
  },
  
  // Dashboard Tutor
  {
    title: 'Dashboard',
    url: '/tutor-dashboard',
    icon: Home,
    roles: ['tutor']
  },
  
  // Dashboard Directivo
  {
    title: 'Supervisión Docente',
    url: '/directivo-dashboard',
    icon: Eye,
    roles: ['directivo', 'admin']
  },
  
  // Cursos
  {
    title: 'Mis Cursos',
    url: '/courses',
    icon: BookOpen,
    roles: ['teacher', 'student']
  },
  
  // Tareas
  {
    title: 'Tareas',
    url: '/assignments',
    icon: FileText,
    roles: ['teacher', 'student', 'tutor']
  },
  
  // Exámenes
  {
    title: 'Exámenes',
    url: '/exams',
    icon: ClipboardList,
    roles: ['teacher', 'student']
  },
];

export const adminNavigationItems: NavItem[] = [
  {
    title: 'Gestión de Cursos',
    url: '/admin/courses',
    icon: BookOpen,
    roles: ['admin']
  },
  {
    title: 'Gestión de Estudiantes',
    url: '/admin/students',
    icon: Users,
    roles: ['admin']
  },
  {
    title: 'Pagos',
    url: '/admin/pagos',
    icon: DollarSign,
    roles: ['admin']
  },
  {
    title: 'Materiales',
    url: '/admin/materiales',
    icon: ShoppingBag,
    roles: ['admin']
  },
  {
    title: 'Cursos Grabados',
    url: '/admin/cursos-grabados',
    icon: Video,
    roles: ['admin']
  },
  {
    title: 'Ventas de Cursos',
    url: '/admin/ventas-cursos-grabados',
    icon: ShoppingBag,
    roles: ['admin']
  },
  {
    title: 'Gestión de Usuarios',
    url: '/admin/users',
    icon: UserCog,
    roles: ['admin']
  },
  {
    title: 'Reportes',
    url: '/admin/reports',
    icon: BarChart3,
    roles: ['admin']
  },
  {
    title: 'Certificados',
    url: '/admin/certificates',
    icon: Award,
    roles: ['admin']
  },
  {
    title: 'Encuesta Docente',
    url: '/admin/satisfaccion',
    icon: ClipboardList, // Este icono ya lo tienes importado arriba
    roles: ['admin']
  },
];

export function getNavigationForRole(role: UserRole, allRoles?: UserRole[]): NavItem[] {
  // Use all roles if provided, otherwise just use the primary role
  const rolesToCheck = allRoles || [role];
  
  if (rolesToCheck.includes('admin')) {
    // Combine all items that match any of the user's roles
    const matchingItems = navigationItems.filter(item => 
      item.roles.some(r => rolesToCheck.includes(r))
    );
    return [...matchingItems, ...adminNavigationItems];
  }
  
  // Filter items that match any of the user's roles
  return navigationItems.filter(item => 
    item.roles.some(r => rolesToCheck.includes(r))
  );
}

export function canAccessRoute(role: UserRole, path: string, allRoles?: UserRole[]): boolean {
  const allItems = [...navigationItems, ...adminNavigationItems];
  const item = allItems.find(item => item.url === path);
  
  if (!item) return true; // Allow access to unregistered routes
  
  // Check if any of the user's roles match
  const rolesToCheck = allRoles || [role];
  return item.roles.some(r => rolesToCheck.includes(r));
}
