import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  Shield, 
  LogOut, 
  FileText, 
  Check, 
  X, 
  Clock,
  ChevronRight,
  RefreshCw,
  Eye
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

interface Article {
  id: string;
  title: string;
  preview: string;
  body: string;
  status: string;
  is_anonymous: boolean;
  created_at: string;
  author: {
    first_name: string;
    username: string;
    telegram_id: number;
  } | null;
}

export default function Admin() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pending');
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [processing, setProcessing] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    checkAuth();
    fetchArticles();
  }, [activeTab]);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      navigate('/admin-auth');
      return;
    }

    // Verify admin role
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', session.user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (!roleData) {
      await supabase.auth.signOut();
      navigate('/admin-auth');
    }
  };

  const fetchArticles = async () => {
    setLoading(true);
    
    const { data, error } = await supabase
      .from('articles')
      .select('*, author:author_id(first_name, username, telegram_id)')
      .eq('status', activeTab)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching articles:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось загрузить статьи',
        variant: 'destructive',
      });
    } else {
      setArticles(data || []);
    }
    
    setLoading(false);
  };

  const handleApprove = async (article: Article) => {
    setProcessing(true);
    
    const { error } = await supabase
      .from('articles')
      .update({ status: 'approved' })
      .eq('id', article.id);

    if (error) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось одобрить статью',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Статья одобрена',
        description: `"${article.title}" опубликована`,
      });
      fetchArticles();
    }
    
    setProcessing(false);
  };

  const handleReject = async () => {
    if (!selectedArticle || !rejectReason.trim()) {
      toast({
        title: 'Ошибка',
        description: 'Укажите причину отклонения',
        variant: 'destructive',
      });
      return;
    }

    setProcessing(true);
    
    const { error } = await supabase
      .from('articles')
      .update({ 
        status: 'rejected',
        rejection_reason: rejectReason 
      })
      .eq('id', selectedArticle.id);

    if (error) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось отклонить статью',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Статья отклонена',
        description: `"${selectedArticle.title}" отклонена`,
      });
      setShowRejectDialog(false);
      setRejectReason('');
      setSelectedArticle(null);
      fetchArticles();
    }
    
    setProcessing(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/admin-auth');
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <span className="flex items-center gap-1 rounded-full bg-yellow-500/20 px-2 py-0.5 text-xs text-yellow-500">
            <Clock className="h-3 w-3" />
            На модерации
          </span>
        );
      case 'approved':
        return (
          <span className="flex items-center gap-1 rounded-full bg-green-500/20 px-2 py-0.5 text-xs text-green-500">
            <Check className="h-3 w-3" />
            Одобрено
          </span>
        );
      case 'rejected':
        return (
          <span className="flex items-center gap-1 rounded-full bg-red-500/20 px-2 py-0.5 text-xs text-red-500">
            <X className="h-3 w-3" />
            Отклонено
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur-sm">
        <div className="flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <Shield className="h-6 w-6 text-primary" />
            <h1 className="font-heading text-lg font-bold">Админ-панель</h1>
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-2" />
            Выйти
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-4">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4 w-full">
            <TabsTrigger value="pending" className="flex-1 gap-2">
              <Clock className="h-4 w-4" />
              На модерации
            </TabsTrigger>
            <TabsTrigger value="approved" className="flex-1 gap-2">
              <Check className="h-4 w-4" />
              Одобренные
            </TabsTrigger>
            <TabsTrigger value="rejected" className="flex-1 gap-2">
              <X className="h-4 w-4" />
              Отклоненные
            </TabsTrigger>
          </TabsList>

          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {articles.length} статей
            </p>
            <Button variant="ghost" size="sm" onClick={fetchArticles} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>

          <TabsContent value={activeTab} className="mt-0">
            <div className="space-y-3">
              {loading ? (
                <div className="py-12 text-center text-muted-foreground">
                  Загрузка...
                </div>
              ) : articles.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  <FileText className="mx-auto mb-2 h-8 w-8" />
                  Нет статей
                </div>
              ) : (
                articles.map((article) => (
                  <div
                    key={article.id}
                    className="rounded-2xl bg-card p-4"
                  >
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <h3 className="font-medium line-clamp-1">{article.title}</h3>
                        <p className="text-xs text-muted-foreground">
                          {/* Admin always sees original author data */}
                          {article.author?.first_name || 'Unknown'}
                          {article.author?.username && ` (@${article.author.username})`}
                          {article.author?.telegram_id && ` • ID: ${article.author.telegram_id}`}
                          {article.is_anonymous && <span className="ml-1 text-yellow-500">(анонимная)</span>}
                        </p>
                      </div>
                      {getStatusBadge(article.status)}
                    </div>
                    
                    <p className="mb-3 text-sm text-muted-foreground line-clamp-2">
                      {article.preview || article.body}
                    </p>

                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        {new Date(article.created_at).toLocaleDateString('ru-RU')}
                      </span>
                      
                      <div className="flex items-center gap-2">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => {
                            setSelectedArticle(article);
                            setShowViewDialog(true);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        
                        {activeTab === 'pending' && (
                          <>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              className="text-green-500 hover:text-green-600 hover:bg-green-500/10"
                              onClick={() => handleApprove(article)}
                              disabled={processing}
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
                              onClick={() => {
                                setSelectedArticle(article);
                                setShowRejectDialog(true);
                              }}
                              disabled={processing}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>
      </main>

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Отклонить статью</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="mb-4 text-sm text-muted-foreground">
              Статья: "{selectedArticle?.title}"
            </p>
            <Textarea
              placeholder="Укажите причину отклонения..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>
              Отмена
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleReject}
              disabled={processing || !rejectReason.trim()}
            >
              Отклонить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedArticle?.title}</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="mb-2 text-sm text-muted-foreground">
              {/* Admin always sees real author in view dialog */}
              Автор: {selectedArticle?.author?.first_name || 'Unknown'}
              {selectedArticle?.author?.username && ` (@${selectedArticle.author.username})`}
              {selectedArticle?.author?.telegram_id && ` • ID: ${selectedArticle.author.telegram_id}`}
              {selectedArticle?.is_anonymous && <span className="ml-1 text-yellow-500">(опубликовано анонимно)</span>}
            </p>
            <div className="prose prose-sm max-w-none">
              <p className="whitespace-pre-wrap">{selectedArticle?.body}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowViewDialog(false)}>
              Закрыть
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}