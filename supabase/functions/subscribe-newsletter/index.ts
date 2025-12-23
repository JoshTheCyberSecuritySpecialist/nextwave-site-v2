import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface SubscribeRequest {
  email: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { email }: SubscribeRequest = await req.json();

    if (!email || !email.includes('@')) {
      return new Response(
        JSON.stringify({ error: 'Invalid email address' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    const normalizedEmail = email.toLowerCase();
    const timestamp = new Date().toISOString();

    const { error: dbError } = await supabase
      .from('newsletter_subscriptions')
      .insert([{ email: normalizedEmail }]);

    if (dbError) {
      if (dbError.code === '23505') {
        return new Response(
          JSON.stringify({ error: 'This email is already subscribed' }),
          {
            status: 409,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
      throw dbError;
    }

    if (resendApiKey) {
      try {
        const thankYouEmailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Thanks for subscribing</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f4;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <tr>
            <td style="padding: 40px 40px 30px 40px; text-align: center;">
              <img src="https://nextwavedigitalsolution.com/logo.png" alt="NextWave Digital Solutions" width="140" style="display: block; margin: 0 auto;">
            </td>
          </tr>
          <tr>
            <td style="padding: 0 40px 40px 40px;">
              <h1 style="margin: 0 0 20px 0; font-size: 28px; font-weight: 600; color: #1a1a1a; text-align: center;">Thanks for subscribing</h1>
              <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #4a4a4a; text-align: center;">
                Thanks for subscribing to NextWave Digital Solutions. You'll receive updates on cybersecurity, automation, and the tools we're building for modern businesses.
              </p>
              <p style="margin: 30px 0 0 0; font-size: 16px; color: #4a4a4a; text-align: center;">
                — NextWave Digital Solutions
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 40px 40px 40px; text-align: center; border-top: 1px solid #e0e0e0;">
              <p style="margin: 0; font-size: 12px; color: #999999; line-height: 1.5;">
                You are receiving this email because you subscribed on nextwavedigitalsolution.com.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

        const adminNotificationHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Website Subscriber</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f4;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <tr>
            <td style="padding: 30px 40px 20px 40px; text-align: center;">
              <img src="https://nextwavedigitalsolution.com/logo.png" alt="NextWave Digital Solutions" width="100" style="display: block; margin: 0 auto;">
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 40px 40px 40px;">
              <h1 style="margin: 0 0 20px 0; font-size: 24px; font-weight: 600; color: #1a1a1a;">New subscriber captured</h1>
              <table cellpadding="0" cellspacing="0" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid #e0e0e0;">
                    <strong style="color: #4a4a4a; font-size: 14px;">Email:</strong>
                  </td>
                  <td style="padding: 12px 0; border-bottom: 1px solid #e0e0e0; text-align: right;">
                    <span style="color: #1a1a1a; font-size: 14px;">${normalizedEmail}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 0;">
                    <strong style="color: #4a4a4a; font-size: 14px;">Time:</strong>
                  </td>
                  <td style="padding: 12px 0; text-align: right;">
                    <span style="color: #1a1a1a; font-size: 14px;">${new Date(timestamp).toLocaleString('en-US', { timeZone: 'America/New_York', dateStyle: 'medium', timeStyle: 'short' })}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'NextWave Digital Solutions <no-reply@nextwavedigitalsolution.com>',
            to: normalizedEmail,
            subject: 'Thanks for subscribing to NextWave Digital Solutions',
            html: thankYouEmailHtml,
          }),
        });

        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'NextWave Website <no-reply@nextwavedigitalsolution.com>',
            to: 'joshua@nextwavedigitalsolution.com',
            subject: 'New Website Subscriber',
            html: adminNotificationHtml,
          }),
        });
      } catch (emailError) {
        console.error('Email sending error:', emailError);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Thanks for subscribing!' 
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Subscription error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Something went wrong. Please try again.' 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
