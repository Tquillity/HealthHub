'use client';

import { useState } from 'react';
import { Check, Link as LinkIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUIStore } from '@/lib/store';
import { cn } from '@/lib/utils';

/** Copies the absolute invite link. Falls back to a prompt where the clipboard is unavailable. */
export function CopyInviteLinkButton({
  path,
  email,
  className,
}: {
  path: string;
  email: string;
  className?: string;
}) {
  const showToast = useUIStore((state) => state.showToast);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const url = `${window.location.origin}${path}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      showToast('Invite link copied. Send it to them however you like.', 'success');
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      window.prompt('Copy this invite link', url);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleCopy}
      className={cn('gap-2', className)}
      aria-label={`Copy invite link for ${email}`}
    >
      {copied ? (
        <Check className="h-4 w-4" aria-hidden />
      ) : (
        <LinkIcon className="h-4 w-4" aria-hidden />
      )}
      {copied ? 'Copied' : 'Copy link'}
    </Button>
  );
}
