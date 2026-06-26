import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Skeleton } from '@/components/ui/skeleton';

interface RoleBasedRouteProps {
  children: React.ReactNode;
  allowedRoles: Array<'admin' | 'teacher' | 'student' | 'parent' | 'tutor'>;
  redirectTo?: string;
}

export function RoleBasedRoute({ 
  children, 
  allowedRoles,
  redirectTo = '/' 
}: RoleBasedRouteProps) {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="space-y-4 w-full max-w-md">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (profile && !allowedRoles.some(role => 
    profile.roles?.includes(role) || profile.role === role
  )) {
    return <Navigate to={redirectTo} replace />;
  }

  return <>{children}</>;
}
