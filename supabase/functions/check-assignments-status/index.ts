import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Starting assignment status check...');

    const now = new Date();
    const oneDayFromNow = new Date(now);
    oneDayFromNow.setDate(now.getDate() + 1);
    const twoDaysFromNow = new Date(now);
    twoDaysFromNow.setDate(now.getDate() + 2);

    // Obtener todas las tareas activas desde course_weekly_resources
    const { data: assignments, error: assignmentsError } = await supabase
      .from('course_weekly_resources')
      .select(`
        id, 
        title, 
        assignment_deadline,
        section_id,
        course_weekly_sections!inner (
          course_id
        )
      `)
      .eq('resource_type', 'assignment')
      .eq('is_published', true)
      .not('assignment_deadline', 'is', null);

    if (assignmentsError) {
      console.error('Error fetching assignments:', assignmentsError);
      throw assignmentsError;
    }

    console.log(`Found ${assignments?.length || 0} assignments to check`);

    const notificationsToCreate = [];

    for (const assignment of assignments || []) {
      const dueDate = new Date(assignment.assignment_deadline);
      const courseId = assignment.course_weekly_sections.course_id;

      // Obtener estudiantes inscritos en el curso
      const { data: enrollments, error: enrollmentsError } = await supabase
        .from('course_enrollments')
        .select('student_id')
        .eq('course_id', courseId);

      if (enrollmentsError) {
        console.error(`Error fetching enrollments for course ${courseId}:`, enrollmentsError);
        continue;
      }

      for (const enrollment of enrollments || []) {
        // Verificar si ya existe una entrega - usando assignment_id que debe referenciar la tarea
        const { data: submissions } = await supabase
          .from('assignment_submissions')
          .select('id')
          .eq('assignment_id', assignment.id)
          .eq('student_id', enrollment.student_id)
          .limit(1);

        const hasSubmission = submissions && submissions.length > 0;

        // Tarea vencida sin entrega
        if (dueDate < now && !hasSubmission) {
          // Verificar si ya existe una notificación de vencida (últimas 24 horas)
          const yesterday = new Date(now);
          yesterday.setDate(now.getDate() - 1);

          const { data: existingOverdue } = await supabase
            .from('notifications')
            .select('id')
            .eq('user_id', enrollment.student_id)
            .eq('type', 'overdue')
            .ilike('message', `%${assignment.title}%`)
            .gte('created_at', yesterday.toISOString())
            .limit(1);

          if (!existingOverdue || existingOverdue.length === 0) {
            notificationsToCreate.push({
              user_id: enrollment.student_id,
              type: 'overdue',
              message: `La tarea "${assignment.title}" está vencida y no ha sido entregada.`,
              is_read: false,
            });
          }
        }
        // Tarea próxima a vencer sin entrega
        else if (dueDate >= now && !hasSubmission) {
          const hoursLeft = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60));
          const daysLeft = Math.ceil(hoursLeft / 24);
          
          let shouldNotify = false;
          let notificationInterval = 24; // horas
          
          // Determinar si debe notificar según el tiempo restante
          if (hoursLeft <= 24) {
            // Menos de 1 día: notificar cada hora
            shouldNotify = true;
            notificationInterval = 1;
          } else if (daysLeft <= 2) {
            // Entre 1 y 2 días: notificar cada 12 horas
            shouldNotify = true;
            notificationInterval = 12;
          }
          
          if (shouldNotify) {
            // Verificar si ya existe una notificación reciente según el intervalo
            const lastNotificationTime = new Date(now);
            lastNotificationTime.setHours(now.getHours() - notificationInterval);

            const { data: existingPending } = await supabase
              .from('notifications')
              .select('id')
              .eq('user_id', enrollment.student_id)
              .eq('type', 'pending')
              .ilike('message', `%${assignment.title}%`)
              .gte('created_at', lastNotificationTime.toISOString())
              .limit(1);

            if (!existingPending || existingPending.length === 0) {
              let message;
              if (hoursLeft <= 24) {
                message = hoursLeft === 1 
                  ? `La tarea "${assignment.title}" vence en 1 hora. ¡Apúrate!`
                  : `La tarea "${assignment.title}" vence en ${hoursLeft} hora(s). No olvides entregarla.`;
              } else {
                message = `La tarea "${assignment.title}" vence en ${daysLeft} día(s). No olvides entregarla.`;
              }
              
              notificationsToCreate.push({
                user_id: enrollment.student_id,
                type: 'pending',
                message,
                is_read: false,
              });
            }
          }
        }
      }
    }

    console.log(`Creating ${notificationsToCreate.length} notifications...`);

    if (notificationsToCreate.length > 0) {
      const { error: insertError } = await supabase
        .from('notifications')
        .insert(notificationsToCreate);

      if (insertError) {
        console.error('Error inserting notifications:', insertError);
        throw insertError;
      }
    }

    console.log('Assignment status check completed successfully');

    return new Response(
      JSON.stringify({
        success: true,
        notificationsCreated: notificationsToCreate.length,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in check-assignments-status:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
