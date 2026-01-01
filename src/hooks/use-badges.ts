import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type BadgeType =
  | 'author'
  | 'experienced_author'
  | 'legend'
  | 'man'
  | 'expert'
  | 'sage'
  | 'partner'
  | 'founder'
  | 'moderator_badge'
  | 'referrer'
  | 'hustler'
  | 'ambassador';

export interface Badge {
  type: BadgeType;
  name: string;
  emoji: string;
  priority: number;
  isManual: boolean;
  grantedAt: string;
}

// Badge display info
const BADGE_INFO: Record<BadgeType, { name: string; emoji: string; priority: number }> = {
  // Staff (highest priority)
  founder: { name: 'Основатель', emoji: '👑', priority: 100 },
  moderator_badge: { name: 'Модератор', emoji: '🛡️', priority: 90 },
  partner: { name: 'Партнёр', emoji: '🤝', priority: 80 },
  // Publication
  legend: { name: 'Легенда', emoji: '🏆', priority: 70 },
  sage: { name: 'Мудрец', emoji: '🧙', priority: 65 },
  ambassador: { name: 'Амбассадор', emoji: '🌟', priority: 60 },
  experienced_author: { name: 'Опытный автор', emoji: '✍️', priority: 50 },
  expert: { name: 'Эксперт', emoji: '🎓', priority: 45 },
  hustler: { name: 'Хастлер', emoji: '🔥', priority: 40 },
  author: { name: 'Автор', emoji: '📝', priority: 30 },
  man: { name: 'Мужчина', emoji: '💪', priority: 25 },
  referrer: { name: 'Рефер', emoji: '👥', priority: 20 },
};

export function getBadgeInfo(type: BadgeType): { name: string; emoji: string; priority: number } {
  return BADGE_INFO[type] || { name: type, emoji: '🏅', priority: 0 };
}

export function useBadges() {
  const [loading, setLoading] = useState(false);

  // Fetch badges for a specific user profile
  const getUserBadges = useCallback(async (userProfileId: string): Promise<Badge[]> => {
    if (!userProfileId) return [];

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_badges')
        .select('badge, is_manual, granted_at')
        .eq('user_profile_id', userProfileId)
        .order('granted_at', { ascending: false });

      if (error) {
        console.error('Error fetching badges:', error);
        return [];
      }

      return (data || []).map((row: any) => {
        const badgeType = row.badge as BadgeType;
        const info = getBadgeInfo(badgeType);
        return {
          type: badgeType,
          name: info.name,
          emoji: info.emoji,
          priority: info.priority,
          isManual: row.is_manual,
          grantedAt: row.granted_at,
        };
      }).sort((a, b) => b.priority - a.priority);
    } catch (err) {
      console.error('Error in getUserBadges:', err);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // Get the highest priority badge for display
  const getTopBadge = useCallback(async (userProfileId: string): Promise<Badge | null> => {
    const badges = await getUserBadges(userProfileId);
    return badges.length > 0 ? badges[0] : null;
  }, [getUserBadges]);

  return {
    getUserBadges,
    getTopBadge,
    getBadgeInfo,
    loading,
  };
}
