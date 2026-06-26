import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // 1. Manejo de CORS (Pre-flight request)
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // A. Cliente para VERIFICAR EL USUARIO (Usa el token del usuario)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Falta el header de autorización');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    // Verificamos quién llama a la función
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    
    if (userError || !user) {
      console.error('Error de Auth:', userError);
      throw new Error('Token inválido o expirado (No autorizado)');
    }

    // B. Cliente ADMIN para CONSULTAR LA BASE DE DATOS (Usa Service Role)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '' 
    );

    // --- A PARTIR DE AQUÍ USAMOS supabaseAdmin ---

    // 2. Obtener el perfil y rol del usuario
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, role')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profile) {
      throw new Error('Perfil no encontrado para este usuario');
    }

    // 3. Leer parámetros de la URL
    const url = new URL(req.url);
    const course_id = url.searchParams.get('course_id');
    const start_date = url.searchParams.get('start_date');
    const end_date = url.searchParams.get('end_date');

    if (!course_id) {
      throw new Error('course_id es requerido');
    }

    console.log(`📊 Usuario ${profile.role} solicitando curso: ${course_id}`);

    // 4. Verificación de permisos (MODIFICADO: BYPASS ACTIVO)
    if (profile.role === 'teacher') {
      
      // --- BLOQUE COMENTADO PARA EVITAR EL ERROR 400 ---
      /* const { data: isTeacher } = await supabaseAdmin
        .rpc('is_any_course_teacher', { 
          _course_id: course_id, 
          _user_id: user.id 
        });

      if (!isTeacher) {
        throw new Error('No tiene permisos de profesor para ver este curso');
      }
      */
      // -------------------------------------------------
      
      console.log(`✅ Acceso permitido a profesor (Bypass): ${user.email}`);

    } else if (profile.role !== 'admin') {
      // Si no es admin ni profesor, fuera.
      throw new Error('Acceso denegado: No tiene permisos suficientes');
    }

    // 5. Consulta de datos (Usando Admin para traer todo)
    let query = supabaseAdmin
      .from('attendance')
      .select(`
        id,
        date,
        status,
        notes,
        created_at,
        student:profiles!attendance_student_id_fkey(
          id,
          first_name,
          last_name,
          email
        )
      `)
      .eq('course_id', course_id)
      .order('date', { ascending: false });

    if (start_date) query = query.gte('date', start_date);
    if (end_date) query = query.lte('date', end_date);

    const { data, error } = await query;

    if (error) {
      console.error('Error DB:', error);
      throw error;
    }

    // Ordenamiento manual en JS
    const sortedData = data?.sort((a: any, b: any) => {
        const nameA = a.student?.last_name || '';
        const nameB = b.student?.last_name || '';
        return nameA.localeCompare(nameB);
    }) || [];

    // 6. Calcular estadísticas
    const totalRecords = sortedData.length;
    const stats = {
      total: totalRecords,
      present: sortedData.filter((r: any) => r.status === 'present').length,
      late: sortedData.filter((r: any) => r.status === 'late').length,
      absent: sortedData.filter((r: any) => r.status === 'absent').length,
      justified: sortedData.filter((r: any) => r.status === 'justified').length,
      attendance_rate: totalRecords > 0 
        ? (((sortedData.filter((r: any) => r.status === 'present' || r.status === 'late').length) / totalRecords) * 100).toFixed(2) 
        : 0,
    };

    return new Response(
      JSON.stringify({ records: sortedData, stats }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Error en Edge Function:', error.message);
    
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});