import { Resend } from "resend";

type Role = "admin" | "manager" | "judge";

interface InvitationParams {
  to: string;
  recipientName?: string | null;
  role: Role;
  inviterName?: string | null;
}

const ROLE_LABELS_HE: Record<Role, string> = {
  admin: "מנהל מערכת",
  manager: "מנהל אירוע",
  judge: "שופט",
};

const ROLE_LABELS_EN: Record<Role, string> = {
  admin: "System Administrator",
  manager: "Event Manager",
  judge: "Judge",
};

const ROLE_DESCRIPTIONS_HE: Record<Role, string> = {
  admin:
    "כמנהל מערכת, תהיה לך גישה מלאה לכל האירועים, השופטים, הקבוצות, התחנות והתוצאות. תוכל לנהל משתמשים, להזמין אנשים נוספים, ולהגדיר את כל המערכת.",
  manager:
    "כמנהל אירוע, תוכל לנהל את האירועים שאליהם תוקצה — להוסיף ולשבץ שופטים, לנהל קבוצות ותחנות, לעקוב אחרי התקדמות השיפוט בזמן אמת ולשלוח הודעות לשופטים.",
  judge:
    "כשופט, תוכל לראות את האירועים שאליהם שובצת, לשפוט קבוצות בתחנות שלך, להזין ציונים ופידבק, ולהשתמש בכלי AI שיעזרו לך לתת פידבק איכותי וענייני.",
};

const ROLE_DESCRIPTIONS_EN: Record<Role, string> = {
  admin:
    "As a System Administrator, you'll have full access to all events, judges, teams, stations, and results. You can manage users, invite more people, and configure the entire system.",
  manager:
    "As an Event Manager, you'll be able to manage the events you're assigned to — add and assign judges, manage teams and stations, track judging progress in real-time, and send messages to judges.",
  judge:
    "As a Judge, you'll see the events you're assigned to, judge teams at your stations, enter scores and feedback, and use AI tools that help you give high-quality, substantive feedback.",
};

