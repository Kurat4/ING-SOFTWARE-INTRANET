import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // 1. Manejo de CORS (Preflight)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // LOG DE DEPURACIÓN: Verificamos que la función arranca
    console.log("🚀 Download function started")

    // 2. Inicializar Supabase con SERVICE_ROLE (Modo Dios para firmar URL)
    // Es CRÍTICO que esta variable de entorno esté configurada en Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    if (!supabaseServiceKey) {
      console.error("❌ FATAL: Falta SUPABASE_SERVICE_ROLE_KEY en Secrets");
      throw new Error('Server configuration error: Missing Service Key');
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    // 3. Obtener y Validar el Token del Usuario
    const authHeader = req.headers.get('Authorization');
    
    if (!authHeader) {
      console.error("❌ Error: No se recibió header de Authorization");
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Verificamos si el token es válido
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      console.error("❌ Error de Autenticación:", authError);
      return new Response(JSON.stringify({ error: 'Unauthorized', details: authError }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log("✅ Usuario autenticado:", user.email);

    // 4. Leer el cuerpo de la petición
    const { bucket, filePath, fileName } = await req.json();
    console.log(`📂 Solicitando archivo: Bucket [${bucket}], Path [${filePath}]`);

    if (!bucket || !filePath) {
      return new Response(JSON.stringify({ error: 'Missing bucket or filePath' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 5. Verificar Rol del Usuario en la BD
    // OJO: Asumo que tu tabla 'profiles' tiene la columna 'user_id' según vi en tus capturas.
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('id, role, user_id')
      .eq('user_id', user.id) // OJO: Si tu FK es 'id', cambia esto a .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      console.error("❌ Error buscando perfil:", profileError);
      throw new Error('Profile not found');
    }

    console.log("👤 Rol detectado:", profile.role);

    // 6. Lógica de Permisos (Tu lógica original mejorada)
    let hasPermission = false;

    if (bucket === 'course-documents' || bucket === 'course-videos') {
      // Profes, Alumnos y Admins pueden bajar material
      hasPermission = ['student', 'teacher', 'admin'].includes(profile.role);
    
    } else if (bucket === 'student-submissions') {
      // Lógica para entregas
      if (profile.role === 'admin' || profile.role === 'teacher') {
        hasPermission = true;
      } else if (profile.role === 'student') {
        // El estudiante solo baja lo suyo (asumiendo que el path empieza con su ID)
        // OJO: Verifica si tus archivos se guardan como "USER_ID/archivo.pdf"
        hasPermission = filePath.includes(user.id); 
      }
    }

    if (!hasPermission) {
      console.warn("🚫 Permiso denegado para rol:", profile.role);
      return new Response(JSON.stringify({ error: 'Permission denied' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 7. Generar URL Firmada
    // Usamos el cliente con Service Role, así que esto ignorará las políticas RLS del Storage (Correcto aquí porque ya validamos permisos arriba)
    const { data, error: signError } = await supabaseClient.storage
      .from(bucket)
      .createSignedUrl(filePath, 300); // 5 minutos

    if (signError) {
      console.error("❌ Error firmando URL:", signError);
      throw signError;
    }

    // 8. ÉXITO
    return new Response(JSON.stringify({ 
      signedUrl: data.signedUrl,
      fileName: fileName || filePath.split('/').pop()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('🔥 CRITICAL ERROR:', error);
    return new Response(JSON.stringify({ error: error.message || 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
})