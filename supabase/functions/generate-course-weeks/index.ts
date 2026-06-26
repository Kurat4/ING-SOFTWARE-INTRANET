import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { courseId, startDate, endDate } = await req.json();

    if (!courseId || !startDate || !endDate) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Generando semanas para curso ${courseId} desde ${startDate} hasta ${endDate}`);

    // Calculate the number of weeks between start and end date
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const weekCount = Math.ceil(diffDays / 7);

    console.log(`Calculando ${weekCount} semanas para el curso`);

    // Generate weekly sections
    const weeklyUpdates = [];
    for (let week = 1; week <= weekCount; week++) {
      const weekStart = new Date(start);
      weekStart.setDate(start.getDate() + (week - 1) * 7);
      
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      
      // Don't exceed the course end date
      if (weekEnd > end) {
        weekEnd.setTime(end.getTime());
      }

      const weekData = {
        course_id: courseId,
        week_number: week,
        title: `Semana ${week}`,
        description: `Contenido para la semana ${week} del curso`,
        start_date: weekStart.toISOString().split('T')[0],
        end_date: weekEnd.toISOString().split('T')[0],
        position: week,
        is_published: false
      };

      weeklyUpdates.push(weekData);
    }

    // Insert all weekly sections
    const { data, error } = await supabase
      .from('course_weekly_sections')
      .insert(weeklyUpdates);

    if (error) {
      console.error('Error inserting weekly sections:', error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`✅ Se generaron ${weekCount} semanas exitosamente`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        weeksGenerated: weekCount,
        message: `Se generaron ${weekCount} semanas automáticamente`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generate-course-weeks function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Error desconocido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});