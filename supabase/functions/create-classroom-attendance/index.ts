import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
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

    // Get the user from the auth header
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'No autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user profile to check role
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('id, role')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: 'Perfil no encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Only teachers and admins can create attendance records
    if (profile.role !== 'teacher' && profile.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'No tienes permisos para tomar asistencia' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { classroom_id, date, attendance_records } = await req.json();

    if (!classroom_id || !date || !attendance_records || !Array.isArray(attendance_records)) {
      return new Response(
        JSON.stringify({ error: 'Parámetros inválidos' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify that the user is the teacher of this classroom (or admin)
    if (profile.role !== 'admin') {
      const { data: classroom, error: classroomError } = await supabaseClient
        .from('virtual_classrooms')
        .select('teacher_id')
        .eq('id', classroom_id)
        .single();

      if (classroomError || !classroom) {
        return new Response(
          JSON.stringify({ error: 'Aula virtual no encontrada' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (classroom.teacher_id !== profile.id) {
        return new Response(
          JSON.stringify({ error: 'No eres el profesor de esta aula virtual' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Check if attendance already exists for this date
    const { data: existingRecords, error: checkError } = await supabaseClient
      .from('attendance')
      .select('id')
      .eq('classroom_id', classroom_id)
      .eq('date', date)
      .limit(1);

    if (checkError) {
      console.error('Error checking existing attendance:', checkError);
      return new Response(
        JSON.stringify({ error: 'Error al verificar asistencia existente' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If records exist, delete them first (to update)
    if (existingRecords && existingRecords.length > 0) {
      const { error: deleteError } = await supabaseClient
        .from('attendance')
        .delete()
        .eq('classroom_id', classroom_id)
        .eq('date', date);

      if (deleteError) {
        console.error('Error deleting existing attendance:', deleteError);
        return new Response(
          JSON.stringify({ error: 'Error al actualizar asistencia existente' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Prepare records for insertion
    const recordsToInsert = attendance_records.map((record: any) => ({
      classroom_id: classroom_id,
      student_id: record.student_id,
      date: date,
      status: record.status,
      notes: record.notes || null,
      recorded_by: profile.id,
      recorded_at: new Date().toISOString(),
    }));

    // Insert new attendance records
    const { data: insertedRecords, error: insertError } = await supabaseClient
      .from('attendance')
      .insert(recordsToInsert)
      .select();

    if (insertError) {
      console.error('Error inserting attendance:', insertError);
      return new Response(
        JSON.stringify({ 
          error: 'Error al guardar la asistencia',
          details: insertError.message 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        records: insertedRecords,
        message: `Asistencia registrada para ${insertedRecords.length} estudiantes`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in create-classroom-attendance:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Error interno del servidor',
        details: error instanceof Error ? error.message : String(error)
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
