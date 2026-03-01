'use server';

import { revalidatePath } from 'next/cache';
import prisma from '@/lib/db/prisma';
import { getCurrentUser } from '@/lib/auth/session';
import { testEmailConnection } from '@/lib/services/email';

export interface EmailConfigData {
  provider: 'smtp' | 'office365';
  attivo: boolean;
  // SMTP
  smtpHost?: string;
  smtpPort?: number;
  smtpSecure?: boolean;
  smtpUser?: string;
  smtpPassword?: string;
  smtpFromEmail?: string;
  smtpFromName?: string;
  // Office 365
  o365TenantId?: string;
  o365ClientId?: string;
  o365ClientSecret?: string;
  o365SenderEmail?: string;
}

export async function getEmailConfig() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, message: 'Non autorizzato', data: null };
    }

    const config = await prisma.emailConfig.findFirst();

    // Mask sensitive data
    if (config) {
      const configData: EmailConfigData = {
        provider: config.provider as 'smtp' | 'office365',
        attivo: config.attivo,
        smtpHost: config.smtpHost || undefined,
        smtpPort: config.smtpPort || undefined,
        smtpSecure: config.smtpSecure,
        smtpUser: config.smtpUser || undefined,
        smtpPassword: config.smtpPassword ? '********' : undefined,
        smtpFromEmail: config.smtpFromEmail || undefined,
        smtpFromName: config.smtpFromName || undefined,
        o365TenantId: config.o365TenantId || undefined,
        o365ClientId: config.o365ClientId || undefined,
        o365ClientSecret: config.o365ClientSecret ? '********' : undefined,
        o365SenderEmail: config.o365SenderEmail || undefined,
      };
      return {
        success: true,
        data: configData,
      };
    }

    return { success: true, data: null };
  } catch (error) {
    console.error('Error getting email config:', error);
    return { success: false, message: 'Errore durante il recupero della configurazione', data: null };
  }
}

export async function saveEmailConfig(data: EmailConfigData) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, message: 'Non autorizzato' };
    }

    const existingConfig = await prisma.emailConfig.findFirst();

    // Prepare data - handle password masking
    const configData: any = {
      provider: data.provider,
      attivo: data.attivo,
    };

    if (data.provider === 'smtp') {
      configData.smtpHost = data.smtpHost || null;
      configData.smtpPort = data.smtpPort || null;
      configData.smtpSecure = data.smtpSecure ?? false;
      configData.smtpUser = data.smtpUser || null;
      configData.smtpFromEmail = data.smtpFromEmail || null;
      configData.smtpFromName = data.smtpFromName || null;

      // Only update password if not masked
      if (data.smtpPassword && data.smtpPassword !== '********') {
        configData.smtpPassword = data.smtpPassword;
      } else if (existingConfig) {
        configData.smtpPassword = existingConfig.smtpPassword;
      }

      // Clear Office 365 config
      configData.o365TenantId = null;
      configData.o365ClientId = null;
      configData.o365ClientSecret = null;
      configData.o365SenderEmail = null;
    } else {
      // Office 365
      configData.o365TenantId = data.o365TenantId || null;
      configData.o365ClientId = data.o365ClientId || null;
      configData.o365SenderEmail = data.o365SenderEmail || null;

      // Only update client secret if not masked
      if (data.o365ClientSecret && data.o365ClientSecret !== '********') {
        configData.o365ClientSecret = data.o365ClientSecret;
      } else if (existingConfig) {
        configData.o365ClientSecret = existingConfig.o365ClientSecret;
      }

      // Clear SMTP config
      configData.smtpHost = null;
      configData.smtpPort = null;
      configData.smtpSecure = false;
      configData.smtpUser = null;
      configData.smtpPassword = null;
      configData.smtpFromEmail = null;
      configData.smtpFromName = null;
    }

    if (existingConfig) {
      await prisma.emailConfig.update({
        where: { id: existingConfig.id },
        data: configData,
      });
    } else {
      await prisma.emailConfig.create({
        data: configData,
      });
    }

    revalidatePath('/amministrazione/email');

    return { success: true, message: 'Configurazione salvata con successo' };
  } catch (error) {
    console.error('Error saving email config:', error);
    return { success: false, message: 'Errore durante il salvataggio della configurazione' };
  }
}

export async function testEmail(data: EmailConfigData, testEmailAddress: string) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, message: 'Non autorizzato' };
    }

    if (!testEmailAddress) {
      return { success: false, message: 'Inserire un indirizzo email per il test' };
    }

    // Get existing config for masked passwords
    const existingConfig = await prisma.emailConfig.findFirst();

    if (data.provider === 'smtp') {
      if (!data.smtpHost || !data.smtpPort || !data.smtpFromEmail) {
        return { success: false, message: 'Configurazione SMTP incompleta' };
      }

      // Use existing password if masked
      let password = data.smtpPassword;
      if (password === '********' && existingConfig) {
        password = existingConfig.smtpPassword || undefined;
      }

      return testEmailConnection(
        'smtp',
        {
          host: data.smtpHost,
          port: data.smtpPort,
          secure: data.smtpSecure ?? false,
          user: data.smtpUser,
          password: password,
          fromEmail: data.smtpFromEmail,
          fromName: data.smtpFromName,
        },
        undefined,
        testEmailAddress
      );
    } else {
      if (!data.o365TenantId || !data.o365ClientId || !data.o365SenderEmail) {
        return { success: false, message: 'Configurazione Office 365 incompleta' };
      }

      // Use existing client secret if masked
      let clientSecret = data.o365ClientSecret;
      if (clientSecret === '********' && existingConfig) {
        clientSecret = existingConfig.o365ClientSecret || undefined;
      }

      if (!clientSecret) {
        return { success: false, message: 'Client Secret Office 365 mancante' };
      }

      return testEmailConnection(
        'office365',
        undefined,
        {
          tenantId: data.o365TenantId,
          clientId: data.o365ClientId,
          clientSecret: clientSecret,
          senderEmail: data.o365SenderEmail,
        },
        testEmailAddress
      );
    }
  } catch (error) {
    console.error('Error testing email:', error);
    return { success: false, message: 'Errore durante il test' };
  }
}
