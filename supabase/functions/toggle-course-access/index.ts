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

    // Solo administradores pueden gestionar acceso a cursos
    if (profile.role !== 'admin') {
      console.error('❌ Usuario no es admin:', profile.role);
      return new Response(
        JSON.stringify({ error: 'No tiene permisos para gestionar acceso a cursos' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 403,
        }
      );
    }

    const { enrollment_id, payment_status, notes } = await req.json();

    if (!enrollment_id || !payment_status) {
      return new Response(
        JSON.stringify({ error: 'enrollment_id y payment_status son requeridos' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    // Validar payment_status
    if (!['pending', 'verified', 'blocked'].includes(payment_status)) {
      return new Response(
        JSON.stringify({ error: 'payment_status debe ser: pending, verified o blocked' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    console.log('🔐 Actualizando acceso a curso - Enrollment:', enrollment_id, 'Estado:', payment_status, 'User role:', profile.role);

    // Actualizar el estado de pago de la matrícula
    const { data: updatedEnrollment, error: updateError } = await supabaseClient
      .from('course_enrollments')
      .update({
        payment_status,
        payment_verified_by: profile.id,
        payment_verified_at: new Date().toISOString(),
        payment_notes: notes || null,
      })
      .eq('id', enrollment_id)
      .select(`
        id,
        payment_status,
        payment_verified_at,
        payment_notes,
        student:student_id (
          id,
          first_name,
          last_name,
          email
        ),
        course:course_id (
          id,
          name
        )
      `)
      .single();

    if (updateError) {
      console.error('❌ Error actualizando matrícula:', updateError.message);
      console.error('❌ Error code:', updateError.code);
      console.error('❌ Error details:', updateError.details);
      console.error('❌ Error hint:', updateError.hint);
      return new Response(
        JSON.stringify({ error: updateError.message, code: updateError.code, details: updateError.details }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        }
      );
    }

    console.log('✅ Acceso actualizado correctamente');

    // Registrar en logs de auditoría si existe la tabla
    try {
      await supabaseClient.from('audit_logs').insert({
        user_id: profile.id,
        action: 'toggle_course_access',
        entity_type: 'enrollment',
        entity_id: enrollment_id,
        details: {
          payment_status,
          notes,
          student: updatedEnrollment.student,
          course: updatedEnrollment.course,
        },
      });
    } catch (auditError) {
      console.warn('⚠️ No se pudo registrar en audit_logs:', auditError);
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        enrollment: updatedEnrollment,
        message: payment_status === 'verified' 
          ? 'Acceso habilitado correctamente' 
          : payment_status === 'blocked'
          ? 'Acceso bloqueado por impago'
          : 'Pago marcado como pendiente'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('❌ Error gestionando acceso a curso:', error);
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
