import { supabase } from '@/integrations/supabase/client';

export interface Teacher {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role?: string;
}

/**
 * Fetches all users who have the teacher role, either as their primary role
 * or as an additional role in the user_roles table
 */
export async function fetchAllTeachers(): Promise<Teacher[]> {
  try {
    // Fetch users who have teacher as primary role
    const { data: teacherProfiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, email, role')
      .eq('role', 'teacher')
      .eq('is_active', true);

    if (profilesError) throw profilesError;

    // Fetch users who have teacher in user_roles but not as primary role
    const { data: userRolesData, error: rolesError } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'teacher');

    if (rolesError) throw rolesError;

    const teacherUserIds = userRolesData?.map(r => r.user_id) || [];
    
    let teachersFromRoles: Teacher[] = [];
    if (teacherUserIds.length > 0) {
      const { data: profilesFromRoles, error: profilesFromRolesError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email, role')
        .in('user_id', teacherUserIds)
        .eq('is_active', true);

      if (profilesFromRolesError) throw profilesFromRolesError;
      teachersFromRoles = profilesFromRoles || [];
    }

    // Combine both lists and remove duplicates
    const allTeachers = [...(teacherProfiles || []), ...teachersFromRoles];
    
    // Remove duplicates by id
    const uniqueTeachers = Array.from(
      new Map(allTeachers.map(t => [t.id, t])).values()
    ).sort((a, b) => a.first_name.localeCompare(b.first_name));

    return uniqueTeachers;
  } catch (error) {
    console.error('Error fetching teachers:', error);
    throw error;
  }
}
