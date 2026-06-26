import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface UseExamMonitorProps {
  examId: string;
  isActive: boolean;
  onExamClosed: () => void;
  userId: string;
}

export const useExamMonitor = ({ examId, isActive, onExamClosed, userId }: UseExamMonitorProps) => {
  const abandonCountRef = useRef(0);
  const maxAbandonAttempts = 2; // Número máximo de veces que puede salir antes de cerrar el examen

  const handleAbandon = useCallback(async () => {
    if (!isActive) return;

    abandonCountRef.current += 1;

    // Registrar el intento de abandono en la base de datos
    try {
      await supabase.from('notifications').insert({
        user_id: userId,
        type: 'exam_abandoned',
        title: `Abandono detectado en examen`,
        message: `Se detectó que saliste del examen. Intento ${abandonCountRef.current} de ${maxAbandonAttempts}`,
        is_read: false,
      });
    } catch (error) {
      console.error('Error registering abandon attempt:', error);
    }

    // Si excede el número máximo de intentos, cerrar el examen
    if (abandonCountRef.current >= maxAbandonAttempts) {
      onExamClosed();
    }
  }, [isActive, examId, userId, onExamClosed]);

  useEffect(() => {
    if (!isActive) return;

    // Detectar cuando el usuario cambia de pestaña o minimiza la ventana
    const handleVisibilityChange = () => {
      if (document.hidden) {
        handleAbandon();
      }
    };

    // Detectar cuando la ventana pierde el foco
    const handleBlur = () => {
      handleAbandon();
    };

    // Detectar cuando el usuario intenta cerrar la pestaña o navegar fuera
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      handleAbandon();
      return (e.returnValue = '¿Estás seguro de que quieres salir del examen? Esto contará como un intento de abandono.');
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isActive, handleAbandon]);

  return { abandonCount: abandonCountRef.current, maxAbandonAttempts };
};
