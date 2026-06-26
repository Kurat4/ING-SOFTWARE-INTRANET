import {serve} from 'https://deno.land/std@0.177.0/http/server.ts'
import {createClient} from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', {headers: corsHeaders})
  }
  if (!['GET', 'POST', 'DELETE','PUT'].includes(req.method)) {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Método no permitido. Solo se permite GET, POST, DELETE y PUT.',
      }),
      {headers: {...corsHeaders, 'Content-Type': 'application/json'}, status: 405}
    )
  }

  try {
    // Get the Supabase client con service role para operaciones admin
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? '',
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ''
    )

    // Log para debugging
    console.log('📨 Request recibido:', req.method);
    console.log('📨 Headers:', Object.fromEntries(req.headers.entries()));


    // Handle GET requests - Obtener estudiantes
    if (req.method === 'GET') {
      console.log('🔍 Obteniendo estudiantes...')
      
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'student')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('❌ Error al obtener estudiantes:', error)
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Error al obtener estudiantes',
            details: error.message 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        )
      }

      console.log(`✅ Estudiantes obtenidos: ${data?.length || 0}`)
      return new Response(
        JSON.stringify({
          success: true,
          data: data || [],
          count: data?.length || 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // Handle POST requests - Crear estudiante(s) y asociarlo a aulas virtuales
    if (req.method === 'POST') {
      console.log('➕ Procesando solicitud POST...')
      
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

      // Handle bulk import from Excel (or single student creation without courseId)
      if (body.students && Array.isArray(body.students)) {
        const { students, courseId } = body;
        console.log(`📊 Procesando ${students.length} estudiante(s)${courseId ? ` al curso: ${courseId}` : ' (sin matrícula a curso)'}`);

        const results = {
          success: [],
          errors: []
        };

        // Normalizar los datos: convertir de camelCase a snake_case si es necesario
        // Los campos opcionales usan null en lugar de string vacío para evitar errores en BD
        const norm = (v: any) => (v === '' || v === undefined ? null : v);
        const normalizedStudents = students.map((student: any) => ({
          first_name: norm(student.first_name || student.firstName),
          paternal_surname: norm(student.paternal_surname || student.paternalSurname),
          maternal_surname: norm(student.maternal_surname || student.maternalSurname),
          document_type: norm(student.document_type || student.documentType) || 'DNI',
          document_number: norm(student.document_number || student.documentNumber),
          student_code: norm(student.student_code || student.studentCode),
          email: norm(student.email),
          gender: norm(student.gender),
          birth_date: norm(student.birth_date || student.birthDate),
          phone: norm(student.phone),
          country: norm(student.country),
          education_level: norm(student.education_level || student.educationLevel),
        }));

        for (const studentData of normalizedStudents) {
          try {
            // Usar el email proporcionado en los datos del estudiante
            const email = studentData.email;
            const password = studentData.student_code || 'Temporal123';
            
            if (!email) {
              console.error(`❌ Email no proporcionado para: ${studentData.student_code}`);
              results.errors.push({ 
                student_code: studentData.student_code, 
                error: 'Email es requerido' 
              });
              continue;
            }
            
            console.log(`📝 Procesando: ${studentData.student_code} - ${studentData.first_name} (${email})`);

            // Paso 1: Verificar si existe el perfil (primero por DNI, luego por código)
            let existingProfile = null;
            
            // Buscar por DNI primero
            if (studentData.document_number) {
              const { data: profileByDNI } = await supabase
                .from('profiles')
                .select('id, user_id, email, student_code')
                .eq('document_number', studentData.document_number)
                .eq('role', 'student')
                .single();
              
              if (profileByDNI) {
                existingProfile = profileByDNI;
                console.log(`🔍 Estudiante encontrado por DNI: ${studentData.document_number}`);
              }
            }
            
            // Si no se encontró por DNI, buscar por student_code
            if (!existingProfile && studentData.student_code) {
              const { data: profileByCode } = await supabase
                .from('profiles')
                .select('id, user_id, email, student_code')
                .eq('student_code', studentData.student_code)
                .eq('role', 'student')
                .single();
              
              if (profileByCode) {
                existingProfile = profileByCode;
                console.log(`🔍 Estudiante encontrado por código: ${studentData.student_code}`);
              }
            }

            let profileId: string;

            if (existingProfile) {
              console.log(`✏️ Estudiante existe, actualizando: ${studentData.student_code}`);
              profileId = existingProfile.id;
              
              // Actualizar perfil con todos los datos del Excel + nuevas columnas
              const { error: updateError } = await supabase
                .from('profiles')
                .update({
                  first_name: studentData.first_name,
                  last_name: `${studentData.paternal_surname} ${studentData.maternal_surname}`.trim(),
                  paternal_surname: studentData.paternal_surname,
                  maternal_surname: studentData.maternal_surname,
                  document_type: studentData.document_type,
                  document_number: studentData.document_number,
                  gender: studentData.gender,
                  birth_date: studentData.birth_date,
                  student_code: studentData.student_code,
                  phone: studentData.phone,
                  country: studentData.country || 'Perú',
                  education_level: studentData.education_level,
                  is_active: true,
                })
                .eq('id', profileId);

              if (updateError) {
                console.error(`❌ Error actualizando: ${studentData.student_code}`, updateError);
                results.errors.push({ 
                  student_code: studentData.student_code, 
                  error: `Error al actualizar: ${updateError.message}` 
                });
                continue;
              }
              
              console.log(`✅ Perfil actualizado: ${studentData.student_code}`);
            } else {
              // Paso 2: Crear nuevo usuario en auth
              console.log(`🆕 Creando nuevo usuario: ${email}`);
              
              const { data: authData, error: authError } = await supabase.auth.admin.createUser({
                email,
                password,
                email_confirm: true,
                user_metadata: {
                  first_name: studentData.first_name,
                  last_name: `${studentData.paternal_surname} ${studentData.maternal_surname}`.trim(),
                }
              });

              if (authError) {
                // Si el usuario ya existe en auth, buscar su profile
                if (authError.message.includes('already') || authError.message.includes('exists')) {
                  console.log(`ℹ️ Usuario auth existe, buscando profile por email: ${email}`);
                  
                  const { data: profileByEmail } = await supabase
                    .from('profiles')
                    .select('id')
                    .eq('email', email)
                    .single();
                  
                  if (profileByEmail) {
                    profileId = profileByEmail.id;
                    
                    // Actualizar el profile con los datos del Excel
                    const { error: updateError } = await supabase
                      .from('profiles')
                      .update({
                        first_name: studentData.first_name,
                        last_name: `${studentData.paternal_surname} ${studentData.maternal_surname}`.trim(),
                        paternal_surname: studentData.paternal_surname,
                        maternal_surname: studentData.maternal_surname,
                        document_type: studentData.document_type,
                        document_number: studentData.document_number,
                        gender: studentData.gender,
                        birth_date: studentData.birth_date,
                        student_code: studentData.student_code,
                        phone: studentData.phone,
                        country: studentData.country || 'Perú',
                        education_level: studentData.education_level,
                        is_active: true,
                      })
                      .eq('id', profileId);
                    
                    if (updateError) {
                      console.error(`❌ Error actualizando profile existente: ${studentData.student_code}`, updateError);
                      results.errors.push({ 
                        student_code: studentData.student_code, 
                        error: `Error al actualizar: ${updateError.message}` 
                      });
                      continue;
                    }
                    
                    console.log(`✅ Profile existente actualizado: ${studentData.student_code}`);
                  } else {
                    console.error(`❌ No se encontró profile para email: ${email}`);
                    results.errors.push({ 
                      student_code: studentData.student_code, 
                      error: 'Usuario auth existe pero no tiene profile' 
                    });
                    continue;
                  }
                } else {
                  console.error(`❌ Error creando usuario auth: ${studentData.student_code}`, authError);
                  results.errors.push({ 
                    student_code: studentData.student_code, 
                    error: `Error de autenticación: ${authError.message}` 
                  });
                  continue;
                }
              } else {
                // Usuario creado exitosamente
                console.log(`✅ Usuario auth creado: ${email}, user_id: ${authData.user.id}`);
                
                // Paso 3: Esperar un momento para que el trigger cree el profile básico
                await new Promise(resolve => setTimeout(resolve, 500));
                
                // Buscar el profile creado por el trigger
                const { data: triggeredProfile } = await supabase
                  .from('profiles')
                  .select('id')
                  .eq('user_id', authData.user.id)
                  .single();
                
                if (triggeredProfile) {
                  profileId = triggeredProfile.id;
                  console.log(`📋 Profile del trigger encontrado: ${profileId}`);
                  
                  // Actualizar con todos los datos del Excel
                  const { error: updateError } = await supabase
                    .from('profiles')
                    .update({
                      first_name: studentData.first_name,
                      last_name: `${studentData.paternal_surname} ${studentData.maternal_surname}`.trim(),
                      paternal_surname: studentData.paternal_surname,
                      maternal_surname: studentData.maternal_surname,
                      document_type: studentData.document_type,
                      document_number: studentData.document_number,
                      gender: studentData.gender,
                      birth_date: studentData.birth_date,
                      student_code: studentData.student_code,
                      phone: studentData.phone,
                      email: email,
                      role: 'student',
                      country: studentData.country || 'Perú',
                      education_level: studentData.education_level,
                      is_active: true,
                    })
                    .eq('id', profileId);
                  
                  if (updateError) {
                    console.error(`❌ Error actualizando profile del trigger: ${studentData.student_code}`, updateError);
                    results.errors.push({ 
                      student_code: studentData.student_code, 
                      error: `Error al actualizar profile: ${updateError.message}` 
                    });
                    continue;
                  }
                  
                  console.log(`✅ Profile actualizado con datos del Excel: ${studentData.student_code}`);
                } else {
                  console.error(`❌ No se encontró el profile creado por trigger para: ${studentData.student_code}`);
                  results.errors.push({ 
                    student_code: studentData.student_code, 
                    error: 'Profile no creado por trigger' 
                  });
                  continue;
                }
              }
            }

            // Inscribir en el curso (evitando duplicados)
            let enrolled = false;
            if (courseId) {
              console.log(`📚 Inscribiendo en curso ${courseId}...`);
              
              // Verificar si ya está inscrito
              const { data: existingEnrollment } = await supabase
                .from('course_enrollments')
                .select('id')
                .eq('student_id', profileId)
                .eq('course_id', courseId)
                .single();

              if (!existingEnrollment) {
                const { error: enrollError } = await supabase
                  .from('course_enrollments')
                  .insert({
                    student_id: profileId,
                    course_id: courseId,
                  });

                if (enrollError) {
                  console.error(`⚠️ Error inscribiendo en curso ${courseId}:`, enrollError);
                } else {
                  enrolled = true;
                  console.log(`✅ Inscrito en curso ${courseId}`);
                }
              } else {
                console.log(`ℹ️ Ya inscrito en curso ${courseId}`);
                enrolled = false; // Ya estaba inscrito
              }
            }

            const message = existingProfile 
              ? (enrolled ? 'Actualizado y matriculado' : 'Actualizado (ya matriculado)')
              : (enrolled ? 'Creado y matriculado' : 'Creado');
            
            results.success.push({
              student_code: studentData.student_code,
              message: message
            });
            
            console.log(`✅ ${studentData.student_code}: ${message}`);
          } catch (error) {
            console.error(`❌ Error processing ${studentData.student_code}:`, error);
            results.errors.push({ student_code: studentData.student_code, error: String(error) });
          }
        }

        const successStudents = results.success.length;
        const existingStudents = results.success.filter(s => s.message.includes('Actualizado')).length;
        const newStudents = results.success.filter(s => s.message.includes('Creado')).length;
        
        return new Response(
          JSON.stringify({
            success: true,
            message: `Procesados: ${successStudents} estudiantes (${newStudents} nuevos, ${existingStudents} existentes), ${results.errors.length} errores`,
            results,
            summary: {
              total: students.length,
              new: newStudents,
              existing: existingStudents,
              errors: results.errors.length
            }
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      // Handle single student creation
      const { first_name, last_name, email, role, user_id, virtual_classroom_ids, course_ids } = body

      // Validar campos requeridos
      if (!first_name || !last_name || !email || !role) {
        return new Response(
          JSON.stringify({ 
            success: false,
            error: 'Campos requeridos: first_name, last_name, email, role'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
      }

      // Validar que el role sea válido
      const validRoles = ['student', 'teacher', 'admin']
      if (!validRoles.includes(role.trim())) {
        return new Response(
          JSON.stringify({ 
            success: false,
            error: 'Role debe ser: student, teacher o admin'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
      }

      const profileData = {
        first_name: first_name.trim(),
        last_name: last_name.trim(),
        email: email.trim().toLowerCase(),
        role: role.trim(),
        user_id: user_id || null,
        is_active: true
      }

      // Crear el estudiante
      const { data: studentData, error: studentError } = await supabase
        .from('profiles')
        .insert([profileData])
        .select()
        .single()

      if (studentError) {
        console.error('❌ Error al crear estudiante:', studentError)
        
        if (studentError.code === '23505') { // Unique constraint violation
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: 'Ya existe un perfil con ese email',
              details: 'El email debe ser único'
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 409 }
          )
        }

        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Error al crear estudiante',
            details: studentError.message 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        )
      }

      console.log(`✅ Estudiante creado: ${studentData?.id}`)

      // Asociar estudiante a aulas virtuales si se especifican
      let enrollmentResults = []
      if (role.trim() === 'student' && (virtual_classroom_ids || course_ids)) {
        try {
          // Si se especifican aulas virtuales, obtener todos sus cursos
          if (virtual_classroom_ids && Array.isArray(virtual_classroom_ids) && virtual_classroom_ids.length > 0) {
            console.log(`🔗 Asociando estudiante a ${virtual_classroom_ids.length} aulas virtuales...`)
            
            const { data: classroomCourses, error: coursesError } = await supabase
              .from('courses')
              .select('id, name, classroom_id')
              .in('classroom_id', virtual_classroom_ids)
              .eq('is_active', true)

            if (coursesError) {
              console.error('❌ Error al obtener cursos de aulas virtuales:', coursesError)
            } else if (classroomCourses && classroomCourses.length > 0) {
              // Inscribir estudiante en todos los cursos de las aulas especificadas
              const enrollmentData = classroomCourses.map(course => ({
                student_id: studentData.id,
                course_id: course.id,
                enrolled_at: new Date().toISOString()
              }))

              const { data: enrollments, error: enrollmentError } = await supabase
                .from('course_enrollments')
                .insert(enrollmentData)
                .select('*, course:courses(name, classroom_id)')

              if (enrollmentError) {
                console.error('❌ Error al inscribir en cursos de aulas virtuales:', enrollmentError)
              } else {
                enrollmentResults.push(...(enrollments || []))
                console.log(`✅ Estudiante inscrito en ${enrollments?.length || 0} cursos de aulas virtuales`)
              }
            }
          }

          // Si se especifican cursos específicos adicionales
          if (course_ids && Array.isArray(course_ids) && course_ids.length > 0) {
            console.log(`🔗 Asociando estudiante a ${course_ids.length} cursos específicos...`)
            
            // Verificar que los cursos existen
            const { data: existingCourses, error: verifyError } = await supabase
              .from('courses')
              .select('id, name, classroom_id')
              .in('id', course_ids)
              .eq('is_active', true)

            if (verifyError) {
              console.error('❌ Error al verificar cursos:', verifyError)
            } else if (existingCourses && existingCourses.length > 0) {
              // Filtrar cursos que no fueron inscritos previamente
              const existingEnrollmentCourses = enrollmentResults.map(e => e.course_id)
              const newCourseIds = existingCourses
                .filter(course => !existingEnrollmentCourses.includes(course.id))
                .map(course => course.id)

              if (newCourseIds.length > 0) {
                const enrollmentData = newCourseIds.map(courseId => ({
                  student_id: studentData.id,
                  course_id: courseId,
                  enrolled_at: new Date().toISOString()
                }))

                const { data: additionalEnrollments, error: additionalError } = await supabase
                  .from('course_enrollments')
                  .insert(enrollmentData)
                  .select('*, course:courses(name, classroom_id)')

                if (additionalError) {
                  console.error('❌ Error al inscribir en cursos específicos:', additionalError)
                } else {
                  enrollmentResults.push(...(additionalEnrollments || []))
                  console.log(`✅ Estudiante inscrito en ${additionalEnrollments?.length || 0} cursos específicos adicionales`)
                }
              }
            }
          }
        } catch (associationError) {
          console.error('❌ Error en proceso de asociación:', associationError)
          // No retornamos error aquí porque el estudiante ya fue creado exitosamente
        }
      }

      // Preparar respuesta con información de inscripciones
      const responseData = {
        student: studentData,
        enrollments: enrollmentResults,
        summary: {
          total_enrollments: enrollmentResults.length,
          virtual_classrooms_associated: virtual_classroom_ids?.length || 0,
          specific_courses_associated: course_ids?.length || 0
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          data: responseData,
          message: `Estudiante creado exitosamente${enrollmentResults.length > 0 ? ` e inscrito en ${enrollmentResults.length} curso${enrollmentResults.length !== 1 ? 's' : ''}` : ''}`
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 201 }
      )
    }

    // Handle PUT requests - Actualizar estudiante
    if (req.method === 'PUT') {
      console.log('✏️ Actualizando estudiante...')
      
      const url = new URL(req.url)
      const id = url.searchParams.get('id')
      
      if (!id) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'ID del estudiante es requerido en los parámetros de la URL'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
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

      const updateData: any = {}
      if ((body as any).first_name) updateData.first_name = (body as any).first_name.trim()
      if ((body as any).last_name) updateData.last_name = (body as any).last_name.trim()
      if ((body as any).email) updateData.email = (body as any).email.trim().toLowerCase()
      if ((body as any).role) updateData.role = (body as any).role.trim()
      if ((body as any).is_active !== undefined) updateData.is_active = (body as any).is_active

      if (Object.keys(updateData).length === 0) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'No hay datos para actualizar'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
      }

      updateData.updated_at = new Date().toISOString()

      const { data, error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', id)
        .select()
        .single()

      if (error) {
        console.error('❌ Error al actualizar estudiante:', error)
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Error al actualizar estudiante',
            details: error.message 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        )
      }

      if (!data) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Estudiante no encontrado'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
        )
      }

      console.log(`✅ Estudiante actualizado: ${data.id}`)
      return new Response(
        JSON.stringify({
          success: true,
          data: data,
          message: 'Estudiante actualizado exitosamente'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // Handle DELETE requests - Eliminar estudiante
    if (req.method === 'DELETE') {
      console.log('🗑️ Eliminando estudiante...')
      
      const url = new URL(req.url)
      const id = url.searchParams.get('id')
      
      if (!id) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'ID del estudiante es requerido en los parámetros de la URL'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
      }

      const { data, error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', id)
        .select()
        .single()

      if (error) {
        console.error('❌ Error al eliminar estudiante:', error)
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Error al eliminar estudiante',
            details: error.message 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        )
      }

      if (!data) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Estudiante no encontrado'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
        )
      }

      console.log(`✅ Estudiante eliminado: ${data.id}`)
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Estudiante eliminado exitosamente',
          data: data
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // Fallback - método no implementado
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Método no implementado'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 501 }
    )

  } catch (error) {
    console.error('💥 Error general en crud-estudiantes:', error)
    
    if (error instanceof SyntaxError) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Error de sintaxis en la petición',
          details: error.message
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

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
