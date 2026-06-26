import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Info, CheckCircle, ChevronRight } from "lucide-react";

interface AdeudosBannerProps {
  studentCode: string;
}

interface FinanceData {
  total_matricula: number;
  total_pagado: number;
  balance: number;
  moneda: string; // <--- NUEVO CAMPO EN LA INTERFAZ
}

const AdeudosBanner = ({ studentCode }: AdeudosBannerProps) => {
  const [financeData, setFinanceData] = useState<FinanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    const fetchBalance = async () => {
      try {
        const { data, error } = await supabase
          .rpc('obtener_balance_estudiante', { codigo_estudiante_input: studentCode });

        if (error) throw error;
        
        if (data && Array.isArray(data) && data.length > 0) {
          setFinanceData(data[0] as FinanceData);
        }
      } catch (error) {
        console.error('Error cargando balance:', error);
      } finally {
        setLoading(false);
      }
    };

    if (studentCode) fetchBalance();
  }, [studentCode]);

  if (loading || !financeData) return null;

  const { balance, moneda } = financeData; // <--- Extraemos la moneda

  return (
    <>
      {balance > 0 ? (
        // CASO DEUDA (Color Rojo Rosado)
        <div className="mb-6 rounded-lg bg-red-50 border border-red-200 p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between shadow-sm animate-fade-in">
          <div className="flex items-center">
            <Info className="h-5 w-5 text-red-500 mr-3 flex-shrink-0" />
            
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
              <span className="text-red-900 font-semibold text-sm">
                Aviso de Pago:
              </span>
              <span className="text-red-700 text-sm">
                Tienes un saldo pendiente de 
                {/* AQUI MOSTRAMOS LA MONEDA DINÁMICA (Ej: PEN 100.00) */}
                <span className="font-bold ml-1">
                   {moneda} {balance.toFixed(2)}
                </span>.
              </span>
              <span className="hidden sm:inline text-red-300">|</span>
              <span className="text-red-600 text-xs sm:text-sm">
                Recuerda regularizar en la fecha acordada.
              </span>
            </div>
          </div>
          
          <button 
            onClick={() => setIsModalOpen(true)}
            className="mt-2 sm:mt-0 ml-0 sm:ml-4 text-red-700 hover:text-red-900 text-sm font-medium flex items-center transition-colors group cursor-pointer"
          >
            Ver Detalle
            <ChevronRight className="h-4 w-4 ml-1 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      ) : (
        // CASO AL DÍA (Verde)
        <div className="mb-6 rounded-lg bg-green-50/50 dark:bg-green-950/30 border border-green-100 dark:border-green-800 p-3 flex items-center justify-between shadow-sm animate-fade-in">
          <div className="flex items-center">
            <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 mr-3 flex-shrink-0" />
            <div>
              <span className="text-green-800 dark:text-green-200 font-medium text-sm">
                Estado financiero al día.
              </span>
              <span className="text-green-600 dark:text-green-400 text-xs ml-2 hidden sm:inline">
                ¡Gracias por tu puntualidad!
              </span>
            </div>
          </div>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="text-green-700 dark:text-green-300 hover:text-green-900 dark:hover:text-green-100 text-sm font-medium flex items-center transition-colors"
          >
            Ver Historial <ChevronRight className="h-4 w-4 ml-1" />
          </button>
        </div>
      )}
    </>
  );
};

export default AdeudosBanner;