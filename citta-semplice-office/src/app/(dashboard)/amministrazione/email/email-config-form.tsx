'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Card, CardBody, CardTitle, Button, Input, Select } from '@/components/ui';
import { saveEmailConfig, testEmail, EmailConfigData } from './actions';

interface EmailConfigFormProps {
  initialData: EmailConfigData | null;
}

export function EmailConfigForm({ initialData }: EmailConfigFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [testEmailAddress, setTestEmailAddress] = useState('');

  const [formData, setFormData] = useState<EmailConfigData>({
    provider: initialData?.provider || 'smtp',
    attivo: initialData?.attivo ?? false,
    // SMTP
    smtpHost: initialData?.smtpHost || '',
    smtpPort: initialData?.smtpPort || 587,
    smtpSecure: initialData?.smtpSecure ?? false,
    smtpUser: initialData?.smtpUser || '',
    smtpPassword: initialData?.smtpPassword || '',
    smtpFromEmail: initialData?.smtpFromEmail || '',
    smtpFromName: initialData?.smtpFromName || '',
    // Office 365
    o365TenantId: initialData?.o365TenantId || '',
    o365ClientId: initialData?.o365ClientId || '',
    o365ClientSecret: initialData?.o365ClientSecret || '',
    o365SenderEmail: initialData?.o365SenderEmail || '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const result = await saveEmailConfig(formData);
      if (result.success) {
        toast.success(result.message, { duration: 1500 });
        setTimeout(() => router.push('/amministrazione'), 1500);
      } else {
        toast.error(result.message);
      }
    } catch {
      toast.error('Si è verificato un errore');
    } finally {
      setLoading(false);
    }
  };

  const handleTest = async () => {
    if (!testEmailAddress) {
      toast.error('Inserire un indirizzo email per il test');
      return;
    }

    setTestLoading(true);

    try {
      const result = await testEmail(formData, testEmailAddress);
      if (result.success) {
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
    } catch {
      toast.error('Si è verificato un errore durante il test');
    } finally {
      setTestLoading(false);
    }
  };

  const updateField = (field: keyof EmailConfigData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Provider Selection */}
      <Card className="mb-4">
        <CardBody>
          <CardTitle>Tipo di Provider</CardTitle>
          <div className="row g-3">
            <div className="col-md-6">
              <div className="form-check">
                <input
                  type="radio"
                  id="provider-smtp"
                  name="provider"
                  className="form-check-input"
                  checked={formData.provider === 'smtp'}
                  onChange={() => updateField('provider', 'smtp')}
                />
                <label htmlFor="provider-smtp" className="form-check-label">
                  <strong>SMTP</strong>
                  <p className="text-muted mb-0 small">
                    Configurazione SMTP standard (porta 25/465/587)
                  </p>
                </label>
              </div>
            </div>
            <div className="col-md-6">
              <div className="form-check">
                <input
                  type="radio"
                  id="provider-o365"
                  name="provider"
                  className="form-check-input"
                  checked={formData.provider === 'office365'}
                  onChange={() => updateField('provider', 'office365')}
                />
                <label htmlFor="provider-o365" className="form-check-label">
                  <strong>Microsoft 365</strong>
                  <p className="text-muted mb-0 small">
                    Utilizza Microsoft Graph API con autenticazione OAuth 2.0
                  </p>
                </label>
              </div>
            </div>
          </div>

          <div className="mt-4">
            <div className="form-check form-switch">
              <input
                type="checkbox"
                id="attivo"
                className="form-check-input"
                checked={formData.attivo}
                onChange={(e) => updateField('attivo', e.target.checked)}
              />
              <label htmlFor="attivo" className="form-check-label">
                <strong>Configurazione Attiva</strong>
                <span className="text-muted ms-2">
                  (abilita l&apos;invio di email dal sistema)
                </span>
              </label>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* SMTP Configuration */}
      {formData.provider === 'smtp' && (
        <Card className="mb-4">
          <CardBody>
            <CardTitle>Configurazione SMTP</CardTitle>
            <div className="row g-3">
              <div className="col-md-8">
                <Input
                  type="text"
                  label="Server SMTP"
                  value={formData.smtpHost || ''}
                  onChange={(e) => updateField('smtpHost', e.target.value)}
                  placeholder="smtp.example.com"
                  required={formData.provider === 'smtp'}
                />
              </div>
              <div className="col-md-4">
                <Input
                  type="number"
                  label="Porta"
                  value={formData.smtpPort || ''}
                  onChange={(e) => updateField('smtpPort', parseInt(e.target.value) || undefined)}
                  placeholder="587"
                  required={formData.provider === 'smtp'}
                />
              </div>

              <div className="col-md-12">
                <Select
                  label="Sicurezza Connessione"
                  value={formData.smtpSecure ? 'ssl' : 'starttls'}
                  onChange={(e) => updateField('smtpSecure', e.target.value === 'ssl')}
                >
                  <option value="starttls">STARTTLS (porta 587) - Consigliato</option>
                  <option value="ssl">SSL/TLS (porta 465)</option>
                </Select>
                <small className="text-muted">
                  STARTTLS avvia la connessione in chiaro e la cifra dopo la negoziazione.
                  SSL/TLS usa una connessione cifrata dall&apos;inizio.
                </small>
              </div>

              <div className="col-md-6">
                <Input
                  type="text"
                  label="Username"
                  value={formData.smtpUser || ''}
                  onChange={(e) => updateField('smtpUser', e.target.value)}
                  placeholder="user@example.com"
                  autoComplete="off"
                />
              </div>
              <div className="col-md-6">
                <Input
                  type="password"
                  label="Password"
                  value={formData.smtpPassword || ''}
                  onChange={(e) => updateField('smtpPassword', e.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                />
              </div>

              <div className="col-md-6">
                <Input
                  type="email"
                  label="Email Mittente"
                  value={formData.smtpFromEmail || ''}
                  onChange={(e) => updateField('smtpFromEmail', e.target.value)}
                  placeholder="noreply@comune.example.it"
                  required={formData.provider === 'smtp'}
                />
              </div>
              <div className="col-md-6">
                <Input
                  type="text"
                  label="Nome Mittente"
                  value={formData.smtpFromName || ''}
                  onChange={(e) => updateField('smtpFromName', e.target.value)}
                  placeholder="Comune di Example"
                />
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Office 365 Configuration */}
      {formData.provider === 'office365' && (
        <Card className="mb-4">
          <CardBody>
            <CardTitle>Configurazione Microsoft 365</CardTitle>
            <div className="alert alert-info mb-4">
              <strong>Requisiti per Microsoft 365:</strong>
              <ol className="mb-0 mt-2">
                <li>Registrare un&apos;applicazione in Azure AD Portal</li>
                <li>Concedere il permesso <code>Mail.Send</code> (Application permission)</li>
                <li>Ottenere il consenso dell&apos;amministratore</li>
                <li>Creare un Client Secret</li>
              </ol>
            </div>

            <div className="row g-3">
              <div className="col-md-12">
                <Input
                  type="text"
                  label="Tenant ID"
                  value={formData.o365TenantId || ''}
                  onChange={(e) => updateField('o365TenantId', e.target.value)}
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  required={formData.provider === 'office365'}
                  helpText="ID del tenant Azure AD (Directory ID)"
                />
              </div>

              <div className="col-md-6">
                <Input
                  type="text"
                  label="Client ID (Application ID)"
                  value={formData.o365ClientId || ''}
                  onChange={(e) => updateField('o365ClientId', e.target.value)}
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  required={formData.provider === 'office365'}
                  helpText="ID dell'applicazione registrata in Azure AD"
                />
              </div>

              <div className="col-md-6">
                <Input
                  type="password"
                  label="Client Secret"
                  value={formData.o365ClientSecret || ''}
                  onChange={(e) => updateField('o365ClientSecret', e.target.value)}
                  placeholder="••••••••"
                  required={formData.provider === 'office365'}
                  autoComplete="new-password"
                  helpText="Secret generato nell'applicazione Azure AD"
                />
              </div>

              <div className="col-md-12">
                <Input
                  type="email"
                  label="Email Mittente (Sender)"
                  value={formData.o365SenderEmail || ''}
                  onChange={(e) => updateField('o365SenderEmail', e.target.value)}
                  placeholder="noreply@comune.onmicrosoft.com"
                  required={formData.provider === 'office365'}
                  helpText="Indirizzo email dell'account Microsoft 365 che invierà le email"
                />
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Test Section */}
      <Card className="mb-4">
        <CardBody>
          <CardTitle>Test Configurazione</CardTitle>
          <p className="text-muted">
            Invia una email di prova per verificare che la configurazione sia corretta.
          </p>
          <div className="row g-3 align-items-end">
            <div className="col-md-8">
              <Input
                type="email"
                label="Indirizzo Email di Test"
                value={testEmailAddress}
                onChange={(e) => setTestEmailAddress(e.target.value)}
                placeholder="test@example.com"
              />
            </div>
            <div className="col-md-4">
              <Button
                type="button"
                variant="outline-primary"
                onClick={handleTest}
                loading={testLoading}
                className="w-100"
              >
                Invia Email di Test
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Actions */}
      <div className="d-flex justify-content-end gap-2">
        <Button
          type="button"
          variant="secondary"
          onClick={() => router.push('/amministrazione')}
        >
          Annulla
        </Button>
        <Button type="submit" variant="primary" loading={loading}>
          Salva Configurazione
        </Button>
      </div>
    </form>
  );
}
