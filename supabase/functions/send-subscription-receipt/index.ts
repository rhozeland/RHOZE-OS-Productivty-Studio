import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface SubscriptionReceiptPayload {
  to_email: string;
  user_name: string;
  tier_name: string;
  credits: number;
  amount: string;
  payment_id?: string;
  subscription_start: string;
  subscription_end: string;
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

    const payload: SubscriptionReceiptPayload = await req.json();
    const { to_email, user_name, tier_name, credits, amount, payment_id, subscription_start, subscription_end } = payload;

    if (!to_email || !tier_name || !amount) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const html = buildReceiptHtml({
      user_name: user_name || "there",
      tier_name,
      credits,
      amount,
      payment_id,
      subscription_start,
      subscription_end,
    });

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Rhozeland Studio <noreply@support.rhozeland.app>",
        to: [to_email],
        subject: `🎉 Subscription Confirmed: ${tier_name} Plan`,
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
    console.error("Subscription receipt error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function buildReceiptHtml(data: {
  user_name: string;
  tier_name: string;
  credits: number;
  amount: string;
  payment_id?: string;
  subscription_start: string;
  subscription_end: string;
}) {
  const primary = "hsl(175, 60%, 55%)";
  const foreground = "hsl(0, 0%, 8%)";
  const muted = "hsl(0, 0%, 45%)";
  const bg = "#ffffff";
  const cardBg = "#f9fafb";
  const border = "#e5e5e5";

  const tierColors: Record<string, string> = {
    Bronze: "hsl(30, 55%, 55%)",
    Gold: "hsl(45, 90%, 50%)",
    Diamond: "hsl(200, 60%, 70%)",
  };
  const tierColor = tierColors[data.tier_name] || primary;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Subscription Receipt</title>
</head>
<body style="margin:0;padding:0;background-color:${bg};font-family:'Inter','Helvetica Neue',Arial,sans-serif;color:${foreground};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${bg};">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="text-align:center;padding-bottom:32px;">
              <div style="display:inline-block;background:linear-gradient(135deg,${primary},hsl(310,60%,75%));border-radius:12px;padding:12px 24px;">
                <span style="font-size:20px;font-weight:700;color:#fff;letter-spacing:-0.5px;">Rhozeland</span>
              </div>
            </td>
          </tr>

          <!-- Icon -->
          <tr>
            <td style="text-align:center;padding-bottom:16px;">
              <div style="display:inline-block;width:56px;height:56px;border-radius:50%;background:${tierColor};line-height:56px;text-align:center;">
                <span style="font-size:28px;color:#fff;">🎉</span>
              </div>
            </td>
          </tr>

          <!-- Title -->
          <tr>
            <td style="text-align:center;padding-bottom:8px;">
              <h1 style="margin:0;font-size:24px;font-weight:700;color:${foreground};letter-spacing:-0.5px;">
                Welcome to ${data.tier_name}!
              </h1>
            </td>
          </tr>
          <tr>
            <td style="text-align:center;padding-bottom:32px;">
              <p style="margin:0;font-size:15px;color:${muted};">
                Hey ${data.user_name}, your subscription is now active. Here's your receipt.
              </p>
            </td>
          </tr>

          <!-- Receipt Card -->
          <tr>
            <td>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${cardBg};border:1px solid ${border};border-radius:12px;overflow:hidden;">
                <!-- Plan -->
                <tr>
                  <td style="padding:20px 24px;border-bottom:1px solid ${border};">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td>
                          <p style="margin:0 0 4px;font-size:12px;color:${muted};text-transform:uppercase;letter-spacing:0.5px;">Plan</p>
                          <p style="margin:0;font-size:18px;font-weight:700;color:${foreground};">${data.tier_name}</p>
                        </td>
                        <td style="text-align:right;">
                          <p style="margin:0 0 4px;font-size:12px;color:${muted};text-transform:uppercase;letter-spacing:0.5px;">Amount</p>
                          <p style="margin:0;font-size:18px;font-weight:700;color:${foreground};">$${data.amount}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <!-- Details -->
                <tr>
                  <td style="padding:16px 24px;border-bottom:1px solid ${border};">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td width="50%">
                          <p style="margin:0 0 4px;font-size:12px;color:${muted};text-transform:uppercase;letter-spacing:0.5px;">Credits Added</p>
                          <p style="margin:0;font-size:15px;font-weight:500;color:${foreground};">${data.credits} credits</p>
                        </td>
                        <td width="50%">
                          <p style="margin:0 0 4px;font-size:12px;color:${muted};text-transform:uppercase;letter-spacing:0.5px;">Billing Cycle</p>
                          <p style="margin:0;font-size:15px;font-weight:500;color:${foreground};">Monthly</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <!-- Period -->
                <tr>
                  <td style="padding:16px 24px;${data.payment_id ? `border-bottom:1px solid ${border};` : ""}">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td width="50%">
                          <p style="margin:0 0 4px;font-size:12px;color:${muted};text-transform:uppercase;letter-spacing:0.5px;">Start Date</p>
                          <p style="margin:0;font-size:15px;font-weight:500;color:${foreground};">${data.subscription_start}</p>
                        </td>
                        <td width="50%">
                          <p style="margin:0 0 4px;font-size:12px;color:${muted};text-transform:uppercase;letter-spacing:0.5px;">Next Renewal</p>
                          <p style="margin:0;font-size:15px;font-weight:500;color:${foreground};">${data.subscription_end}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                ${data.payment_id ? `
                <tr>
                  <td style="padding:16px 24px;">
                    <p style="margin:0 0 4px;font-size:12px;color:${muted};text-transform:uppercase;letter-spacing:0.5px;">Transaction ID</p>
                    <p style="margin:0;font-size:13px;font-weight:500;color:${muted};font-family:monospace;">${data.payment_id}</p>
                  </td>
                </tr>` : ""}
              </table>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td style="padding-top:28px;text-align:center;">
              <a href="https://rhozeland.com/credits" style="display:inline-block;background:${primary};color:#fff;font-size:14px;font-weight:600;padding:12px 32px;border-radius:8px;text-decoration:none;">
                View My Credits
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding-top:40px;text-align:center;">
              <p style="margin:0;font-size:12px;color:${muted};">
                Your subscription will automatically renew each month. You can manage it anytime from Settings.
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