function buildHtml(params: {
  recipientName: string;
  role: Role;
  inviterName: string;
  appUrl: string;
  email: string;
}): string {
  const { recipientName, role, inviterName, appUrl, email } = params;
  const roleHe = ROLE_LABELS_HE[role];
  const roleEn = ROLE_LABELS_EN[role];
  const descHe = ROLE_DESCRIPTIONS_HE[role];
  const descEn = ROLE_DESCRIPTIONS_EN[role];

  return `<!DOCTYPE html>
<html lang="he">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>הזמנה ל-Orbit AI</title>
</head>
<body style="margin:0;padding:0;background:#0a0e27;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0a0e27;padding:40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#0f1535;border-radius:16px;border:1px solid rgba(0,170,255,0.2);box-shadow:0 0 40px rgba(0,170,255,0.1);overflow:hidden;">
          <!-- Header with gradient -->
          <tr>
            <td style="background:linear-gradient(135deg,#06b6d4 0%,#3b82f6 50%,#8b5cf6 100%);padding:40px 30px;text-align:center;">
              <div style="display:inline-block;width:60px;height:60px;background:rgba(255,255,255,0.15);border-radius:14px;line-height:60px;font-size:32px;margin-bottom:12px;">🚀</div>
              <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:800;letter-spacing:1px;">Orbit AI</h1>
              <p style="margin:8px 0 0 0;color:rgba(255,255,255,0.85);font-size:14px;">מערכת ניהול שיפוט תחרויות</p>
            </td>
          </tr>

          <!-- Hebrew section (RTL) -->
          <tr>
            <td dir="rtl" style="padding:40px 36px 20px 36px;color:#e2e8f0;text-align:right;">
              <h2 style="margin:0 0 16px 0;color:#ffffff;font-size:22px;font-weight:700;">
                שלום ${escapeHtml(recipientName)},
              </h2>
              <p style="margin:0 0 16px 0;font-size:16px;line-height:1.6;color:#cbd5e1;">
                הוזמנת על ידי <strong style="color:#06b6d4;">${escapeHtml(inviterName)}</strong> להצטרף ל-<strong style="color:#ffffff;">Orbit AI</strong> בתפקיד:
              </p>
              <div style="background:rgba(6,182,212,0.1);border:1px solid rgba(6,182,212,0.3);border-radius:10px;padding:14px 18px;margin:0 0 20px 0;">
                <span style="color:#06b6d4;font-size:18px;font-weight:700;">${roleHe}</span>
              </div>
              <p style="margin:0 0 24px 0;font-size:15px;line-height:1.7;color:#94a3b8;">
                ${descHe}
              </p>
            </td>
          </tr>

          <!-- CTA Button -->
          <tr>
            <td align="center" style="padding:0 36px 20px 36px;">
              <a href="${appUrl}/login" style="display:inline-block;padding:16px 48px;background:linear-gradient(135deg,#06b6d4 0%,#3b82f6 100%);color:#ffffff;text-decoration:none;font-weight:700;font-size:16px;border-radius:12px;box-shadow:0 4px 20px rgba(6,182,212,0.3);">
                כניסה למערכת ←
              </a>
            </td>
          </tr>

          <!-- Instructions -->
          <tr>
            <td dir="rtl" style="padding:0 36px 30px 36px;color:#94a3b8;font-size:13px;line-height:1.7;text-align:right;">
              <p style="margin:0 0 8px 0;">
                <strong style="color:#cbd5e1;">איך מתחברים:</strong>
              </p>
              <ol style="margin:0;padding-right:20px;">
                <li>לחץ על הכפתור למעלה</li>
                <li>בחר באופציה "Sign in with Google"</li>
                <li>התחבר עם חשבון הגוגל <span style="color:#06b6d4;font-weight:600;">${escapeHtml(email)}</span></li>
              </ol>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding:0 36px;">
              <div style="height:1px;background:linear-gradient(to right,transparent,rgba(255,255,255,0.1),transparent);"></div>
            </td>
          </tr>

          <!-- English section -->
          <tr>
            <td dir="ltr" style="padding:30px 36px 20px 36px;color:#e2e8f0;text-align:left;">
              <h2 style="margin:0 0 16px 0;color:#ffffff;font-size:20px;font-weight:700;">
                Hello ${escapeHtml(recipientName)},
              </h2>
              <p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#cbd5e1;">
                You've been invited by <strong style="color:#06b6d4;">${escapeHtml(inviterName)}</strong> to join <strong style="color:#ffffff;">Orbit AI</strong> as a:
              </p>
              <div style="background:rgba(6,182,212,0.1);border:1px solid rgba(6,182,212,0.3);border-radius:10px;padding:12px 16px;margin:0 0 18px 0;">
                <span style="color:#06b6d4;font-size:16px;font-weight:700;">${roleEn}</span>
              </div>
              <p style="margin:0 0 20px 0;font-size:14px;line-height:1.7;color:#94a3b8;">
                ${descEn}
              </p>
              <p style="margin:0 0 8px 0;color:#cbd5e1;font-size:13px;">
                <strong>How to sign in:</strong> Click the button above and choose "Sign in with Google" using this email address.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 36px;background:rgba(0,0,0,0.2);border-top:1px solid rgba(255,255,255,0.05);text-align:center;">
              <p style="margin:0;color:#64748b;font-size:12px;line-height:1.6;">
                אם לא ציפית לקבל את המייל הזה, אפשר להתעלם ממנו.<br>
                If you weren't expecting this invitation, you can safely ignore this email.
              </p>
              <p style="margin:12px 0 0 0;color:#475569;font-size:11px;">
                Orbit AI · ${new Date().getFullYear()}
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

function buildText(params: {
  recipientName: string;
  role: Role;
  inviterName: string;
  appUrl: string;
  email: string;
}): string {
  const roleHe = ROLE_LABELS_HE[params.role];
  const roleEn = ROLE_LABELS_EN[params.role];
  return `שלום ${params.recipientName},

הוזמנת על ידי ${params.inviterName} להצטרף ל-Orbit AI בתפקיד: ${roleHe}.

${ROLE_DESCRIPTIONS_HE[params.role]}

כדי להתחבר:
1. לך אל: ${params.appUrl}/login
2. לחץ "Sign in with Google"
3. התחבר עם חשבון הגוגל ${params.email}

---

Hello ${params.recipientName},

You've been invited by ${params.inviterName} to join Orbit AI as: ${roleEn}.

${ROLE_DESCRIPTIONS_EN[params.role]}

To sign in:
1. Go to: ${params.appUrl}/login
2. Click "Sign in with Google"
3. Sign in with your Google account: ${params.email}

---
Orbit AI`;
}

function escapeHtml(unsafe: string | null | undefined): string {
  if (!unsafe) return "";
  return String(unsafe)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.FROM_EMAIL);
}

export async function sendInvitationEmail(
  params: InvitationParams
): Promise<{ ok: boolean; error?: string }> {
  if (!isEmailConfigured()) {
    console.warn(
      "[Email] RESEND_API_KEY or FROM_EMAIL not set - skipping invitation email"
    );
    return { ok: false, error: "Email service not configured" };
  }

  const apiKey = process.env.RESEND_API_KEY!;
  const from = process.env.FROM_EMAIL!;
  const appUrl =
    process.env.APP_URL ||
    process.env.NEXTAUTH_URL ||
    "https://orbit-ai-2cce307128b8.herokuapp.com";

  const recipientName = params.recipientName?.trim() || params.to.split("@")[0];
  const inviterName = params.inviterName?.trim() || "מנהל המערכת";

  const subject =
    params.role === "admin"
      ? `הוזמנת להיות מנהל מערכת ב-Orbit AI · You've been invited as Admin`
      : params.role === "manager"
        ? `הוזמנת להיות מנהל אירוע ב-Orbit AI · You've been invited as Event Manager`
        : `הוזמנת להיות שופט ב-Orbit AI · You've been invited as Judge`;

  const html = buildHtml({
    recipientName,
    role: params.role,
    inviterName,
    appUrl,
    email: params.to,
  });

  const text = buildText({
    recipientName,
    role: params.role,
    inviterName,
    appUrl,
    email: params.to,
  });

  try {
    const resend = new Resend(apiKey);
    const result = await resend.emails.send({
      from,
      to: params.to,
      subject,
      html,
      text,
    });
    if (result.error) {
      console.error("[Email] Resend returned error:", result.error);
      return { ok: false, error: result.error.message };
    }
    console.log(`[Email] Invitation sent to ${params.to} (role: ${params.role})`);
    return { ok: true };
  } catch (error: any) {
    console.error("[Email] Failed to send invitation:", error);
    return { ok: false, error: error?.message || "Unknown error" };
  }
}
