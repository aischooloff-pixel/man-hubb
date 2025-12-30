import { useState, useEffect } from 'react';
import { X, BookOpen, Users, Sparkles, MessageCircle, Crown, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface WelcomeModalProps {
  onClose: () => void;
}

const WELCOME_STORAGE_KEY = 'manhub_welcome_shown';

export function WelcomeModal({ onClose }: WelcomeModalProps) {
  const [step, setStep] = useState(0);

  const steps = [
    {
      icon: BookOpen,
      title: 'Добро пожаловать в ManHub!',
      description: 'Платформа для обмена знаниями и опытом. Читайте статьи, слушайте подкасты и развивайтесь вместе с сообществом.',
    },
    {
      icon: Users,
      title: 'Сообщество авторов',
      description: 'Пишите свои статьи, делитесь опытом и получайте репутацию от других участников за полезный контент.',
    },
    {
      icon: MessageCircle,
      title: 'Общение и обсуждения',
      description: 'Комментируйте статьи, задавайте вопросы авторам и участвуйте в дискуссиях с единомышленниками.',
    },
    {
      icon: Crown,
      title: 'Premium возможности',
      description: 'Получите безлимитные публикации, приоритетную модерацию и эксклюзивный PRO значок с Premium подпиской.',
    },
  ];

  const currentStep = steps[step];
  const isLastStep = step === steps.length - 1;

  const handleNext = () => {
    if (isLastStep) {
      localStorage.setItem(WELCOME_STORAGE_KEY, 'true');
      onClose();
    } else {
      setStep(step + 1);
    }
  };

  const handleSkip = () => {
    localStorage.setItem(WELCOME_STORAGE_KEY, 'true');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[200]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-background/95 backdrop-blur-md animate-fade-in" />

      {/* Modal */}
      <div className="absolute inset-0 flex items-center justify-center p-6 animate-scale-in">
        <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-xl">
          {/* Close/Skip */}
          <div className="flex justify-end mb-4">
            <Button variant="ghost" size="sm" onClick={handleSkip} className="text-muted-foreground">
              Пропустить
            </Button>
          </div>

          {/* Icon */}
          <div className="mb-6 flex justify-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10">
              <currentStep.icon className="h-10 w-10 text-primary" />
            </div>
          </div>

          {/* Content */}
          <div className="mb-8 text-center">
            <h2 className="mb-3 font-heading text-2xl font-bold">{currentStep.title}</h2>
            <p className="text-muted-foreground">{currentStep.description}</p>
          </div>

          {/* Progress Dots */}
          <div className="mb-6 flex justify-center gap-2">
            {steps.map((_, index) => (
              <button
                key={index}
                onClick={() => setStep(index)}
                className={cn(
                  'h-2 rounded-full transition-all',
                  index === step ? 'w-6 bg-primary' : 'w-2 bg-muted-foreground/30'
                )}
              />
            ))}
          </div>

          {/* Next Button */}
          <Button onClick={handleNext} className="w-full gap-2" size="lg">
            {isLastStep ? (
              <>
                <Sparkles className="h-4 w-4" />
                Начать
              </>
            ) : (
              <>
                Далее
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function useWelcomeModal() {
  const [showWelcome, setShowWelcome] = useState(false);

  useEffect(() => {
    const hasShown = localStorage.getItem(WELCOME_STORAGE_KEY);
    
    // Only show welcome modal if it hasn't been shown before
    if (!hasShown) {
      // Small delay to let the page load first
      const timer = setTimeout(() => setShowWelcome(true), 500);
      return () => clearTimeout(timer);
    }
  }, []);

  const closeWelcome = () => {
    // Mark as shown when closing
    localStorage.setItem(WELCOME_STORAGE_KEY, 'true');
    setShowWelcome(false);
  };

  return {
    showWelcome,
    closeWelcome,
  };
}