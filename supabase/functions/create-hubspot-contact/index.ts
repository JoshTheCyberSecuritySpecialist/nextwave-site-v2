import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { Resend } from "npm:resend@4.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ContactData {
  name: string;
  email: string;
  phone?: string;
  businessName?: string;
  service?: string;
  message: string;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function inboxText(value: string | undefined, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > max) return null;
  return trimmed;
}

async function rememberMessage(contactData: ContactData): Promise<void> {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) return;

    const name = inboxText(contactData.name, 120);
    const email = inboxText(contactData.email, 254)?.toLowerCase() ?? "";
    const body = inboxText(contactData.message, 5000);
    if (!name || !body || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;

    const phoneRaw = inboxText(contactData.phone, 20);
    const phone = phoneRaw && /^[\d\s()+.-]{7,20}$/.test(phoneRaw) ? phoneRaw : null;
    const response = await fetch(`${supabaseUrl.replace(/\/$/, "")}/rest/v1/site_messages`, {
      method: "POST",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        name,
        email,
        phone,
        business_name: inboxText(contactData.businessName, 160),
        service: inboxText(contactData.service, 160),
        body,
      }),
    });
    if (!response.ok) console.error("Contact message was not stored", response.status);
  } catch {
    console.error("Contact message was not stored");
  }
}

async function sendEmailNotification(contactData: ContactData): Promise<void> {
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const notificationEmail = Deno.env.get("NOTIFICATION_EMAIL");

  console.log("Email notification attempt - API Key present:", !!resendApiKey);
  console.log("Email notification attempt - Notification email:", notificationEmail);

  if (!resendApiKey || !notificationEmail) {
    console.warn("Email notification skipped: RESEND_API_KEY or NOTIFICATION_EMAIL not configured");
    return;
  }

  const resend = new Resend(resendApiKey);

  const serviceName = contactData.service || "Not specified";
  const phoneDisplay = contactData.phone || "Not provided";
  const businessDisplay = contactData.businessName || "Not provided";

  const emailHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #2283B8;">New Website Lead</h2>

      <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <p><strong>Name:</strong> ${escapeHtml(contactData.name)}</p>
        <p><strong>Email:</strong> ${escapeHtml(contactData.email)}</p>
        <p><strong>Phone:</strong> ${escapeHtml(phoneDisplay)}</p>
        <p><strong>Business Name:</strong> ${escapeHtml(businessDisplay)}</p>
        <p><strong>Service Needed:</strong> ${escapeHtml(serviceName)}</p>
      </div>

      <div style="margin: 20px 0;">
        <h3 style="color: #2283B8;">Message:</h3>
        <p style="white-space: pre-wrap;">${escapeHtml(contactData.message)}</p>
      </div>
    </div>
  `;

  try {
    const result = await resend.emails.send({
      from: "onboarding@resend.dev",
      to: notificationEmail,
      subject: `New Website Lead – ${serviceName}`,
      html: emailHtml,
    });
    console.log("Email sent successfully:", result);
  } catch (error) {
    console.error("Failed to send email notification:", error);
    throw error;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const hubspotToken = Deno.env.get("HUBSPOT_PRIVATE_APP_TOKEN");

    if (!hubspotToken) {
      throw new Error("HubSpot token not configured");
    }

    const contactData: ContactData = await req.json();

    const nameParts = contactData.name.trim().split(" ");
    const firstName = nameParts[0] || "";
    const lastName = nameParts.slice(1).join(" ") || "";

    const properties: Record<string, string> = {
      email: contactData.email,
      firstname: firstName,
      lastname: lastName,
    };

    if (contactData.phone) {
      properties.phone = contactData.phone;
    }

    if (contactData.message) {
      properties.message = contactData.message;
    }

    if (contactData.businessName) {
      properties.company = contactData.businessName;
    }

    if (contactData.service) {
      properties.service_needed = contactData.service;
    }

    const hubspotResponse = await fetch(
      "https://api.hubapi.com/crm/v3/objects/contacts",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${hubspotToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ properties }),
      }
    );

    if (hubspotResponse.status === 409) {
      const errorData = await hubspotResponse.json();
      const existingContactId = errorData.message?.match(/Existing ID: (\d+)/)?.[1];

      if (existingContactId) {
        const updateResponse = await fetch(
          `https://api.hubapi.com/crm/v3/objects/contacts/${existingContactId}`,
          {
            method: "PATCH",
            headers: {
              "Authorization": `Bearer ${hubspotToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ properties }),
          }
        );

        if (!updateResponse.ok) {
          const updateError = await updateResponse.text();
          throw new Error(`Failed to update contact: ${updateError}`);
        }

        const updatedContact = await updateResponse.json();

        await rememberMessage(contactData);
        await sendEmailNotification(contactData);

        return new Response(
          JSON.stringify({ success: true, contact: updatedContact }),
          {
            status: 200,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json",
            },
          }
        );
      }
    }

    if (!hubspotResponse.ok) {
      const errorText = await hubspotResponse.text();
      throw new Error(`HubSpot API error: ${errorText}`);
    }

    const newContact = await hubspotResponse.json();

    await rememberMessage(contactData);
    await sendEmailNotification(contactData);

    return new Response(
      JSON.stringify({ success: true, contact: newContact }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("Error creating HubSpot contact:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});