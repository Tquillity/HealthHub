import { getInitials } from '@/lib/initials';
import { cn } from '@/lib/utils';

export function MemberAvatar({
  name,
  image,
  id,
  className,
}: {
  name: string;
  image: string | null;
  id?: string;
  className?: string;
}) {
  if (image) {
    // Plain <img>: avatars come from sign-in providers that next/image is not configured for.
    return (
      <img
        id={id}
        src={image}
        alt=""
        className={cn('h-10 w-10 shrink-0 rounded-full object-cover', className)}
        referrerPolicy="no-referrer"
      />
    );
  }
  return (
    <span
      id={id}
      aria-hidden
      className={cn(
        'flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-100 text-sm font-semibold text-primary-700',
        className
      )}
    >
      {getInitials(name)}
    </span>
  );
}
