import { Resend } from "resend";
import { config } from "dotenv";

// Load environment variables
config();

const resend = new Resend(process.env.RESEND_API_KEY);

async function testEmail() {
  console.log("Testing Resend email service...");
  console.log("API Key:", process.env.RESEND_API_KEY ? "✓ Found" : "✗ Missing");

  try {
    const { data, error } = await resend.emails.send({
      from: process.env.EMAIL_FROM || "SE Project Hub <onboarding@resend.dev>",
      to: "delivered@resend.dev", // Resend's test email address
      subject: "Test Email from SE Project Hub",
      html: `
        <h1>🎉 Email Service Working!</h1>
        <p>This is a test email from SE Project Hub.</p>
        <p>Sent at: ${new Date().toISOString()}</p>
      `,
    });

    if (error) {
      console.error("❌ ERROR:", error);
    } else {
      console.log("✅ SUCCESS! Email sent.");
      console.log("Email ID:", data?.id);
    }
  } catch (err) {
    console.error("❌ EXCEPTION:", err);
  }
}

testEmail();
