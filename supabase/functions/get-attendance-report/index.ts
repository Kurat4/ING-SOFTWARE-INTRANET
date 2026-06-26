import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // 1. Manejo de CORS (Pre-flight)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 2. Verificar Autenticación (¿Quién llama?)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Falta el header de autorización');

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (!user || userError) throw new Error('Usuario no autorizado');

    // 3. Cliente ADMIN (Service Role) - Para saltar RLS y leer todo
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 4. Verificar Rol de Admin
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (!profile || profile.role !== 'admin') {
      throw new Error('No tiene permisos de administrador para generar reportes');
    }

    // 5. Leer parámetros
    const url = new URL(req.url);
    const course_id = url.searchParams.get('course_id');
    const date = url.searchParams.get('date');

    if (!course_id || !date) throw new Error('Faltan parámetros: course_id y date');

    console.log(`📊 Generando reporte Admin - Curso: ${course_id}, Fecha: ${date}`);

    // 6. Obtener datos del curso
    const { data: courseData, error: courseError } = await supabaseAdmin
      .from('courses')
      .select('id, name, code')
      .eq('id', course_id)
      .single();

    if (courseError) throw courseError;

    // 7. Obtener estudiantes matriculados (CORREGIDO: course_enrollments)
    // Nota: Usamos la relación con profiles. Si falla la foreign key, prueba quitar el !...fkey
    const { data: enrolledStudents, error: enrollError } = await supabaseAdmin
      .from('course_enrollments') // <--- AQUÍ ESTABA EL ERROR (antes decía 'enrollments')
      .select(`
        student_id,
        student:profiles!course_enrollments_student_id_fkey(
          id,
          first_name,
          last_name,
          email,
          phone
        )
      `)
      .eq('course_id', course_id);

    if (enrollError) {
      console.error('Error fetching enrollments:', enrollError);
      throw new Error('Error al obtener estudiantes: ' + enrollError.message);
    }

    // 8. Obtener registros de asistencia
    const { data: attendanceData, error: attendanceError } = await supabaseAdmin
      .from('attendance')
      .select('student_id, status, notes, created_at')
      .eq('course_id', course_id)
      .eq('date', date);

    if (attendanceError) throw attendanceError;

    // 9. Procesar datos (Cruzar Estudiantes vs Asistencia)
    const attendanceMap = new Map();
    attendanceData?.forEach(record => attendanceMap.set(record.student_id, record));

    const report = [];
    const absentStudents = [];

    // Estadísticas
    let presentCount = 0;
    let absentCount = 0;
    let lateCount = 0;
    let justifiedCount = 0; // Cambiado de 'excused' a 'justified' según tu schema anterior
    let notRecordedCount = 0;

    if (enrolledStudents) {
      for (const enrollment of enrolledStudents) {
        // @ts-ignore
        const student = enrollment.student; 
        if (!student) continue;

        const record = attendanceMap.get(student.id);
        const status = record?.status || 'not_recorded';

        // Conteo
        if (status === 'present') presentCount++;
        else if (status === 'absent') absentCount++;
        else if (status === 'late') lateCount++;
        else if (status === 'justified') justifiedCount++;
        else notRecordedCount++;

        const studentReport = {
          student_id: student.id,
          first_name: student.first_name,
          last_name: student.last_name,
          email: student.email,
          phone: student.phone || null,
          status: status,
          notes: record?.notes || null,
          recorded_at: record?.created_at || null
        };

        report.push(studentReport);

        if (status === 'absent' || status === 'not_recorded') {
          absentStudents.push(studentReport);
        }
      }
    }

    const response = {
      course: courseData,
      date: date,
      statistics: {
        total_students: report.length,
        present: presentCount,
        absent: absentCount,
        late: lateCount,
        justified: justifiedCount,
        not_recorded: notRecordedCount
      },
      all_students: report,
      absent_students: absentStudents
    };

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Error fatal:', error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});