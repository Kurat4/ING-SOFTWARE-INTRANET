import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  console.log('🔍 DEBUG: Método:', req.method)
  console.log('🔍 DEBUG: Headers:', Object.fromEntries(req.headers.entries()))

  try {
    let body;
    try {
      const bodyText = await req.text()
      console.log('🔍 DEBUG: Body raw:', bodyText)
      body = JSON.parse(bodyText)
      console.log('🔍 DEBUG: Body parsed:', body)
    } catch (parseError) {
      console.error('❌ Error parsing JSON:', parseError)
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'JSON inválido en el body de la petición',
          details: parseError instanceof Error ? parseError.message : 'Error desconocido'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Validate required fields
    const { name, code, academic_year, semester, teacher_id, classroom_id } = body

    console.log('🔍 DEBUG: Campos extraídos:', {
      name, code, academic_year, semester, teacher_id, classroom_id
    })

    if (!name || !code || !academic_year || !semester || !teacher_id || !classroom_id) {
      const missing = []
      if (!name) missing.push('name')
      if (!code) missing.push('code') 
      if (!academic_year) missing.push('academic_year')
      if (!semester) missing.push('semester')
      if (!teacher_id) missing.push('teacher_id')
      if (!classroom_id) missing.push('classroom_id')

      console.error('❌ Campos faltantes:', missing)
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Campos requeridos faltantes: ' + missing.join(', '),
          missing_fields: missing
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // If we get here, all fields are present
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Validación exitosa - todos los campos están presentes',
        received_data: body
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error) {
    console.error('💥 Error general:', error)
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Error interno del servidor',
        details: error instanceof Error ? error.message : 'Error desconocido'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})