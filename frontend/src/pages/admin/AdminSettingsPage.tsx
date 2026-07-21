import { useEffect, useState, type FormEvent } from 'react';
import { useAdminSettings, useAdminUpdateSettings } from '@/api/admin';
import { api } from '@/lib/api';
import { Alert, Card, PageSpinner, Spinner } from '@/components/ui';
import type { SettingDto } from '@geoagri/shared';

const GROUP_TITLES: Record<string, string> = {
  payment: 'Payment accounts',
  support: 'Support contacts',
  general: 'General',
};

function QrUpload({ settingKey, label }: { settingKey: string; label: string }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const onUpload = async (file: File) => {
    setBusy(true);
    setMessage(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      await api(`/admin/settings/qr/${encodeURIComponent(settingKey)}`, { formData: fd });
      setMessage('QR code uploaded');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <label className="label">{label}</label>
      <input
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="input"
        disabled={busy}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void onUpload(file);
        }}
      />
      {message && <p className="mt-1 text-xs text-slate-500">{message}</p>}
    </div>
  );
}

export function AdminSettingsPage() {
  const { data: settings, isLoading } = useAdminSettings();
  const update = useAdminUpdateSettings();
  const [values, setValues] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (settings) {
      setValues(Object.fromEntries(settings.map((s) => [s.key, s.value])));
    }
  }, [settings]);

  if (isLoading || !settings) return <PageSpinner />;

  const grouped = settings.reduce<Record<string, SettingDto[]>>((acc, s) => {
    (acc[s.group] ??= []).push(s);
    return acc;
  }, {});

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setMessage(null);
    const updates = settings
      .filter((s) => !s.key.endsWith('.qrCodePath'))
      .map((s) => ({ key: s.key, value: values[s.key] ?? '' }));
    update.mutate(updates, {
      onSuccess: () => setMessage({ kind: 'success', text: 'Settings saved' }),
      onError: (err) =>
        setMessage({ kind: 'error', text: err instanceof Error ? err.message : 'Save failed' }),
    });
  };

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Platform settings</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Payment account details shown to farmers during manual checkout. Nothing is hardcoded —
            everything here is stored in the database.
          </p>
        </div>
        <button type="submit" className="btn-primary" disabled={update.isPending}>
          {update.isPending && <Spinner className="h-4 w-4" />} Save all
        </button>
      </div>

      {message && <Alert kind={message.kind}>{message.text}</Alert>}

      {Object.entries(grouped).map(([group, items]) => (
        <Card key={group} title={GROUP_TITLES[group] ?? group}>
          <div className="grid gap-4 md:grid-cols-2">
            {items.map((setting) =>
              setting.key.endsWith('.qrCodePath') ? (
                <QrUpload key={setting.key} settingKey={setting.key} label={setting.label} />
              ) : (
                <div key={setting.key}>
                  <label className="label" htmlFor={setting.key}>{setting.label}</label>
                  <input
                    id={setting.key}
                    className="input"
                    value={values[setting.key] ?? ''}
                    onChange={(e) =>
                      setValues((v) => ({ ...v, [setting.key]: e.target.value }))
                    }
                  />
                </div>
              ),
            )}
          </div>
        </Card>
      ))}
    </form>
  );
}
