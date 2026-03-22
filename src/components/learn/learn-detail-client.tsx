'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Heart } from 'lucide-react';
import { toggleResourceLike } from '@/actions/education-actions';

interface LearnDetailClientProps {
  resourceId: string;
  initialLikes: number;
  canLike: boolean;
}

export function LearnDetailClient({
  resourceId,
  initialLikes,
  canLike,
}: LearnDetailClientProps) {
  const [likes, setLikes] = useState(initialLikes);
  const [isLiking, setIsLiking] = useState(false);

  const handleLike = async () => {
    setIsLiking(true);
    const result = await toggleResourceLike(resourceId);
    if (result.success && result.data) {
      setLikes(result.data.likes);
    }
    setIsLiking(false);
  };

  return (
    <div className="mt-8 border-t border-gray-200 pt-6">
      {canLike ? (
        <Button
          onClick={handleLike}
          disabled={isLiking}
          variant="outline"
          className="gap-2"
        >
          <Heart className="h-4 w-4" />
          {isLiking ? 'Liking...' : `Like (${likes})`}
        </Button>
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button variant="outline" className="gap-2" disabled>
            <Heart className="h-4 w-4" />
            Like ({likes})
          </Button>
          <Link href="/sign-in" className="text-sm font-medium text-primary-600 hover:text-primary-700">
            Sign in to like this article
          </Link>
        </div>
      )}
    </div>
  );
}

