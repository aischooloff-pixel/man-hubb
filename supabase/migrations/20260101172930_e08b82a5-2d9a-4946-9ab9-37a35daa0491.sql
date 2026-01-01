-- Create enum for badge types
CREATE TYPE public.badge_type AS ENUM (
  -- Publication badges
  'author',           -- 3 articles
  'experienced_author', -- 10 articles
  'legend',           -- 30 articles
  -- Reputation badges
  'man',              -- 50 RP
  'expert',           -- 200 RP
  'sage',             -- 1000 RP (manual)
  -- Partnership
  'partner',          -- manual
  -- Staff
  'founder',          -- manual
  'moderator_badge',  -- manual (different from app_role)
  -- Referral badges
  'referrer',         -- 5 paying referrals
  'hustler',          -- 10 paying referrals
  'ambassador'        -- 20 paying referrals
);

-- Create user_badges table
CREATE TABLE public.user_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  badge badge_type NOT NULL,
  is_manual boolean NOT NULL DEFAULT false,
  granted_at timestamp with time zone NOT NULL DEFAULT now(),
  granted_by_telegram_id bigint,
  UNIQUE(user_profile_id, badge)
);

-- Enable RLS
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Badges are viewable by everyone"
ON public.user_badges FOR SELECT
USING (true);

CREATE POLICY "Service role can manage badges"
ON public.user_badges FOR ALL
USING (true)
WITH CHECK (true);

-- Function to get badge display info
CREATE OR REPLACE FUNCTION public.get_badge_display(p_badge badge_type)
RETURNS TABLE(name text, emoji text, priority int)
LANGUAGE sql
STABLE
AS $$
  SELECT 
    CASE p_badge
      -- Staff (highest priority)
      WHEN 'founder' THEN 'Основатель'
      WHEN 'moderator_badge' THEN 'Модератор'
      WHEN 'partner' THEN 'Партнёр'
      -- Publication
      WHEN 'legend' THEN 'Легенда'
      WHEN 'experienced_author' THEN 'Опытный автор'
      WHEN 'author' THEN 'Автор'
      -- Reputation
      WHEN 'sage' THEN 'Мудрец'
      WHEN 'expert' THEN 'Эксперт'
      WHEN 'man' THEN 'Мужчина'
      -- Referral
      WHEN 'ambassador' THEN 'Амбассадор'
      WHEN 'hustler' THEN 'Хастлер'
      WHEN 'referrer' THEN 'Рефер'
    END,
    CASE p_badge
      WHEN 'founder' THEN '👑'
      WHEN 'moderator_badge' THEN '🛡️'
      WHEN 'partner' THEN '🤝'
      WHEN 'legend' THEN '🏆'
      WHEN 'experienced_author' THEN '✍️'
      WHEN 'author' THEN '📝'
      WHEN 'sage' THEN '🧙'
      WHEN 'expert' THEN '🎓'
      WHEN 'man' THEN '💪'
      WHEN 'ambassador' THEN '🌟'
      WHEN 'hustler' THEN '🔥'
      WHEN 'referrer' THEN '👥'
    END,
    CASE p_badge
      WHEN 'founder' THEN 100
      WHEN 'moderator_badge' THEN 90
      WHEN 'partner' THEN 80
      WHEN 'legend' THEN 70
      WHEN 'sage' THEN 65
      WHEN 'ambassador' THEN 60
      WHEN 'experienced_author' THEN 50
      WHEN 'expert' THEN 45
      WHEN 'hustler' THEN 40
      WHEN 'author' THEN 30
      WHEN 'man' THEN 25
      WHEN 'referrer' THEN 20
    END;
$$;

-- Function to recalculate automatic badges for a user
CREATE OR REPLACE FUNCTION public.recalculate_user_badges(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_articles_count int;
  v_reputation int;
  v_paying_referrals int;
BEGIN
  -- Get article count
  SELECT COUNT(*) INTO v_articles_count
  FROM articles
  WHERE author_id = p_user_id AND status = 'approved';

  -- Get reputation
  SELECT COALESCE(reputation, 0) INTO v_reputation
  FROM profiles
  WHERE id = p_user_id;

  -- Get paying referrals count
  SELECT COUNT(DISTINCT referred_id) INTO v_paying_referrals
  FROM referral_earnings
  WHERE referrer_id = p_user_id;

  -- Publication badges (only add, never remove)
  IF v_articles_count >= 3 THEN
    INSERT INTO user_badges (user_profile_id, badge, is_manual)
    VALUES (p_user_id, 'author', false)
    ON CONFLICT (user_profile_id, badge) DO NOTHING;
  END IF;

  IF v_articles_count >= 10 THEN
    INSERT INTO user_badges (user_profile_id, badge, is_manual)
    VALUES (p_user_id, 'experienced_author', false)
    ON CONFLICT (user_profile_id, badge) DO NOTHING;
  END IF;

  IF v_articles_count >= 30 THEN
    INSERT INTO user_badges (user_profile_id, badge, is_manual)
    VALUES (p_user_id, 'legend', false)
    ON CONFLICT (user_profile_id, badge) DO NOTHING;
  END IF;

  -- Reputation badges (man and expert are automatic, sage is manual)
  IF v_reputation >= 50 THEN
    INSERT INTO user_badges (user_profile_id, badge, is_manual)
    VALUES (p_user_id, 'man', false)
    ON CONFLICT (user_profile_id, badge) DO NOTHING;
  END IF;

  IF v_reputation >= 200 THEN
    INSERT INTO user_badges (user_profile_id, badge, is_manual)
    VALUES (p_user_id, 'expert', false)
    ON CONFLICT (user_profile_id, badge) DO NOTHING;
  END IF;

  -- Referral badges
  IF v_paying_referrals >= 5 THEN
    INSERT INTO user_badges (user_profile_id, badge, is_manual)
    VALUES (p_user_id, 'referrer', false)
    ON CONFLICT (user_profile_id, badge) DO NOTHING;
  END IF;

  IF v_paying_referrals >= 10 THEN
    INSERT INTO user_badges (user_profile_id, badge, is_manual)
    VALUES (p_user_id, 'hustler', false)
    ON CONFLICT (user_profile_id, badge) DO NOTHING;
  END IF;

  IF v_paying_referrals >= 20 THEN
    INSERT INTO user_badges (user_profile_id, badge, is_manual)
    VALUES (p_user_id, 'ambassador', false)
    ON CONFLICT (user_profile_id, badge) DO NOTHING;
  END IF;
END;
$$;

-- Trigger to recalculate badges when article is approved
CREATE OR REPLACE FUNCTION public.trigger_recalculate_badges_on_article()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'approved' AND (OLD IS NULL OR OLD.status != 'approved') THEN
    PERFORM recalculate_user_badges(NEW.author_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_article_approved
AFTER INSERT OR UPDATE ON articles
FOR EACH ROW
EXECUTE FUNCTION trigger_recalculate_badges_on_article();

-- Trigger to recalculate badges when reputation changes
CREATE OR REPLACE FUNCTION public.trigger_recalculate_badges_on_reputation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM recalculate_user_badges(NEW.id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_reputation_changed
AFTER UPDATE OF reputation ON profiles
FOR EACH ROW
EXECUTE FUNCTION trigger_recalculate_badges_on_reputation();

-- Trigger to recalculate badges when referral earning is added
CREATE OR REPLACE FUNCTION public.trigger_recalculate_badges_on_referral()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM recalculate_user_badges(NEW.referrer_id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_referral_earning_added
AFTER INSERT ON referral_earnings
FOR EACH ROW
EXECUTE FUNCTION trigger_recalculate_badges_on_referral();