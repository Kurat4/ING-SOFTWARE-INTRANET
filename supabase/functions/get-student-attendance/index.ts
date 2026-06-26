import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      throw new Error('No autorizado');
    }

    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('id, role')
      .eq('user_id', user.id)
      .single();

    if (!profile) {
      throw new Error('Perfil no encontrado');
    }

    const url = new URL(req.url);
    const student_id = url.searchParams.get('student_id') || profile.id;

    // Students can only see their own attendance
    if (profile.role === 'student' && student_id !== profile.id) {
      throw new Error('No puede ver la asistencia de otros estudiantes');
    }

    console.log('📊 Obteniendo asistencia del estudiante:', student_id);

    const { data, error } = await supabaseClient
      .from('attendance')
      .select(`
        id,
        date,
        status,
        notes,
        created_at,
        course:courses!attendance_course_id_fkey(
          id,
          name,
          code
        )
      `)
      .eq('student_id', student_id)
      .order('date', { ascending: false });

    if (error) throw error;

    // Calculate statistics
    const totalRecords = data.length;
    const presentCount = data.filter(r => r.status === 'present').length;
    const lateCount = data.filter(r => r.status === 'late').length;
    const absentCount = data.filter(r => r.status === 'absent').length;
    const justifiedCount = data.filter(r => r.status === 'justified').length;

    const stats = {
      total: totalRecords,
      present: presentCount,
      late: lateCount,
      absent: absentCount,
      justified: justifiedCount,
      attendance_rate: totalRecords > 0 ? ((presentCount + lateCount) / totalRecords * 100).toFixed(2) : 0,
    };

    console.log('✅ Asistencia obtenida:', data.length, 'registros');

    return new Response(
      JSON.stringify({ records: data, stats }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Error:', error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});