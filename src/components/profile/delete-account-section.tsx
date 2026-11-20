'use client';

import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { authClient } from '@/lib/auth-client';

interface DeleteAccountSectionProps {
  hasPassword: boolean;
  isMainAdmin: boolean;
}

const CONFIRM_WORD = 'DELETE';

function errorMessage(error: { code?: string; message?: string }): string {
  switch (error.code) {
    case 'INVALID_PASSWORD':
      return "That password isn't right. Your account was not deleted.";
    case 'SESSION_EXPIRED':
      return 'For your security, sign out and sign in again, then delete your account within 24 hours.';
    default:
      return (
        error.message ||
        'Something went wrong, so your account was not deleted. Please try again.'
      );
  }
}

export function DeleteAccountSection({
  hasPassword,
  isMainAdmin,
}: DeleteAccountSectionProps) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canDelete =
    confirmText.trim() === CONFIRM_WORD &&
    (!hasPassword || password.length > 0) &&
    !isDeleting;

  const close = () => {
    setOpen(false);
    setPassword('');
    setConfirmText('');
    setError(null);
  };

  const handleDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canDelete) return;
    setIsDeleting(true);
    setError(null);
    try {
      const result = await authClient.deleteUser(
        hasPassword ? { password } : {}
      );
      if (result.error) {
        setError(errorMessage(result.error));
        setIsDeleting(false);
        return;
      }
      // The session cookie is gone; a full page load clears all client state.
      window.location.assign('/');
    } catch {
      setError(
        'Something went wrong, so your account was not deleted. Please try again.'
      );
      setIsDeleting(false);
    }
  };

  return (
    <div className="rounded-lg border border-red-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold text-gray-900">Delete account</h2>
      <p className="mt-1 text-sm text-gray-500">
        Permanently delete your account and your personal data.
      </p>

      {isMainAdmin ? (
        <p className="mt-4 text-sm text-gray-600">
          The main admin account cannot be deleted from the app.
        </p>
      ) : !open ? (
        <Button
          type="button"
          variant="outline"
          className="mt-4 border-red-300 text-red-700 hover:bg-red-50"
          onClick={() => setOpen(true)}
        >
          Delete my account
        </Button>
      ) : (
        <form onSubmit={handleDelete} className="mt-4 flex flex-col gap-4">
          <div className="flex gap-3 rounded-md bg-red-50 p-4 text-sm text-red-800">
            <AlertTriangle className="h-5 w-5 flex-shrink-0" aria-hidden />
            <div>
              <p className="font-medium">This cannot be undone. We delete:</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>your profile, journal entries and cycle data</li>
                <li>
                  households where you are the only member, with their recipes,
                  routines, meal plans and grocery lists
                </li>
                <li>
                  your HealthHub Pro subscription, which is cancelled right away
                </li>
              </ul>
              <p className="mt-2">
                Households you share with others keep their recipes and plans.
              </p>
            </div>
          </div>

          {hasPassword ? (
            <div>
              <label
                htmlFor="delete-account-password"
                className="mb-1.5 block text-sm font-medium text-gray-700"
              >
                Your password
              </label>
              <Input
                id="delete-account-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          ) : (
            <p className="text-sm text-gray-600">
              If you signed in more than 24 hours ago, sign out and sign in
              again first.
            </p>
          )}

          <div>
            <label
              htmlFor="delete-account-confirm"
              className="mb-1.5 block text-sm font-medium text-gray-700"
            >
              Type {CONFIRM_WORD} to confirm
            </label>
            <Input
              id="delete-account-confirm"
              autoComplete="off"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-red-700">
              {error}
            </p>
          )}

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={close}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button type="submit" variant="destructive" disabled={!canDelete}>
              {isDeleting ? 'Deleting...' : 'Permanently delete account'}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
