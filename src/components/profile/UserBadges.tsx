import { useEffect, useState } from 'react';
import { Badge, BadgeType, getBadgeInfo, useBadges } from '@/hooks/use-badges';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface UserBadgesProps {
  userProfileId: string;
  variant?: 'full' | 'inline' | 'top';
  className?: string;
}

export function UserBadges({ userProfileId, variant = 'full', className }: UserBadgesProps) {
  const { getUserBadges } = useBadges();
  const [badges, setBadges] = useState<Badge[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userProfileId) return;
    
    setLoading(true);
    getUserBadges(userProfileId).then((data) => {
      setBadges(data);
      setLoading(false);
    });
  }, [userProfileId, getUserBadges]);

  if (loading || badges.length === 0) return null;

  // Top variant - show only highest priority badge
  if (variant === 'top') {
    const topBadge = badges[0];
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className={cn('text-sm cursor-help', className)}>
              {topBadge.emoji}
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <p>{topBadge.name}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Inline variant - show badges as emoji row
  if (variant === 'inline') {
    return (
      <TooltipProvider>
        <span className={cn('inline-flex items-center gap-0.5', className)}>
          {badges.slice(0, 3).map((badge) => (
            <Tooltip key={badge.type}>
              <TooltipTrigger asChild>
                <span className="text-xs cursor-help">{badge.emoji}</span>
              </TooltipTrigger>
              <TooltipContent>
                <p>{badge.name}</p>
              </TooltipContent>
            </Tooltip>
          ))}
          {badges.length > 3 && (
            <span className="text-xs text-muted-foreground">+{badges.length - 3}</span>
          )}
        </span>
      </TooltipProvider>
    );
  }

  // Full variant - show all badges with names
  return (
    <div className={cn('flex flex-wrap gap-1.5', className)}>
      {badges.map((badge) => (
        <TooltipProvider key={badge.type}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs cursor-help">
                <span>{badge.emoji}</span>
                <span className="text-muted-foreground">{badge.name}</span>
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <p>Получено: {new Date(badge.grantedAt).toLocaleDateString('ru-RU')}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ))}
    </div>
  );
}

// Compact badge display component for article cards
interface AuthorBadgeProps {
  userProfileId: string;
  className?: string;
}

export function AuthorBadge({ userProfileId, className }: AuthorBadgeProps) {
  const { getTopBadge } = useBadges();
  const [badge, setBadge] = useState<Badge | null>(null);

  useEffect(() => {
    if (!userProfileId) return;
    getTopBadge(userProfileId).then(setBadge);
  }, [userProfileId, getTopBadge]);

  if (!badge) return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={cn('text-sm cursor-help', className)}>{badge.emoji}</span>
        </TooltipTrigger>
        <TooltipContent>
          <p>{badge.name}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
