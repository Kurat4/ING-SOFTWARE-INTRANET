import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Método no permitido. Solo se permite POST.',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 405 }
    )
  }

  try {
    // Get the Supabase client
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? '',
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ''
    )

    // Get user from Authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Token de autorización requerido' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      )
    }

    // Verify the JWT token and get user
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)

    if (authError || !user) {
      console.error('❌ Error de autenticación:', authError)
      return new Response(
        JSON.stringify({ success: false, error: 'No autorizado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      )
    }

    // Get user profile
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('id, role')
      .eq('user_id', user.id)
      .single()

    if (profileError || !profile) {
      console.error('❌ Error obteniendo perfil:', profileError)
      return new Response(
        JSON.stringify({ success: false, error: 'Perfil no encontrado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      )
    }

    // Check if user can create courses (admin, teacher)
    if (!['admin', 'teacher'].includes(profile.role)) {
      return new Response(
        JSON.stringify({ success: false, error: 'No tienes permisos para crear cursos' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      )
    }

    let body;
    try {
      body = await req.json()
    } catch (parseError) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'JSON inválido en el body de la petición'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    const { 
      name, 
      description, 
      code, 
      academic_year, 
      semester, 
      teacher_id, 
      classroom_id,
      start_date,
      end_date,
      schedule
    } = body

    // Validar campos requeridos
    if (!name || !code || !academic_year || !semester || !teacher_id || !classroom_id) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Campos requeridos: name, code, academic_year, semester, teacher_id, classroom_id'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    console.log('🔍 Datos recibidos:', JSON.stringify(body, null, 2))
    console.log(`➕ Creando curso: ${name} (${code})`)

    // Verify that the classroom exists and user has access
    console.log(`🏫 Verificando aula virtual: ${classroom_id}`)
    const { data: classroom, error: classroomError } = await supabaseClient
      .from('virtual_classrooms')
      .select('id, name, teacher_id')
      .eq('id', classroom_id)
      .single()

    if (classroomError || !classroom) {
      console.error('❌ Error verificando aula virtual:', classroomError)
      return new Response(
        JSON.stringify({ success: false, error: 'Aula virtual no encontrada', details: classroomError?.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      )
    }
    console.log('✅ Aula virtual encontrada:', classroom.name)

    // Check if user has permission to create courses in this classroom
    console.log(`🔐 Verificando permisos. Usuario role: ${profile.role}, classroom teacher_id: ${classroom.teacher_id}, user profile_id: ${profile.id}`)
    if (profile.role === 'teacher' && classroom.teacher_id !== profile.id) {
      console.error('❌ Usuario no tiene permisos en este aula virtual')
      return new Response(
        JSON.stringify({ success: false, error: 'No tienes permisos para crear cursos en esta aula virtual' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      )
    }
    console.log('✅ Permisos verificados')

    // Verify that the teacher exists
    console.log(`👨‍🏫 Verificando profesor: ${teacher_id}`)
    const { data: teacher, error: teacherError } = await supabaseClient
      .from('profiles')
      .select('id, first_name, last_name')
      .eq('id', teacher_id)
      .eq('role', 'teacher')
      .single()

    if (teacherError || !teacher) {
      console.error('❌ Error verificando profesor:', teacherError)
      return new Response(
        JSON.stringify({ success: false, error: 'Profesor no encontrado', details: teacherError?.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      )
    }
    console.log('✅ Profesor encontrado:', `${teacher.first_name} ${teacher.last_name}`)

    // Check if course code already exists in this classroom
    console.log(`🔍 Verificando código único: ${code} en aula ${classroom_id}`)
    const { data: existingCourse } = await supabaseClient
      .from('courses')
      .select('id')
      .eq('code', code)
      .eq('classroom_id', classroom_id)
      .single()

    if (existingCourse) {
      console.error('❌ Código de curso ya existe')
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Ya existe un curso con ese código en esta aula virtual'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 409 }
      )
    }
    console.log('✅ Código de curso disponible')

    // Prepare start date and automatic end date
    let courseStartDate = null;
    let courseEndDate = null;
    
    // Parse start_date from user input
    if (start_date && start_date.trim() !== '') {
      try {
        const startDateObj = new Date(start_date);
        if (!isNaN(startDateObj.getTime())) {
          courseStartDate = startDateObj.toISOString().split('T')[0]; // YYYY-MM-DD
        }
      } catch (e) {
        console.warn('⚠️ Fecha de inicio inválida:', start_date);
      }
    }
    
    // Auto-calculate end date (December 31st of academic year)
    const academicYearNum = parseInt(academic_year?.trim() || '2025');
    const endDateObj = new Date(academicYearNum, 11, 31); // December 31st
    courseEndDate = endDateObj.toISOString().split('T')[0];
    
    // If no start date provided, use January 15th of academic year
    if (!courseStartDate) {
      const startDateObj = new Date(academicYearNum, 0, 15); // January 15th
      courseStartDate = startDateObj.toISOString().split('T')[0];
    }
    
    console.log(`📅 Curso: ${courseStartDate} → ${courseEndDate}`);

    // Create course data
    const courseData = {
      name: name?.trim() || 'Default Course Name',
      description: description?.trim() || null,
      code: code?.trim()?.toUpperCase() || 'DEFAULT001',
      academic_year: academic_year?.trim() || '2025',
      semester: semester?.trim() || 'primer-semestre',
      teacher_id: teacher_id,
      classroom_id: classroom_id,
      start_date: courseStartDate,
      end_date: courseEndDate,
      schedule: schedule || null,
      is_active: true
    }

    console.log('💾 Insertando curso con datos:', JSON.stringify(courseData, null, 2))
    const { data: newCourse, error: courseError } = await supabaseClient
      .from('courses')
      .insert([courseData])
      .select(`
        *,
        teacher:profiles!courses_teacher_id_fkey(first_name, last_name, email),
        classroom:virtual_classrooms!courses_classroom_id_fkey(name, grade, education_level)
      `)
      .single()

    if (courseError) {
      console.error('❌ Error al crear curso:', courseError)
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Error al crear el curso',
          details: courseError.message 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    console.log(`✅ Curso creado: ${newCourse.id}`)
    console.log(`📊 Las semanas se generarán automáticamente mediante el trigger de base de datos`)

    // Prepare response message
    const message = 'Curso creado exitosamente'

    return new Response(
      JSON.stringify({
        success: true,
        data: newCourse,
        message: message
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 201 }
    )

  } catch (error) {
    console.error('💥 Error general en create-course:', error)
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Error interno del servidor',
        details: error instanceof Error ? error.message : 'Error desconocido',
        timestamp: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})