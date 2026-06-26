import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { setUserTimezone } from '@/lib/timezoneUtils';

export type UserRole = 'admin' | 'teacher' | 'student' | 'parent' | 'tutor' | 'directivo';

interface Profile {
  id: string;
  user_id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: UserRole; // Primary role from profiles table
  roles: UserRole[]; // All roles from user_roles table
  phone?: string;
  avatar_url?: string;
  is_active: boolean;
  metadata?: {
    preferences?: {
      darkMode?: boolean;
      timezone?: string;
    };
  };
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  loading: boolean;
  activeRole: UserRole | null;
  setActiveRole: (role: UserRole) => void;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, userData: { first_name: string; last_name: string; role: string; document_number: string }) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeRole, setActiveRoleState] = useState<UserRole | null>(null);

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event, 'User:', session?.user?.email);
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          // Fetch user profile
          setTimeout(async () => {
            console.log('Fetching profile for user:', session.user.id);
            const { data: profileData, error } = await supabase
              .from('profiles')
              .select('*')
              .eq('user_id', session.user.id)
              .maybeSingle();
            
            if (error) {
              console.error('Error fetching profile:', error);
              setProfile(null);
              setLoading(false);
              return;
            }
            
            console.log('Profile data received:', profileData);
            
            if (profileData) {
              // Use role from profiles table
              const primaryRole = profileData.role as UserRole;
              const allRoles = [primaryRole];

              console.log('All roles:', allRoles);

              const profile = {
                ...profileData,
                role: primaryRole,
                roles: allRoles
              };
              
              console.log('Final profile:', profile);
              setProfile(profile);

              // Load active role from localStorage or use primary role
              const savedActiveRole = localStorage.getItem('activeRole') as UserRole;
              if (savedActiveRole && allRoles.includes(savedActiveRole)) {
                setActiveRoleState(savedActiveRole);
              } else {
                setActiveRoleState(primaryRole);
              }

              // Apply user preferences (dark mode, timezone, etc.)
              if (profileData.metadata?.preferences) {
                const prefs = profileData.metadata.preferences;
                
                // Apply dark mode
                if (prefs.darkMode) {
                  document.documentElement.classList.add('dark');
                } else {
                  document.documentElement.classList.remove('dark');
                }
                
                // Apply timezone
                if (prefs.timezone) {
                  setUserTimezone(prefs.timezone);
                }
              }
            
              // Fetch unread notifications for students
              if (profile && profile.role === 'student') {
                const { data: notifications } = await supabase
                  .from('notifications')
                  .select('id, message, type')
                  .eq('user_id', profile.id)
                  .eq('is_read', false)
                  .order('created_at', { ascending: false })
                  .limit(3);

                if (notifications && notifications.length > 0) {
                  notifications.forEach((notif) => {
                    toast.info(notif.message, {
                      description: notif.type === 'overdue' ? 'Tarea vencida' : 'Tarea pendiente',
                    });
                  });
                }
              }
            }
            
            setLoading(false);
          }, 0);
        } else {
          setProfile(null);
          setLoading(false);
        }
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        // Fetch user profile
        setTimeout(async () => {
          const { data: profileData, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('user_id', session.user.id)
            .maybeSingle();
          
          if (error) {
            console.error('Error fetching profile:', error);
            setProfile(null);
            setLoading(false);
            return;
          }
          
          if (profileData) {
            // Use role from profiles table
            const primaryRole = profileData.role as UserRole;
            const allRoles = [primaryRole];

            const profile = {
              ...profileData,
              role: primaryRole,
              roles: allRoles
            };
            
            setProfile(profile);

            // Load active role from localStorage or use primary role
            const savedActiveRole = localStorage.getItem('activeRole') as UserRole;
            if (savedActiveRole && allRoles.includes(savedActiveRole)) {
              setActiveRoleState(savedActiveRole);
            } else {
              setActiveRoleState(primaryRole);
            }

            // Apply user preferences (dark mode, timezone, etc.)
            if (profileData.metadata?.preferences) {
              const prefs = profileData.metadata.preferences;
              
              // Apply dark mode
              if (prefs.darkMode) {
                document.documentElement.classList.add('dark');
              } else {
                document.documentElement.classList.remove('dark');
              }
              
              // Apply timezone
              if (prefs.timezone) {
                setUserTimezone(prefs.timezone);
              }
            }
          }
          
          setLoading(false);
        }, 0);
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signUp = async (email: string, password: string, userData: { first_name: string; last_name: string; role: string }) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: userData
      }
    });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('activeRole');
  };

  const setActiveRole = (role: UserRole) => {
    setActiveRoleState(role);
    localStorage.setItem('activeRole', role);
    
    window.location.reload();
  };

  const value = {
    user,
    profile,
    session,
    loading,
    activeRole,
    setActiveRole,
    signIn,
    signUp,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}