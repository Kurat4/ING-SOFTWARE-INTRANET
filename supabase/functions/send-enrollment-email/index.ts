import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ModuloMatriculado {
  modulo_id: string;
  nombre: string;
  code: string;
  course_id?: string;
  course_name?: string;
  course_code?: string;
  start_date?: string;
  end_date?: string;
}

interface EnrollmentEmailRequest {
  student_id: string;
  cod_matricula: string;
  modulos_matriculados: ModuloMatriculado[];
  precio_final: number;
  moneda: string;
}

function formatDateEs(dateStr?: string): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("es-PE", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "America/Lima",
  });
}

function buildHtmlEmail(
  studentName: string,
  email: string,
  password: string,
  studentCode: string,
  codMatricula: string,
  modulos: ModuloMatriculado[],
  precioFinal: number,
  moneda: string,
  loginUrl: string
): string {
  // Paleta PERI Institute (del design system del intranet)
  // Navy Blue: #2B3F5C  |  Magenta: #C9438C  |  Yellow: #FFD900
  const navy         = "#2B3F5C";
  const navyDark     = "#1e2e43";
  const magenta      = "#C9438C";
  const magentaLight = "#f5d0e8";
  const yellow       = "#FFD900";
  const yellowLight  = "#fffbe6";
  const bgPage       = "#eef0f4";
  const bgCard       = "#ffffff";
  const textPrimary  = "#2B3F5C";
  const textMuted    = "#627088";
  const borderColor  = "#d8dde6";

  // Agrupar módulos por edición (course)
  const porEdicion: Record<string, ModuloMatriculado[]> = {};
  for (const m of modulos) {
    const key = m.course_name ?? "Curso";
    if (!porEdicion[key]) porEdicion[key] = [];
    porEdicion[key].push(m);
  }

  const edicionesHtml = Object.entries(porEdicion)
    .map(([edicion, mods]) => {
      const filas = mods
        .map(
          (m) => `
          <tr>
            <td style="padding:10px 14px;border-bottom:1px solid ${borderColor};font-size:14px;color:${textPrimary};">
              ${m.nombre}
            </td>
            <td style="padding:10px 14px;border-bottom:1px solid ${borderColor};font-size:13px;color:${textMuted};text-align:center;">
              ${m.code}
            </td>
            <td style="padding:10px 14px;border-bottom:1px solid ${borderColor};font-size:13px;color:${textMuted};text-align:center;">
              ${formatDateEs(m.start_date)}
            </td>
            <td style="padding:10px 14px;border-bottom:1px solid ${borderColor};font-size:13px;color:${textMuted};text-align:center;">
              ${formatDateEs(m.end_date)}
            </td>
          </tr>`
        )
        .join("");

      return `
        <div style="margin-bottom:24px;">
          <div style="background:${magentaLight};border-left:4px solid ${magenta};padding:10px 16px;border-radius:4px;margin-bottom:12px;">
            <span style="font-weight:700;color:${magenta};font-size:15px;">&#128218; ${edicion}</span>
          </div>
          <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid ${borderColor};border-radius:8px;overflow:hidden;">
            <thead>
              <tr style="background:${bgPage};">
                <th style="padding:10px 14px;text-align:left;font-size:13px;color:${textPrimary};font-weight:600;">Módulo</th>
                <th style="padding:10px 14px;text-align:center;font-size:13px;color:${textPrimary};font-weight:600;">Código</th>
                <th style="padding:10px 14px;text-align:center;font-size:13px;color:${textPrimary};font-weight:600;">Inicio</th>
                <th style="padding:10px 14px;text-align:center;font-size:13px;color:${textPrimary};font-weight:600;">Fin</th>
              </tr>
            </thead>
            <tbody>${filas}</tbody>
          </table>
        </div>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>Confirmación de Matrícula</title>
</head>
<body style="margin:0;padding:0;background-color:${bgPage};font-family:'Segoe UI',Arial,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" style="background:${bgPage};padding:32px 16px;">
    <tr><td align="center">

      <!-- Tarjeta principal -->
      <table width="620" cellpadding="0" cellspacing="0" style="background:${bgCard};border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(43,63,92,.12);max-width:620px;width:100%;">

        <!-- Header navy -->
        <tr>
          <td style="background:linear-gradient(135deg,${navy} 0%,${navyDark} 100%);padding:0;">
            <div style="height:4px;background:${yellow};"></div>
            <div style="padding:32px 40px 28px;text-align:center;">
              <p style="margin:0 0 6px;font-size:12px;color:#a8bed8;letter-spacing:3px;text-transform:uppercase;font-weight:600;">PERI INSTITUTE</p>
              <h1 style="margin:0;font-size:26px;color:#ffffff;font-weight:700;letter-spacing:-0.5px;">Confirmación de Matrícula</h1>
              <p style="margin:10px 0 0;font-size:14px;color:#a8bed8;">Tu inscripción ha sido procesada exitosamente</p>
            </div>
            <div style="height:4px;background:${magenta};"></div>
          </td>
        </tr>

        <!-- Saludo -->
        <tr>
          <td style="padding:32px 40px 0;">
            <p style="margin:0;font-size:16px;color:${textPrimary};">Hola, <strong style="color:${magenta};">${studentName}</strong> &#128075;</p>
            <p style="margin:12px 0 0;font-size:15px;color:${textMuted};line-height:1.6;">
              Nos complace confirmar tu matrícula en <strong style="color:${textPrimary};">PERI Institute</strong>.
              A continuación encontrarás los detalles de tu inscripción y tus credenciales de acceso.
            </p>
          </td>
        </tr>

        <!-- Código de matrícula y código de estudiante -->
        <tr>
          <td style="padding:24px 40px 0;">
            <div style="background:${bgPage};border:1.5px solid ${borderColor};border-radius:10px;padding:16px 20px;border-top:3px solid ${navy};">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="vertical-align:top;">
                    <p style="margin:0;font-size:11px;color:${textMuted};text-transform:uppercase;letter-spacing:1.2px;font-weight:600;">Código de matrícula</p>
                    <p style="margin:4px 0 0;font-size:22px;font-weight:800;color:${navy};letter-spacing:1px;">${codMatricula}</p>
                  </td>
                  <td style="vertical-align:top;text-align:right;">
                    <p style="margin:0;font-size:11px;color:${textMuted};text-transform:uppercase;letter-spacing:1.2px;font-weight:600;">Código de estudiante</p>
                    <p style="margin:4px 0 0;font-size:18px;font-weight:700;color:${magenta};letter-spacing:1px;">${studentCode}</p>
                  </td>
                </tr>
              </table>
            </div>
          </td>
        </tr>

        <!-- Cursos matriculados -->
        <tr>
          <td style="padding:28px 40px 0;">
            <h2 style="margin:0 0 16px;font-size:17px;color:${textPrimary};font-weight:700;border-bottom:2px solid ${borderColor};padding-bottom:10px;">
              &#128203; Cursos matriculados
            </h2>
            ${edicionesHtml}
          </td>
        </tr>

        <!-- Monto total -->
        <tr>
          <td style="padding:4px 40px 0;">
            <div style="background:${navy};border-radius:8px;padding:14px 20px;text-align:right;">
              <span style="font-size:13px;color:#a8bed8;">Precio total: </span>
              <span style="font-size:20px;font-weight:800;color:#ffffff;">${moneda} ${precioFinal.toFixed(2)}</span>
            </div>
          </td>
        </tr>

        <!-- Credenciales -->
        <tr>
          <td style="padding:28px 40px 0;">
            <h2 style="margin:0 0 16px;font-size:17px;color:${textPrimary};font-weight:700;border-bottom:2px solid ${borderColor};padding-bottom:10px;">
              &#128273; Tus credenciales de acceso
            </h2>
            <div style="background:${yellowLight};border:1.5px solid ${yellow};border-radius:10px;padding:20px 24px;border-top:3px solid ${yellow};">
              <p style="margin:0 0 14px;font-size:14px;color:${navy};font-weight:600;">
                Usa estos datos para ingresar al aula virtual:
              </p>
              <table cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td style="padding:7px 0;font-size:14px;color:${textMuted};width:150px;font-weight:500;">Código estudiante</td>
                  <td style="padding:7px 0;">
                    <code style="background:#fff;border:1px solid ${borderColor};padding:5px 12px;border-radius:6px;font-size:14px;color:${magenta};font-weight:700;">${studentCode}</code>
                  </td>
                </tr>
                <tr>
                  <td style="padding:7px 0;font-size:14px;color:${textMuted};font-weight:500;">Usuario / Email</td>
                  <td style="padding:7px 0;">
                    <code style="background:#fff;border:1px solid ${borderColor};padding:5px 12px;border-radius:6px;font-size:14px;color:${navy};font-weight:700;">${email}</code>
                  </td>
                </tr>
                <tr>
                  <td style="padding:7px 0;font-size:14px;color:${textMuted};font-weight:500;">Contraseña</td>
                  <td style="padding:7px 0;">
                    <code style="background:#fff;border:1px solid ${borderColor};padding:5px 12px;border-radius:6px;font-size:14px;color:${navy};font-weight:700;">${password}</code>
                  </td>
                </tr>
              </table>
              <p style="margin:14px 0 0;font-size:12px;color:${textMuted};">
                &#9888;&#65039; Te recomendamos cambiar tu contraseña al ingresar por primera vez.
              </p>
            </div>
          </td>
        </tr>

        <!-- Botones de acceso -->
        <tr>
          <td style="padding:28px 40px 0;text-align:center;">
            <a href="${loginUrl}" style="display:inline-block;background:linear-gradient(135deg,${magenta},#a5366f);color:#ffffff;text-decoration:none;padding:14px 44px;border-radius:8px;font-size:16px;font-weight:700;letter-spacing:0.5px;box-shadow:0 4px 14px rgba(201,67,140,0.4);margin-bottom:12px;">
              Ingresar al Intranet &rarr;
            </a>
            <br/>
            <a href="https://peri-institute.pericompanygroup.com" style="display:inline-block;background:linear-gradient(135deg,${navy},${navyDark});color:#ffffff;text-decoration:none;padding:12px 40px;border-radius:8px;font-size:15px;font-weight:600;letter-spacing:0.5px;box-shadow:0 4px 14px rgba(43,63,92,0.35);margin-top:12px;">
              &#127760; Visitar P&aacute;gina Web
            </a>
          </td>
        </tr>

        <!-- Aviso -->
        <tr>
          <td style="padding:24px 40px 0;">
            <div style="background:${bgPage};border-left:4px solid ${navy};border-radius:4px;padding:14px 18px;">
              <p style="margin:0;font-size:13px;color:${textPrimary};line-height:1.6;">
                &#128161; Si tienes alguna consulta sobre tu matr&iacute;cula, com&uacute;nicate con nosotros a trav&eacute;s de nuestros canales de soporte.
                Este correo es autom&aacute;tico y no permite respuestas directas.
                <br/><br/>
                &#128222; <strong>Soporte:</strong> <a href="https://wa.me/573234917892" style="color:${magenta};text-decoration:none;font-weight:600;">+57 323 491 7892</a>
              </p>
            </div>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:28px 40px 32px;text-align:center;">
            <div style="height:3px;background:linear-gradient(90deg,${navy},${magenta},${yellow});border-radius:2px;margin-bottom:20px;"></div>
            <p style="margin:0;font-size:13px;color:${textMuted};">
              &copy; ${new Date().getFullYear()} <strong style="color:${navy};">PERI Institute</strong>
            </p>
            <p style="margin:6px 0 0;font-size:12px;color:#a8b8cc;">
              Este correo fue enviado automáticamente. Por favor no respondas directamente.
            </p>
          </td>
        </tr>

      </table>
      <!-- / Tarjeta principal -->

    </td></tr>
  </table>
</body>
</html>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }

  try {
    // ── Autenticación ────────────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Falta el header de autorización" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "No autorizado" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    // ── Cliente admin ────────────────────────────────────────────────────────
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // ── Leer body ────────────────────────────────────────────────────────────
    const body = (await req.json()) as EnrollmentEmailRequest;
    const { student_id, cod_matricula, modulos_matriculados, precio_final, moneda } = body;

    if (!student_id || !cod_matricula || !modulos_matriculados?.length) {
      return new Response(
        JSON.stringify({ error: "student_id, cod_matricula y modulos_matriculados son requeridos" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // ── Obtener datos del estudiante ─────────────────────────────────────────
    const { data: studentProfile, error: profileErr } = await supabaseAdmin
      .from("profiles")
      .select("first_name, last_name, email, document_number, student_code")
      .eq("id", student_id)
      .single();

    if (profileErr || !studentProfile) {
      console.error("❌ No se encontró el perfil del estudiante:", profileErr?.message);
      return new Response(
        JSON.stringify({ error: "Estudiante no encontrado" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
      );
    }

    const { first_name, last_name, email: studentEmail, document_number, student_code } = studentProfile;
    const studentName = `${first_name} ${last_name}`.trim();
    const password    = student_code ?? "Tu código de estudiante";
    const studentCode = student_code ?? "—";
    const loginUrl    = Deno.env.get("APP_URL") ?? "https://intranet.peri-institute.pericompanygroup.com";

    // ── Construir HTML ───────────────────────────────────────────────────────
    const html = buildHtmlEmail(
      studentName,
      studentEmail,
      password,
      studentCode,
      cod_matricula,
      modulos_matriculados,
      precio_final ?? 0,
      moneda ?? "PEN",
      loginUrl
    );

    // ── Enviar con Resend ────────────────────────────────────────────────────
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      console.error("❌ RESEND_API_KEY no configurada");
      return new Response(
        JSON.stringify({ error: "Servicio de correo no configurado (RESEND_API_KEY faltante)" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    const fromEmail = Deno.env.get("FROM_EMAIL") ?? "onboarding@resend.dev";

    const resendPayload = {
      from: `PERI Institute <${fromEmail}>`,
      to: [studentEmail],
      subject: `Confirmación de Matrícula — ${cod_matricula}`,
      html,
    };

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(resendPayload),
    });

    const resendData = await resendRes.json();

    if (!resendRes.ok) {
      console.error("❌ Error Resend:", resendData);
      return new Response(
        JSON.stringify({ error: "Error al enviar el correo", details: resendData }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    console.log(`✅ Correo de confirmación enviado a ${studentEmail} (${cod_matricula})`);

    return new Response(
      JSON.stringify({ success: true, message: `Correo enviado a ${studentEmail}`, email_id: resendData.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );

  } catch (err: any) {
    console.error("❌ Error inesperado:", err.message);
    return new Response(
      JSON.stringify({ error: "Error interno", details: err.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
