import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Manejar preflight request
  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      headers: corsHeaders,
      status: 204
    });
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

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      console.error('❌ Error de autenticación:', authError?.message);
      console.error('❌ Authorization header:', req.headers.get('Authorization'));
      return new Response(
        JSON.stringify({ error: 'No autorizado' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401,
        }
      );
    }
    
    console.log('✓ Usuario autenticado:', user.id, user.email);

    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('id, role')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profile) {
      console.error('❌ Error obteniendo perfil:', profileError?.message);
      console.error('❌ Error details:', profileError);
      return new Response(
        JSON.stringify({ error: 'Perfil no encontrado' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 404,
        }
      );
    }
    
    console.log('✓ Perfil encontrado - ID:', profile.id, 'Role:', profile.role);

    // Solo administradores y profesores pueden acceder
    if (profile.role !== 'admin' && profile.role !== 'teacher') {
      console.error('❌ Usuario no tiene permisos:', profile.role);
      return new Response(
        JSON.stringify({ error: 'No tiene permisos para acceder a este recurso' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 403,
        }
      );
    }

    const url = new URL(req.url);
    const course_id = url.searchParams.get('course_id');

    if (!course_id) {
      return new Response(
        JSON.stringify({ error: 'course_id es requerido' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    console.log('📅 Obteniendo fechas de clases - Curso:', course_id);

    // Obtener todas las fechas únicas donde hay registros de asistencia
    // que ya pasaron (son del pasado)
    console.log('📊 Consultando asistencias - course_id:', course_id, 'user_role:', profile.role);
    const { data: attendanceDates, error } = await supabaseClient
      .from('attendance')
      .select('date')
      .eq('course_id', course_id)
      .lte('date', new Date().toISOString().split('T')[0]) // Solo fechas pasadas o de hoy
      .order('date', { ascending: false });

    if (error) {
      console.error('❌ Error consultando asistencias:', error.message);
      console.error('❌ Error code:', error.code);
      console.error('❌ Error details:', error.details);
      console.error('❌ Error hint:', error.hint);
      return new Response(
        JSON.stringify({ error: error.message, code: error.code, details: error.details }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        }
      );
    }

    // Obtener fechas únicas
    const uniqueDates = [...new Set(attendanceDates?.map(a => a.date) || [])];

    console.log('✅ Fechas encontradas:', uniqueDates.length);

    return new Response(
      JSON.stringify({ dates: uniqueDates }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('❌ Error obteniendo fechas:', error);
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
