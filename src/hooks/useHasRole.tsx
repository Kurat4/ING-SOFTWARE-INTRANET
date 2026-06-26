import { useAuth, UserRole } from './useAuth';

/**
 * Hook to check if the current user has a specific role
 * Uses the active role if available
 */
export function useHasRole(role: UserRole): boolean {
  const { profile, activeRole } = useAuth();
  
  if (!profile) return false;
  
  const currentRole = activeRole || profile.role;
  
  // Check if the active role matches or if user has the role in their roles array
  return currentRole === role || profile.roles?.includes(role) || false;
}

/**
 * Hook to check if the current user has any of the specified roles
 * Uses the active role if available
 */
export function useHasAnyRole(roles: UserRole[]): boolean {
  const { profile, activeRole } = useAuth();
  
  if (!profile) return false;
  
  const currentRole = activeRole || profile.role;
  
  // Check if the active role is in the list or if user has any of the roles
  return roles.includes(currentRole) || roles.some(role => 
    profile.roles?.includes(role) || profile.role === role
  );
}
