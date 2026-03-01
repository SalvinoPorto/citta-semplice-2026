'use server';

import nodemailer from 'nodemailer';
import prisma from '@/lib/db/prisma';

interface EmailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

interface EmailResult {
  success: boolean;
  message: string;
  messageId?: string;
}

// Get Office 365 access token using client credentials flow
async function getOffice365Token(
  tenantId: string,
  clientId: string,
  clientSecret: string
): Promise<string> {
  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials',
  });

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to get Office 365 token: ${error.error_description || error.error}`);
  }

  const data = await response.json();
  return data.access_token;
}

// Send email using Microsoft Graph API
async function sendWithOffice365(
  tenantId: string,
  clientId: string,
  clientSecret: string,
  senderEmail: string,
  options: EmailOptions
): Promise<EmailResult> {
  try {
    const accessToken = await getOffice365Token(tenantId, clientId, clientSecret);

    const message = {
      message: {
        subject: options.subject,
        body: {
          contentType: options.html ? 'HTML' : 'Text',
          content: options.html || options.text || '',
        },
        toRecipients: [
          {
            emailAddress: {
              address: options.to,
            },
          },
        ],
      },
      saveToSentItems: true,
    };

    const sendUrl = `https://graph.microsoft.com/v1.0/users/${senderEmail}/sendMail`;

    const response = await fetch(sendUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        `Failed to send email via Office 365: ${error.error?.message || JSON.stringify(error)}`
      );
    }

    return {
      success: true,
      message: 'Email inviata con successo via Office 365',
    };
  } catch (error) {
    console.error('Office 365 email error:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Errore sconosciuto',
    };
  }
}

// Send email using SMTP
async function sendWithSmtp(
  host: string,
  port: number,
  secure: boolean,
  user: string | null,
  password: string | null,
  fromEmail: string,
  fromName: string | null,
  options: EmailOptions
): Promise<EmailResult> {
  try {
    const transportOptions: nodemailer.TransportOptions = {
      host,
      port,
      secure, // true for 465 (SSL), false for other ports (STARTTLS)
      auth: user && password ? { user, pass: password } : undefined,
    } as nodemailer.TransportOptions;

    const transporter = nodemailer.createTransport(transportOptions);

    const mailOptions = {
      from: fromName ? `"${fromName}" <${fromEmail}>` : fromEmail,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    };

    const info = await transporter.sendMail(mailOptions);

    return {
      success: true,
      message: 'Email inviata con successo via SMTP',
      messageId: info.messageId,
    };
  } catch (error) {
    console.error('SMTP email error:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Errore sconosciuto',
    };
  }
}

// Main function to send email using configured provider
export async function sendEmail(options: EmailOptions): Promise<EmailResult> {
  try {
    const config = await prisma.emailConfig.findFirst();

    if (!config || !config.attivo) {
      return {
        success: false,
        message: 'Configurazione email non attiva',
      };
    }

    if (config.provider === 'office365') {
      if (!config.o365TenantId || !config.o365ClientId || !config.o365ClientSecret || !config.o365SenderEmail) {
        return {
          success: false,
          message: 'Configurazione Office 365 incompleta',
        };
      }

      return sendWithOffice365(
        config.o365TenantId,
        config.o365ClientId,
        config.o365ClientSecret,
        config.o365SenderEmail,
        options
      );
    } else {
      // SMTP
      if (!config.smtpHost || !config.smtpPort || !config.smtpFromEmail) {
        return {
          success: false,
          message: 'Configurazione SMTP incompleta',
        };
      }

      return sendWithSmtp(
        config.smtpHost,
        config.smtpPort,
        config.smtpSecure,
        config.smtpUser,
        config.smtpPassword,
        config.smtpFromEmail,
        config.smtpFromName,
        options
      );
    }
  } catch (error) {
    console.error('Email service error:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Errore sconosciuto',
    };
  }
}

// Test email configuration
export async function testEmailConnection(
  provider: string,
  smtpConfig?: {
    host: string;
    port: number;
    secure: boolean;
    user?: string;
    password?: string;
    fromEmail: string;
    fromName?: string;
  },
  o365Config?: {
    tenantId: string;
    clientId: string;
    clientSecret: string;
    senderEmail: string;
  },
  testEmail?: string
): Promise<EmailResult> {
  if (provider === 'office365' && o365Config) {
    try {
      // Test by getting a token
      await getOffice365Token(o365Config.tenantId, o365Config.clientId, o365Config.clientSecret);

      // If testEmail provided, send a test email
      if (testEmail) {
        return sendWithOffice365(
          o365Config.tenantId,
          o365Config.clientId,
          o365Config.clientSecret,
          o365Config.senderEmail,
          {
            to: testEmail,
            subject: 'Test Email - Città Semplice Office',
            text: 'Questa è una email di test dalla configurazione Office 365.',
            html: '<p>Questa è una <strong>email di test</strong> dalla configurazione Office 365.</p>',
          }
        );
      }

      return {
        success: true,
        message: 'Connessione a Office 365 riuscita',
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Errore di connessione',
      };
    }
  } else if (provider === 'smtp' && smtpConfig) {
    try {
      const transportOptions: nodemailer.TransportOptions = {
        host: smtpConfig.host,
        port: smtpConfig.port,
        secure: smtpConfig.secure,
        auth: smtpConfig.user && smtpConfig.password
          ? { user: smtpConfig.user, pass: smtpConfig.password }
          : undefined,
      } as nodemailer.TransportOptions;

      const transporter = nodemailer.createTransport(transportOptions);

      // Verify connection
      await transporter.verify();

      // If testEmail provided, send a test email
      if (testEmail) {
        return sendWithSmtp(
          smtpConfig.host,
          smtpConfig.port,
          smtpConfig.secure,
          smtpConfig.user || null,
          smtpConfig.password || null,
          smtpConfig.fromEmail,
          smtpConfig.fromName || null,
          {
            to: testEmail,
            subject: 'Test Email - Città Semplice Office',
            text: 'Questa è una email di test dalla configurazione SMTP.',
            html: '<p>Questa è una <strong>email di test</strong> dalla configurazione SMTP.</p>',
          }
        );
      }

      return {
        success: true,
        message: 'Connessione SMTP riuscita',
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Errore di connessione',
      };
    }
  }

  return {
    success: false,
    message: 'Configurazione non valida',
  };
}
