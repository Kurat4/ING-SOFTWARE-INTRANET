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

  try {
    // Get the Supabase client
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? '',
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ''
    )

    console.log('🔍 STEP 1: Supabase client created')

    // Get user from Authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'No auth header' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      )
    }

    console.log('🔍 STEP 2: Auth header found')

    // Verify the JWT token and get user
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)

    if (authError || !user) {
      console.error('❌ Auth error:', authError)
      return new Response(
        JSON.stringify({ success: false, error: 'Auth failed' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      )
    }

    console.log('🔍 STEP 3: User authenticated:', user.id)

    // Get user profile
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('id, role')
      .eq('user_id', user.id)
      .single()

    if (profileError || !profile) {
      console.error('❌ Profile error:', profileError)
      return new Response(
        JSON.stringify({ success: false, error: 'Profile not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      )
    }

    console.log('🔍 STEP 4: Profile found:', profile.role)

    let body;
    try {
      body = await req.json()
    } catch (parseError) {
      console.error('❌ JSON parse error:', parseError)
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid JSON' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    console.log('🔍 STEP 5: Body parsed successfully')

    // Try to insert minimal course data to isolate the problem
    const minimalCourseData = {
      name: 'Test Course',
      code: 'TEST999',
      academic_year: '2025',
      semester: 'primer-semestre',
      teacher_id: body.teacher_id,
      classroom_id: body.classroom_id,
      is_active: true
      // NO dates at all to test
    }

    console.log('🔍 STEP 6: About to insert minimal course data:', JSON.stringify(minimalCourseData, null, 2))

    const { data: newCourse, error: courseError } = await supabaseClient
      .from('courses')
      .insert([minimalCourseData])
      .select('*')
      .single()

    if (courseError) {
      console.error('❌ STEP 7: Course insertion failed:', courseError)
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Course insertion failed',
          details: courseError.message,
          code: courseError.code,
          hint: courseError.hint
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    console.log('✅ STEP 7: Course inserted successfully:', newCourse.id)

    return new Response(
      JSON.stringify({
        success: true,
        data: newCourse,
        message: 'Minimal course created successfully'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 201 }
    )

  } catch (error) {
    console.error('💥 General error:', error)
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'General error',
        details: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : 'No stack trace'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})