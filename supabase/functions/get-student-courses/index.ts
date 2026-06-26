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

  if (req.method !== 'GET') {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Método no permitido. Solo se permite GET.',
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
      .select('id, role, student_code')
      .eq('user_id', user.id)
      .single()

    if (profileError || !profile) {
      console.error('❌ Error obteniendo perfil:', profileError)
      return new Response(
        JSON.stringify({ success: false, error: 'Perfil no encontrado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      )
    }

    console.log(`🔍 Obteniendo cursos para ${profile.role}: ${profile.id}`)

    let coursesData = []

    if (profile.role === 'student') {
      // For students: get modules they are enrolled in via course_enrollments
      // Cada registro en course_enrollments representa un módulo individual
      const { data, error } = await supabaseClient
        .from('course_enrollments')
        .select(`
          enrolled_at,
          modulo_id,
          modulo:modulos!course_enrollments_modulo_id_fkey (
            id,
            name,
            code,
            start_date,
            end_date,
            teacher_principal_id,
            course_id,
            course:courses (
              id,
              name,
              code,
              academic_year,
              semester,
              program:programas (
                id,
                name
              )
            ),
            teacher:profiles!modulos_teacher_principal_id_fkey (
              id,
              first_name,
              last_name,
              email
            )
          )
        `)
        .eq('student_id', profile.id)
        .order('enrolled_at', { ascending: false })

      if (error) {
        console.error('❌ Error obteniendo módulos del estudiante:', error)
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Error al obtener módulos del estudiante',
            details: error.message 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        )
      }

      // Transform the data to include enrollment info from course_enrollments
      const rawItems = data?.map(enrollment => {
        const modulo = enrollment.modulo
        if (!modulo) return null
        return {
          id: modulo.id,
          name: modulo.name,
          description: `${modulo.course?.program?.name || ''} - ${modulo.course?.name || ''}`,
          code: modulo.code,
          academic_year: modulo.course?.academic_year,
          semester: modulo.course?.semester,
          is_active: true,
          created_at: modulo.start_date,
          teacher: modulo.teacher,
          enrolled_at: enrollment.enrolled_at,
          enrollment_status: 'enrolled',
          course_id: modulo.course_id,
          course_name: modulo.course?.name,
          program_name: modulo.course?.program?.name,
          enrollments: [{ count: 0 }]
        }
      }).filter(item => item && item.id) || []

      // Obtener conteo real de estudiantes por módulo (sin restricción RLS, usando service key)
      coursesData = await Promise.all(
        rawItems.map(async (item) => {
          const { count } = await supabaseClient
            .from('course_enrollments')
            .select('*', { count: 'exact', head: true })
            .eq('modulo_id', item.id)
          item.enrollments = [{ count: count || 0 }]
          return item
        })
      )

    } else if (profile.role === 'teacher') {
      // For teachers: get modules they teach (primary or additional)
      
      // Get ALL modules where they teach (primary or additional)
      // Using OR to check both teacher_principal_id and aditional_teachers array
      const { data: allModulos, error: modulosError } = await supabaseClient
        .from('modulos')
        .select(`
          id,
          name,
          code,
          start_date,
          end_date,
          teacher_principal_id,
          aditional_teachers,
          course_id,
          course:courses (
            id,
            name,
            code,
            academic_year,
            semester,
            program:programas (
              id,
              name
            )
          ),
          teacher:profiles!modulos_teacher_principal_id_fkey (
            id,
            first_name,
            last_name,
            email
          )
        `)
        .or(`teacher_principal_id.eq.${profile.id},aditional_teachers.cs.{${profile.id}}`)

      if (modulosError) {
        console.error('❌ Error obteniendo módulos del profesor:', modulosError)
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Error al obtener módulos del profesor',
            details: modulosError.message 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        )
      }

      const uniqueModulos = allModulos || []

      // Count enrollments for each module
      const modulesWithEnrollments = await Promise.all(
        uniqueModulos.map(async (modulo) => {
          const { count } = await supabaseClient
            .from('course_enrollments')
            .select('*', { count: 'exact', head: true })
            .eq('modulo_id', modulo.id)
          
          return {
            id: modulo.id,
            name: modulo.name,
            description: `${modulo.course?.program?.name || ''} - ${modulo.course?.name || ''}`,
            code: modulo.code,
            academic_year: modulo.course?.academic_year,
            semester: modulo.course?.semester,
            is_active: true,
            created_at: modulo.start_date,
            teacher: modulo.teacher,
            enrollments: [{ count: count || 0 }],
            course_id: modulo.course_id, // ID de la edición para agrupar
            course_name: modulo.course?.name, // Nombre de la edición
            program_name: modulo.course?.program?.name // Nombre del programa
          }
        })
      )

      coursesData = modulesWithEnrollments.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )

    } else if (profile.role === 'admin') {
      // For admins: get all modules
      const { data, error } = await supabaseClient
        .from('modulos')
        .select(`
          id,
          name,
          code,
          start_date,
          end_date,
          teacher_principal_id,
          course_id,
          course:courses (
            id,
            name,
            code,
            academic_year,
            semester,
            program:programas (
              id,
              name
            )
          ),
          teacher:profiles!modulos_teacher_principal_id_fkey (
            id,
            first_name,
            last_name,
            email
          )
        `)
        .order('start_date', { ascending: false })

      if (error) {
        console.error('❌ Error obteniendo todos los módulos:', error)
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Error al obtener módulos',
            details: error.message 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        )
      }

      // Count enrollments for each module
      const modulesWithEnrollments = await Promise.all(
        (data || []).map(async (modulo) => {
          const { count } = await supabaseClient
            .from('course_enrollments')
            .select('*', { count: 'exact', head: true })
            .eq('modulo_id', modulo.id)
          
          return {
            id: modulo.id,
            name: modulo.name,
            description: `${modulo.course?.program?.name || ''} - ${modulo.course?.name || ''}`,
            code: modulo.code,
            academic_year: modulo.course?.academic_year,
            semester: modulo.course?.semester,
            is_active: true,
            created_at: modulo.start_date,
            teacher: modulo.teacher,
            enrollments: [{ count: count || 0 }],
            course_id: modulo.course_id,
            course_name: modulo.course?.name,
            program_name: modulo.course?.program?.name
          }
        })
      )
      
      coursesData = modulesWithEnrollments
    } else if (profile.role === 'tutor') {
      // For tutors: return empty array since virtual classrooms were removed
      coursesData = []
      
    } else {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Rol de usuario no válido' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      )
    }

    console.log(`✅ Cursos obtenidos para ${profile.role}: ${coursesData.length}`)

    return new Response(
      JSON.stringify({
        success: true,
        data: coursesData,
        count: coursesData.length,
        user_role: profile.role,
        message: `Cursos obtenidos exitosamente para ${profile.role}`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error) {
    console.error('💥 Error general en get-student-courses:', error)
    
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