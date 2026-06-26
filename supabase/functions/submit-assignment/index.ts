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
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);

    if (userError || !user) {
      throw new Error('No autorizado');
    }

    const { 
      assignmentTitle, 
      content, 
      files,
      courseId,
      moduloId 
    } = await req.json();

    console.log('Submitting assignment for user:', user.id);

    // Get student profile
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profile) {
      throw new Error('Perfil no encontrado');
    }

    // Check if assignment already exists
    let assignmentId;
    let assignmentModuloId = moduloId;
    
    const { data: existingAssignment } = await supabaseClient
      .from('assignments')
      .select('id, modulo_id')
      .eq('title', assignmentTitle)
      .or(`course_id.eq.${courseId}${moduloId ? `,modulo_id.eq.${moduloId}` : ''}`)
      .maybeSingle();

    if (existingAssignment) {
      assignmentId = existingAssignment.id;
      assignmentModuloId = existingAssignment.modulo_id || moduloId;
    } else {
      // Create assignment using service role (bypasses RLS)
      const { data: newAssignment, error: assignmentError } = await supabaseClient
        .from('assignments')
        .insert({
          title: assignmentTitle,
          description: `Tarea: ${assignmentTitle}`,
          max_score: 100,
          course_id: courseId,
          modulo_id: moduloId,
          is_published: true
        })
        .select()
        .single();

      if (assignmentError) {
        console.error('Error creating assignment:', assignmentError);
        throw new Error('Error al crear la tarea');
      }
      assignmentId = newAssignment.id;
      assignmentModuloId = newAssignment.modulo_id;
    }

    // Create submission with user's auth (RLS allows students to create their own submissions)
    const userSupabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    // Store first file in legacy fields for backwards compatibility
    const firstFile = files && files.length > 0 ? files[0] : null;
    
    // Store all files in student_files JSON array
    const studentFiles = files && files.length > 0 ? files.map((file: any) => ({
      file_path: file.filePath,
      file_name: file.fileName,
      file_size: file.fileSize,
      mime_type: file.mimeType,
      file_url: file.fileUrl
    })) : [];

    const { error: submissionError } = await userSupabase
      .from('assignment_submissions')
      .insert({
        assignment_id: assignmentId,
        student_id: profile.id,
        modulo_id: assignmentModuloId,
        content: content || null,
        file_path: firstFile?.filePath,
        file_name: firstFile?.fileName,
        file_size: firstFile?.fileSize,
        mime_type: firstFile?.mimeType,
        file_url: firstFile?.fileUrl,
        student_files: studentFiles
      });

    if (submissionError) {
      console.error('Error creating submission:', submissionError);
      throw new Error('Error al crear la entrega');
    }

    return new Response(
      JSON.stringify({ success: true, assignmentId }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    );
  }
});