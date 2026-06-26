import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Type, Eraser, Pen, RotateCcw, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

// Imports de PDF
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import pdfWorker from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";
import { PDFDocument } from "pdf-lib";

type Props = {
  pdfUrl: string;
  fileName: string;
  submissionId: string;
  storageBucket?: string;
  storagePath?: string | null;
  isPortfolio?: boolean;
};

export interface PdfAnnotatorRef {
  savePdfOnly: () => Promise<boolean>;
}

function safeKeyName(input: string) {
  return input.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "_").replace(/[^a-zA-Z0-9._-]/g, "_");
}
const PdfAnnotator = forwardRef<PdfAnnotatorRef, Props>(({
  pdfUrl, fileName, submissionId, storageBucket = "student-submissions", storagePath = null, isPortfolio = false // <-- Agrégalo aquí
}, ref) => {

  const baseCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  
  const [loading, setLoading] = useState(true);
  const [pdfBytes, setPdfBytes] = useState<ArrayBuffer | null>(null);
  const [pdfDocJs, setPdfDocJs] = useState<any>(null);
  const [pageCount, setPageCount] = useState(1);
  const [pageNum, setPageNum] = useState(1);

  const [tool, setTool] = useState<"pen" | "eraser" | "text">("pen");
  const [color, setColor] = useState("#ff0000"); 
  const [size, setSize] = useState(2);
  
  const [textInput, setTextInput] = useState<{x: number, y: number, text: string, visible: boolean} | null>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [pageOverlays, setPageOverlays] = useState<Record<number, string>>({}); 

  const SCALE = 1.5; 

  useImperativeHandle(ref, () => ({
    savePdfOnly: async () => {
      return await savePdfComplete();
    }
  }));

  useEffect(() => {
    (pdfjsLib as any).GlobalWorkerOptions.workerSrc = pdfWorker;
  }, []);

  // Cargar PDF
  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        let buf: ArrayBuffer;
        if (storagePath) {
             const { data, error } = await supabase.storage.from(storageBucket).download(storagePath);
             if (error) throw error;
             buf = await data.arrayBuffer();
        } else {
            const res = await fetch(pdfUrl);
            buf = await res.arrayBuffer();
        }
        setPdfBytes(buf);
      } catch (err) {
        toast.error("Error cargando PDF");
      } finally { setLoading(false); }
    }
    load();
  }, [pdfUrl, storagePath, storageBucket]);

  // Init JS PDF (VISOR)
  useEffect(() => {
    if (!pdfBytes) return;
    
    // ✅ CORRECCIÓN 1: Usamos .slice(0) para clonar la memoria y evitar crash
    const task = (pdfjsLib as any).getDocument({ data: pdfBytes.slice(0) });
    
    task.promise.then((doc: any) => {
        setPdfDocJs(doc);
        setPageCount(doc.numPages);
    });
  }, [pdfBytes]);

  // Renderizar Página
  useEffect(() => {
    if (!pdfDocJs || !baseCanvasRef.current || !overlayCanvasRef.current) return;
    const render = async () => {
        const page = await pdfDocJs.getPage(pageNum);
        const viewport = page.getViewport({ scale: SCALE });
        
        const base = baseCanvasRef.current!;
        const overlay = overlayCanvasRef.current!;
        
        base.width = viewport.width;
        base.height = viewport.height;
        overlay.width = viewport.width;
        overlay.height = viewport.height;

        const bctx = base.getContext("2d")!;
        await page.render({ canvasContext: bctx, viewport }).promise;

        const octx = overlay.getContext("2d")!;
        octx.clearRect(0,0, overlay.width, overlay.height);
        
        if (pageOverlays[pageNum]) {
            const img = new Image();
            img.onload = () => octx.drawImage(img, 0, 0);
            img.src = pageOverlays[pageNum];
        }
    };
    render();
  }, [pdfDocJs, pageNum, pageOverlays]);

  const getPos = (e: React.PointerEvent | React.MouseEvent) => {
    const rect = overlayCanvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const saveCurrentOverlay = () => {
     if(overlayCanvasRef.current) {
         setPageOverlays(prev => ({ ...prev, [pageNum]: overlayCanvasRef.current!.toDataURL("image/png") }));
     }
  }

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (textInput && textInput.visible) {
        finishText();
        return;
    }
    if (tool === "text") {
        e.preventDefault(); // ✅ CORRECCIÓN 2: Permite que el input de texto funcione
        const { x, y } = getPos(e);
        setTextInput({ x, y, text: "", visible: true });
    } else {
        drawing.current = true;
        last.current = getPos(e);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (tool === "text" || !drawing.current || !overlayCanvasRef.current || !last.current) return;
    const ctx = overlayCanvasRef.current.getContext("2d")!;
    const p = getPos(e);
    
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = size;
    ctx.globalCompositeOperation = tool === "eraser" ? "destination-out" : "source-over";
    ctx.strokeStyle = tool === "eraser" ? "rgba(0,0,0,1)" : color;
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
  };

  const handlePointerUp = () => {
    if(drawing.current) {
        drawing.current = false;
        last.current = null;
        saveCurrentOverlay();
    }
  };

  const finishText = () => {
      if (!textInput || !overlayCanvasRef.current) return;
      if (textInput.text.trim() !== "") {
          const ctx = overlayCanvasRef.current.getContext("2d")!;
          const fontSize = size * 6 + 10;
          ctx.font = `${fontSize}px sans-serif`; 
          ctx.fillStyle = color;
          ctx.globalCompositeOperation = "source-over";
          ctx.fillText(textInput.text, textInput.x, textInput.y + fontSize);
          saveCurrentOverlay();
      }
      setTextInput(null);
  };

  const changePage = (delta: number) => {
      saveCurrentOverlay();
      const next = pageNum + delta;
      if(next >= 1 && next <= pageCount) setPageNum(next);
  }

  const savePdfComplete = async (): Promise<boolean> => {
    if (!pdfBytes) return false;
    try {
      saveCurrentOverlay();

      const pdfDoc = await PDFDocument.load(pdfBytes.slice(0));
      const pages = pdfDoc.getPages();

      for (const [pStr, dataUrl] of Object.entries(pageOverlays)) {
        const pIndex = Number(pStr) - 1;
        if (pIndex < 0 || pIndex >= pages.length) continue;
        const pngImage = await pdfDoc.embedPng(dataUrl);
        const page = pages[pIndex];
        page.drawImage(pngImage, { x: 0, y: 0, width: page.getWidth(), height: page.getHeight() });
      }

      //const pdfBytesFinal: Uint8Array = await pdfDoc.save();
      //const blob = new Blob([pdfBytesFinal.buffer], { type: "application/pdf" }); 

      const pdfBytesFinal = await pdfDoc.save();
      const blob = new Blob([pdfBytesFinal], { type: "application/pdf" });
      const safeName = safeKeyName(fileName);

      // --- LÓGICA DE RUTA ---
      // Si es portafolio, usamos la ruta original (storagePath) para SOBRESCRIBIR
      // Si es tarea, creamos una ruta nueva en feedback/
      const finalPath = isPortfolio && storagePath 
        ? storagePath 
        : `feedback/annotated_${Date.now()}_${safeName}`;

      // --- SUBIDA AL STORAGE ---
      // Usamos upsert: true para que si el archivo existe (Portafolio), lo reemplace
      const { error: upErr } = await supabase.storage
        .from(storageBucket)
        .upload(finalPath, blob, { upsert: true });

      if (upErr) throw upErr;

      // --- ACTUALIZACIÓN DE BASE DE DATOS ---
      if (isPortfolio) {
        // CASO PORTAFOLIO: Solo nos aseguramos que el path sea el correcto
        const { error: dbErr } = await supabase
          .from("edition_portfolio_submissions")
          .update({ file_path: finalPath })
          .eq("id", submissionId);
        
        if (dbErr) throw dbErr;
      } else {
        // CASO TAREAS (Tu lógica original intacta)
        const newFile = {
          bucket: storageBucket,
          path: finalPath,
          fileName: `Corregido_${safeName}`,
          mimeType: "application/pdf",
          fileSize: blob.size,
          file_size: blob.size,
          createdAt: new Date().toISOString()
        };

        const { data: currentData } = await supabase
          .from("assignment_submissions")
          .select("feedback_files")
          .eq("id", submissionId)
          .single();

        const existingFiles = (currentData?.feedback_files as any[]) || [];
        
        const { error: dbErr } = await supabase
          .from("assignment_submissions")
          .update({ feedback_files: [...existingFiles, newFile] })
          .eq("id", submissionId);

        if (dbErr) throw dbErr;
      }

      return true;
    } catch (err: any) {
      console.error(err);
      toast.error("Error generando PDF: " + err.message);
      return false;
    }
  };

  if (loading) return <div className="flex justify-center p-10"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="flex flex-col h-full w-full bg-slate-50 relative">
      <div className="bg-white border-b px-4 py-2 flex items-center justify-between shadow-sm z-10 sticky top-0">
        <div className="flex items-center gap-2">
            <Button variant={tool === "pen" ? "default" : "ghost"} size="sm" onClick={() => setTool("pen")} title="Lápiz"><Pen className="w-4 h-4" /></Button>
            <Button variant={tool === "text" ? "default" : "ghost"} size="sm" onClick={() => setTool("text")} title="Texto"><Type className="w-4 h-4" /></Button>
            <Button variant={tool === "eraser" ? "default" : "ghost"} size="sm" onClick={() => setTool("eraser")} title="Borrador"><Eraser className="w-4 h-4" /></Button>
            <div className="h-6 w-px bg-gray-300 mx-2" />
            <input type="color" value={color} onChange={e => setColor(e.target.value)} className="h-8 w-8 cursor-pointer rounded" />
            <Button variant="ghost" size="sm" onClick={() => {
                const ctx = overlayCanvasRef.current?.getContext("2d");
                if(ctx && overlayCanvasRef.current) ctx.clearRect(0,0, overlayCanvasRef.current.width, overlayCanvasRef.current.height);
                setPageOverlays(prev => { const n = {...prev}; delete n[pageNum]; return n; });
            }} title="Limpiar Página"><RotateCcw className="w-4 h-4" /></Button>
        </div>
        <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => changePage(-1)} disabled={pageNum <= 1}><ChevronLeft className="w-4 h-4" /></Button>
            <span className="text-sm font-medium w-12 text-center">{pageNum} / {pageCount}</span>
            <Button variant="outline" size="sm" onClick={() => changePage(1)} disabled={pageNum >= pageCount}><ChevronRight className="w-4 h-4" /></Button>
        </div>
      </div>
      
      <div className="flex-1 overflow-auto bg-slate-200 flex justify-center p-8">
        <div className="relative shadow-lg border bg-white" style={{ width: 'fit-content', height: 'fit-content' }}>
            <canvas ref={baseCanvasRef} className="block" />
            <canvas 
                ref={overlayCanvasRef}
                className={`absolute inset-0 touch-none ${tool === 'text' ? 'cursor-text' : 'cursor-crosshair'}`}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
            />
            {textInput && textInput.visible && (
                <input
                    autoFocus
                    value={textInput.text}
                    onChange={(e) => setTextInput({ ...textInput, text: e.target.value })}
                    onKeyDown={(e) => e.key === "Enter" && finishText()}
                    onBlur={finishText}
                    style={{
                        position: 'absolute',
                        left: textInput.x,
                        top: textInput.y,
                        color: color,
                        fontSize: `${size * 6 + 10}px`,
                        background: 'transparent',
                        border: '1px dashed #3b82f6',
                        outline: 'none',
                        minWidth: '50px'
                    }}
                />
            )}
        </div>
      </div>
    </div>
  );
});

export default PdfAnnotator;
