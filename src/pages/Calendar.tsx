import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { ParentLayout } from '@/components/layout/ParentLayout';
import { Calendar as CalendarIcon, Plus } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { AcademicCalendar } from '@/components/calendar/AcademicCalendar';
import { EventDialog } from '@/components/calendar/EventDialog';

export default function Calendar() {
  const { profile } = useAuth();
  const [isEventDialogOpen, setIsEventDialogOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleEventCreated = () => {
    setRefreshKey(prev => prev + 1);
    setIsEventDialogOpen(false);
  };

  // Use ParentLayout if user is parent, otherwise DashboardLayout
  const Layout = profile?.role === 'parent' ? ParentLayout : DashboardLayout;

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Calendario Académico</h1>
            <p className="text-muted-foreground">
              Visualiza eventos académicos y de tus cursos
            </p>
          </div>
          {(profile?.role === 'admin' || profile?.role === 'directivo') && (
            <Button onClick={() => setIsEventDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Evento
            </Button>
          )}
        </div>

        <AcademicCalendar key={refreshKey} />

        {(profile?.role === 'admin' || profile?.role === 'directivo') && (
          <EventDialog
            open={isEventDialogOpen}
            onOpenChange={setIsEventDialogOpen}
            onEventCreated={handleEventCreated}
          />
        )}
      </div>
    </Layout>
  );
}
