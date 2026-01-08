'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Heart } from 'lucide-react';
import { toggleResourceLike } from '@/actions/education-actions';

interface LearnDetailClientProps {
  resourceId: string;
  initialLikes: number;
}

export function LearnDetailClient({ resourceId, initialLikes }: LearnDetailClientProps) {
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
      <Button
        onClick={handleLike}
        disabled={isLiking}
        variant="outline"
        className="gap-2"
      >
        <Heart className="h-4 w-4" />
        {isLiking ? 'Liking...' : `Like (${likes})`}
      </Button>
    </div>
  );
}

