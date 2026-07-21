import { useState, type FormEvent } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useUpdateProfile } from '@/api/hooks';
import { Alert, Card, Spinner } from '@/components/ui';

export function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const updateProfile = useUpdateProfile();

  const [profile, setProfile] = useState({
    firstName: user?.firstName ?? '',
    lastName: user?.lastName ?? '',
    phone: user?.phone ?? '',
  });
  const [profileMsg, setProfileMsg] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  const [passwords, setPasswords] = useState({ current: '', next: '', confirm: '' });
  const [passwordMsg, setPasswordMsg] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [passwordBusy, setPasswordBusy] = useState(false);

  const [verifyMsg, setVerifyMsg] = useState<string | null>(null);

  const onSaveProfile = (e: FormEvent) => {
    e.preventDefault();
    setProfileMsg(null);
    updateProfile.mutate(
      {
        firstName: profile.firstName,
        lastName: profile.lastName,
        phone: profile.phone || null,
      },
      {
        onSuccess: async () => {
          await refreshUser();
          setProfileMsg({ kind: 'success', text: 'Profile updated' });
        },
        onError: (err) =>
          setProfileMsg({ kind: 'error', text: err instanceof Error ? err.message : 'Update failed' }),
      },
    );
  };

  const onChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    setPasswordMsg(null);
    if (passwords.next !== passwords.confirm) {
      setPasswordMsg({ kind: 'error', text: 'New passwords do not match' });
      return;
    }
    setPasswordBusy(true);
    try {
      await api('/users/me/change-password', {
        body: { currentPassword: passwords.current, newPassword: passwords.next },
      });
      setPasswords({ current: '', next: '', confirm: '' });
      setPasswordMsg({ kind: 'success', text: 'Password changed successfully' });
    } catch (err) {
      setPasswordMsg({ kind: 'error', text: err instanceof Error ? err.message : 'Change failed' });
    } finally {
      setPasswordBusy(false);
    }
  };

  const onResendVerification = async () => {
    setVerifyMsg(null);
    try {
      await api('/auth/resend-verification', { method: 'POST', body: {} });
      setVerifyMsg('Verification email sent — check your inbox.');
    } catch (err) {
      setVerifyMsg(err instanceof Error ? err.message : 'Could not send verification email');
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Profile</h1>

      {!user?.emailVerified && (
        <Alert kind="warning">
          Your email address is not verified yet.{' '}
          <button className="font-medium underline" onClick={onResendVerification}>
            Resend verification email
          </button>
          {verifyMsg && <span className="ml-2">{verifyMsg}</span>}
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Account details">
          <form onSubmit={onSaveProfile} className="space-y-4">
            {profileMsg && <Alert kind={profileMsg.kind}>{profileMsg.text}</Alert>}
            <div>
              <label className="label">Email</label>
              <input className="input" value={user?.email ?? ''} disabled />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label" htmlFor="firstName">First name</label>
                <input id="firstName" className="input" required value={profile.firstName}
                  onChange={(e) => setProfile((p) => ({ ...p, firstName: e.target.value }))} />
              </div>
              <div>
                <label className="label" htmlFor="lastName">Last name</label>
                <input id="lastName" className="input" required value={profile.lastName}
                  onChange={(e) => setProfile((p) => ({ ...p, lastName: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="label" htmlFor="phone">Phone</label>
              <input id="phone" className="input" placeholder="+92 300 1234567" value={profile.phone}
                onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))} />
            </div>
            <button type="submit" className="btn-primary" disabled={updateProfile.isPending}>
              {updateProfile.isPending && <Spinner className="h-4 w-4" />} Save changes
            </button>
          </form>
        </Card>

        <Card title="Change password">
          <form onSubmit={onChangePassword} className="space-y-4">
            {passwordMsg && <Alert kind={passwordMsg.kind}>{passwordMsg.text}</Alert>}
            <div>
              <label className="label" htmlFor="current">Current password</label>
              <input id="current" type="password" className="input" required value={passwords.current}
                onChange={(e) => setPasswords((p) => ({ ...p, current: e.target.value }))} autoComplete="current-password" />
            </div>
            <div>
              <label className="label" htmlFor="next">New password</label>
              <input id="next" type="password" className="input" required value={passwords.next}
                onChange={(e) => setPasswords((p) => ({ ...p, next: e.target.value }))} autoComplete="new-password" />
            </div>
            <div>
              <label className="label" htmlFor="confirm">Confirm new password</label>
              <input id="confirm" type="password" className="input" required value={passwords.confirm}
                onChange={(e) => setPasswords((p) => ({ ...p, confirm: e.target.value }))} autoComplete="new-password" />
            </div>
            <button type="submit" className="btn-primary" disabled={passwordBusy}>
              {passwordBusy && <Spinner className="h-4 w-4" />} Change password
            </button>
          </form>
        </Card>
      </div>
    </div>
  );
}
