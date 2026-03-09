import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface CancellationEmailPayload {
  to_email: string;
  user_name: string;
  service_title: string;
  date: string;
  time: string;
  duration_hours: number;
  credits_refunded?: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    const payload: CancellationEmailPayload = await req.json();
    const { to_email, user_name, service_title, date, time, duration_hours, credits_refunded } = payload;

    if (!to_email || !service_title) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const html = buildCancellationHtml({
      user_name: user_name || "there",
      service_title,
      date: date || "N/A",
      time: time || "N/A",
      duration_hours: duration_hours || 0,
      credits_refunded: credits_refunded || 0,
    });

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Rhozeland Studio <onboarding@resend.dev>",
        to: [to_email],
        subject: `❌ Booking Cancelled: ${service_title}`,
        html,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("Resend error:", JSON.stringify(data));
      throw new Error(data?.message || "Failed to send email");
    }

    return new Response(
      JSON.stringify({ success: true, email_id: data.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Cancellation email error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function buildCancellationHtml(data: {
  user_name: string;
  service_title: string;
  date: string;
  time: string;
  duration_hours: number;
}) {
  const destructive = "hsl(0, 72%, 55%)";
  const destructiveLight = "hsl(0, 72%, 95%)";
  const foreground = "hsl(0, 0%, 8%)";
  const muted = "hsl(0, 0%, 45%)";
  const primaryColor = "hsl(175, 60%, 55%)";
  const bg = "#ffffff";
  const cardBg = "#f9fafb";
  const borderColor = "#e5e5e5";

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Booking Cancelled</title>
</head>
<body style="margin:0;padding:0;background-color:${bg};font-family:'Inter','Helvetica Neue',Arial,sans-serif;color:${foreground};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${bg};">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
          
          <!-- Header -->
          <tr>
            <td style="text-align:center;padding-bottom:32px;">
              <div style="display:inline-block;background:linear-gradient(135deg,${primaryColor},hsl(310,60%,75%));border-radius:12px;padding:12px 24px;">
                <span style="font-size:20px;font-weight:700;color:#fff;letter-spacing:-0.5px;">Rhozeland</span>
              </div>
            </td>
          </tr>

          <!-- X Icon -->
          <tr>
            <td style="text-align:center;padding-bottom:16px;">
              <div style="display:inline-block;width:56px;height:56px;border-radius:50%;background:${destructiveLight};line-height:56px;text-align:center;">
                <span style="font-size:28px;color:${destructive};">✕</span>
              </div>
            </td>
          </tr>

          <!-- Title -->
          <tr>
            <td style="text-align:center;padding-bottom:8px;">
              <h1 style="margin:0;font-size:24px;font-weight:700;color:${foreground};letter-spacing:-0.5px;">
                Booking Cancelled
              </h1>
            </td>
          </tr>
          <tr>
            <td style="text-align:center;padding-bottom:32px;">
              <p style="margin:0;font-size:15px;color:${muted};">
                Hey ${data.user_name}, your session has been cancelled.
              </p>
            </td>
          </tr>

          <!-- Details Card -->
          <tr>
            <td>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${cardBg};border:1px solid ${borderColor};border-radius:12px;overflow:hidden;">
                <tr>
                  <td style="padding:20px 24px;border-bottom:1px solid ${borderColor};">
                    <p style="margin:0 0 4px;font-size:12px;color:${muted};text-transform:uppercase;letter-spacing:0.5px;">Service</p>
                    <p style="margin:0;font-size:16px;font-weight:600;color:${foreground};text-decoration:line-through;opacity:0.7;">${data.service_title}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px 24px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td width="33%">
                          <p style="margin:0 0 4px;font-size:12px;color:${muted};text-transform:uppercase;letter-spacing:0.5px;">📅 Date</p>
                          <p style="margin:0;font-size:15px;font-weight:500;color:${foreground};">${data.date}</p>
                        </td>
                        <td width="33%">
                          <p style="margin:0 0 4px;font-size:12px;color:${muted};text-transform:uppercase;letter-spacing:0.5px;">🕐 Time</p>
                          <p style="margin:0;font-size:15px;font-weight:500;color:${foreground};">${data.time}</p>
                        </td>
                        <td width="33%">
                          <p style="margin:0 0 4px;font-size:12px;color:${muted};text-transform:uppercase;letter-spacing:0.5px;">⏱ Duration</p>
                          <p style="margin:0;font-size:15px;font-weight:500;color:${foreground};">${data.duration_hours}h</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td style="padding-top:28px;text-align:center;">
              <a href="https://rhozeland.com/services" style="display:inline-block;background:${primaryColor};color:#fff;font-size:14px;font-weight:600;padding:12px 32px;border-radius:8px;text-decoration:none;">
                Rebook a Session
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding-top:40px;text-align:center;">
              <p style="margin:0;font-size:12px;color:${muted};">
                If this was a mistake, you can rebook anytime from the services page.
              </p>
              <p style="margin:8px 0 0;font-size:11px;color:#ccc;">
                © ${new Date().getFullYear()} Rhozeland Studio. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
