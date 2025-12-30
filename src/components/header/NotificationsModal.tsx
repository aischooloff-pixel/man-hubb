import { useState, useEffect } from 'react';
import { X, Heart, MessageSquare, TrendingUp, Check, FileText, Star, Bookmark, Loader2, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useTelegram } from '@/hooks/use-telegram';
import { useNavigate } from 'react-router-dom';

interface NotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Notification {
  id: string;
  type: 'like' | 'comment' | 'rep' | 'article_approved' | 'article_rejected' | 'favorite';
  message: string;
  is_read: boolean;
  created_at: string;
  article_id?: string | null;
  article?: { id: string; title: string; topic?: string } | null;
  from_user?: { id: string; first_name: string | null; last_name: string | null; username: string | null; avatar_url: string | null } | null;
}

type FilterType = 'all' | 'likes' | 'comments' | 'rep' | 'articles' | 'favorites';

export function NotificationsModal({ isOpen, onClose }: NotificationsModalProps) {
  const { webApp } = useTelegram();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('all');
  const [showAll, setShowAll] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const handleNotificationClick = (notification: Notification) => {
    const articleId = notification.article_id || notification.article?.id;
    if (articleId) {
      onClose();
      // Dispatch custom event to open article modal on current page
      const event = new CustomEvent('open-article-detail', { detail: { articleId } });
      window.dispatchEvent(event);
    }
  };

  const fetchNotifications = async (filterType: FilterType = 'all') => {
    if (!webApp?.initData) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('tg-notifications', {
        body: { 
          initData: webApp.initData, 
          filter: filterType,
          limit: 100 
        },
      });

      if (!error && data) {
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (err) {
      console.error('Error fetching notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && webApp?.initData) {
      fetchNotifications(filter);
    }
  }, [isOpen, webApp?.initData, filter]);

  const handleMarkAllRead = async () => {
    if (!webApp?.initData) return;

    try {
      await supabase.functions.invoke('tg-notifications', {
        body: { initData: webApp.initData, action: 'mark_all_read' },
      });
      
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Error marking all as read:', err);
    }
  };

  const getIcon = (type: Notification['type']) => {
    switch (type) {
      case 'like':
        return <Heart className="h-4 w-4 text-red-500" />;
      case 'comment':
        return <MessageSquare className="h-4 w-4 text-blue-500" />;
      case 'rep':
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'article_approved':
        return <Check className="h-4 w-4 text-green-500" />;
      case 'article_rejected':
        return <X className="h-4 w-4 text-red-500" />;
      case 'favorite':
        return <Bookmark className="h-4 w-4 text-yellow-500" />;
      default:
        return <Star className="h-4 w-4 text-primary" />;
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'только что';
    if (minutes < 60) return `${minutes} мин назад`;
    if (hours < 24) return `${hours} ч назад`;
    if (days < 7) return `${days} дн назад`;
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  };

  const filters: { key: FilterType; label: string }[] = [
    { key: 'all', label: 'Все' },
    { key: 'likes', label: 'Лайки' },
    { key: 'comments', label: 'Комментарии' },
    { key: 'rep', label: 'Репутация' },
    { key: 'articles', label: 'Статьи' },
    { key: 'favorites', label: 'Избранное' },
  ];

  const displayedNotifications = showAll ? notifications : notifications.slice(0, 5);

  if (!isOpen) return null;

  // Full screen mode
  if (showAll) {
    return (
      <div className="fixed inset-0 z-[100] bg-background">
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border p-4">
            <div className="flex items-center gap-2">
              <h2 className="font-heading text-lg font-semibold">Уведомления</h2>
              {unreadCount > 0 && (
                <span className="rounded-full bg-foreground px-2 py-0.5 text-xs text-background">
                  {unreadCount}
                </span>
              )}
            </div>
            <Button variant="ghost" size="icon" onClick={() => setShowAll(false)}>
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Filters */}
          <div className="border-b border-border p-3 overflow-x-auto">
            <div className="flex gap-2">
              {filters.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors',
                    filter === f.key
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary text-muted-foreground hover:bg-secondary/80'
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : notifications.length > 0 ? (
              <div className="divide-y divide-border">
                {notifications.map((notification) => {
                  const hasArticle = notification.article_id || notification.article?.id;
                  return (
                    <div
                      key={notification.id}
                      onClick={() => handleNotificationClick(notification)}
                      className={cn(
                        'flex items-start gap-3 p-4 transition-colors',
                        !notification.is_read && 'bg-secondary/30',
                        hasArticle && 'cursor-pointer hover:bg-secondary/50'
                      )}
                    >
                      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-secondary">
                        {getIcon(notification.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm">{notification.message}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{formatTime(notification.created_at)}</p>
                      </div>
                      {!notification.is_read && (
                        <div className="h-2 w-2 flex-shrink-0 rounded-full bg-foreground mt-2" />
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-12">Нет уведомлений</p>
            )}
          </div>

          {/* Mark all as read */}
          {unreadCount > 0 && (
            <div className="p-4 border-t border-border">
              <Button variant="outline" className="w-full" onClick={handleMarkAllRead}>
                Прочесть все
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-background/80 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className={cn(
          'absolute inset-x-0 bottom-0 max-h-[80vh] overflow-y-auto rounded-t-2xl bg-card animate-slide-up',
          'md:inset-auto md:right-4 md:top-16 md:w-96 md:rounded-lg md:shadow-xl'
        )}
      >
        {/* Handle bar for mobile */}
        <div className="sticky top-0 z-10 flex justify-center bg-card pt-3 md:hidden">
          <div className="h-1 w-12 rounded-full bg-border" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between border-b border-border p-4">
          <div className="flex items-center gap-2">
            <h2 className="font-heading text-lg font-semibold">Уведомления</h2>
            {unreadCount > 0 && (
              <span className="rounded-full bg-foreground px-2 py-0.5 text-xs text-background">
                {unreadCount}
              </span>
            )}
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Notifications list */}
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : displayedNotifications.length > 0 ? (
          <div className="divide-y divide-border">
            {displayedNotifications.map((notification) => {
              const hasArticle = notification.article_id || notification.article?.id;
              return (
                <div
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={cn(
                    'flex items-start gap-3 p-4 transition-colors',
                    !notification.is_read && 'bg-secondary/30',
                    hasArticle && 'cursor-pointer hover:bg-secondary/50'
                  )}
                >
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-secondary">
                    {getIcon(notification.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">{notification.message}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{formatTime(notification.created_at)}</p>
                  </div>
                  {!notification.is_read && (
                    <div className="h-2 w-2 flex-shrink-0 rounded-full bg-foreground mt-2" />
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-center text-muted-foreground py-8">Нет уведомлений</p>
        )}

        {/* Actions */}
        <div className="p-4 space-y-2">
          {notifications.length > 5 && (
            <Button variant="outline" className="w-full gap-2" onClick={() => setShowAll(true)}>
              <ChevronDown className="h-4 w-4" />
              Смотреть все
            </Button>
          )}
          {unreadCount > 0 && (
            <Button variant="outline" className="w-full" onClick={handleMarkAllRead}>
              Прочесть все
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
