import { adminAuth } from "../config/firebase";

/* ------------------------------------------------------------------ */
/*  Brevo Transactional Email API (HTTP – works on Render free tier)  */
/* ------------------------------------------------------------------ */

const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

const getBrevoApiKey = (): string => {
  const key = process.env.BREVO_API_KEY;
  if (!key) throw new Error("BREVO_API_KEY environment variable is not set");
  return key;
};

const getSender = () => ({
  name: "SE Project Hub",
  email: process.env.GMAIL_USER || "pskpsk009@gmail.com",
});

async function sendEmailViaBrevo(
  to: { email: string; name?: string },
  subject: string,
  htmlContent: string,
): Promise<void> {
  const response = await fetch(BREVO_API_URL, {
    method: "POST",
    headers: {
      "api-key": getBrevoApiKey(),
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      sender: getSender(),
      to: [to],
      subject,
      htmlContent,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Brevo API error (${response.status}): ${body}`);
  }
}

/* ------------------------------------------------------------------ */

interface Student {
  name: string;
  email: string;
  rollNumber: string;
}

const actionCodeSettings = {
  url: `${process.env.FRONTEND_URL || "http://localhost:8080"}`,
  handleCodeInApp: true,
};

export async function sendSignInLink(
  student: Student,
  defaultPassword?: string,
): Promise<void> {
  // Generate Firebase sign-in link
  const signInLink = await adminAuth.generateSignInWithEmailLink(
    student.email,
    actionCodeSettings,
  );

  const passwordBlock = defaultPassword
    ? `<p>🔑 <strong>Default Password:</strong> <code style="background:#eef2ff;padding:4px 8px;border-radius:4px;font-size:16px;letter-spacing:1px;">${defaultPassword}</code></p>`
    : "";

  const passwordStep = defaultPassword
    ? `<li>Or sign in directly at <a href="${actionCodeSettings.url}">${actionCodeSettings.url}</a> using your email and the default password above</li>
                <li>Change your password in <strong>Account Detail</strong> after signing in (recommended)</li>`
    : `<li>Set a password for future logins (recommended)</li>`;

  const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #4F46E5; color: white; padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .header h1 { margin: 0; font-size: 24px; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; padding: 14px 28px; background: #4F46E5; color: white !important; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 20px 0; }
          .button:hover { background: #4338CA; }
          .info { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #4F46E5; }
          .info p { margin: 8px 0; }
          .steps { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .steps ol { margin: 0; padding-left: 20px; }
          .steps li { margin: 10px 0; }
          .footer { text-align: center; color: #666; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎓 Welcome to SE Project Hub!</h1>
          </div>
          <div class="content">
            <p>Hello <strong>${student.name}</strong>,</p>
            <p>You have been added to SE Project Hub by your course coordinator. Click the button below to sign in and set up your account:</p>
            
            <div style="text-align: center;">
              <a href="${signInLink}" class="button">Sign In to SE Project Hub</a>
            </div>

            <div class="info">
              <p><strong>📋 Your Details:</strong></p>
              <p>📧 <strong>Email:</strong> ${student.email}</p>
              <p>🎓 <strong>Roll Number:</strong> ${student.rollNumber}</p>
              ${passwordBlock}
            </div>

            <div class="steps">
              <p><strong>What happens next?</strong></p>
              <ol>
                <li>Click the sign-in button above</li>
                <li>You'll be automatically signed in</li>
                ${passwordStep}
                <li>Start collaborating on your projects!</li>
              </ol>
            </div>

            <div class="footer">
              <p>⏰ The sign-in link expires in 24 hours, but you can always use your password to log in.</p>
              <p>If you didn't expect this email, please ignore it.</p>
              <p>— SE Project Hub Team</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

  await sendEmailViaBrevo(
    { email: student.email, name: student.name },
    "Welcome to SE Project Hub - Sign In to Get Started",
    html,
  );
}

export async function sendBulkSignInLinks(
  students: Student[],
  defaultPassword?: string,
): Promise<{
  success: number;
  failed: number;
  errors: string[];
}> {
  let success = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const student of students) {
    try {
      await sendSignInLink(student, defaultPassword);
      success++;
      // Delay to avoid Brevo rate limiting
      await new Promise((resolve) => setTimeout(resolve, 300));
    } catch (error: unknown) {
      failed++;
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${student.email}: ${message}`);
      // eslint-disable-next-line no-console
      console.error(`Failed to send email to ${student.email}:`, message);
    }
  }

  return { success, failed, errors };
}

/**
 * Send welcome emails to bulk-uploaded students with their credentials.
 * Same approach as manual user creation – no magic sign-in link.
 */
export async function sendBulkWelcomeEmails(
  students: Student[],
  defaultPassword: string,
): Promise<{
  success: number;
  failed: number;
  errors: string[];
}> {
  let success = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const student of students) {
    try {
      await sendWelcomeEmail({
        name: student.name,
        email: student.email,
        password: defaultPassword,
        role: "student",
      });
      success++;
      // Delay to avoid Brevo rate limiting
      await new Promise((resolve) => setTimeout(resolve, 300));
    } catch (error: unknown) {
      failed++;
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${student.email}: ${message}`);
      // eslint-disable-next-line no-console
      console.error(`Failed to send email to ${student.email}:`, message);
    }
  }

  return { success, failed, errors };
}

/**
 * Send a welcome email via Brevo when a coordinator manually creates a new user.
 */
export async function sendWelcomeEmail(input: {
  name: string;
  email: string;
  password: string;
  role: string;
}): Promise<void> {
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:8080";

  const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #4F46E5; color: white; padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .header h1 { margin: 0; font-size: 24px; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; padding: 14px 28px; background: #4F46E5; color: white !important; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 20px 0; }
          .info { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #4F46E5; }
          .info p { margin: 8px 0; }
          .footer { text-align: center; color: #666; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to SE Project Hub!</h1>
          </div>
          <div class="content">
            <p>Hello <strong>${input.name}</strong>,</p>
            <p>An account has been created for you on SE Project Hub. Here are your login details:</p>

            <div class="info">
              <p><strong>Your Credentials:</strong></p>
              <p>📧 <strong>Email:</strong> ${input.email}</p>
              <p>🔑 <strong>Password:</strong> <code style="background:#eef2ff;padding:4px 8px;border-radius:4px;font-size:16px;letter-spacing:1px;">${input.password}</code></p>
              <p>👤 <strong>Role:</strong> ${input.role.charAt(0).toUpperCase() + input.role.slice(1)}</p>
            </div>

            <div style="text-align: center;">
              <a href="${frontendUrl}" class="button">Sign In Now</a>
            </div>

            <p style="color:#b91c1c;font-weight:bold;">⚠️ Please change your password after your first sign-in via Account Detail.</p>

            <div class="footer">
              <p>If you didn't expect this email, please ignore it.</p>
              <p>— SE Project Hub Team</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

  await sendEmailViaBrevo(
    { email: input.email, name: input.name },
    "Your SE Project Hub Account Has Been Created",
    html,
  );

  console.log("Welcome email sent to", input.email);
}
