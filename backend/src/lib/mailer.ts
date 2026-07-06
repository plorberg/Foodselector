import nodemailer from "nodemailer";

// Optional email delivery via SMTP. Enabled only when SMTP_URL and EMAIL_FROM
// are set (e.g. SMTP_URL=smtps://user:pass@smtp.example.com:465). Without them
// the app stays fully usable — invitations then rely on shareable links.

export function mailerEnabled(): boolean {
  return Boolean(process.env.SMTP_URL && process.env.EMAIL_FROM);
}

export async function sendInvitationEmail(params: {
  to: string;
  workspaceName: string;
  inviterName: string | null;
  inviteUrl: string;
}): Promise<boolean> {
  if (!mailerEnabled()) return false;

  const inviter = params.inviterName ?? "Jemand";
  const transport = nodemailer.createTransport(process.env.SMTP_URL);
  try {
    await transport.sendMail({
      from: process.env.EMAIL_FROM,
      to: params.to,
      subject: `${inviter} hat dich zur Gruppe „${params.workspaceName}“ eingeladen`,
      text: [
        `Hallo,`,
        ``,
        `${inviter} hat dich eingeladen, der Gruppe „${params.workspaceName}“ im Food Selector beizutreten.`,
        ``,
        `Einladung annehmen: ${params.inviteUrl}`,
        ``,
        `Falls du diese Einladung nicht erwartet hast, kannst du diese E-Mail ignorieren.`,
      ].join("\n"),
    });
    return true;
  } catch (err) {
    // Email failure must never break the invitation itself.
    console.error("invitation email failed:", err);
    return false;
  }
}
