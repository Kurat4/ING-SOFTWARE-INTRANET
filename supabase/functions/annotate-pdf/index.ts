import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PageImages {
  [pageNum: string]: string; // dataURL of PNG image
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const {
      storageBucket = "student-submissions",
      storagePath,
      pdfUrl,
      fileName,
      submissionId,
      pageImages
    } = await req.json();

    console.log("Processing PDF annotation request:", { 
      storagePath, 
      fileName, 
      submissionId,
      pageCount: pageImages ? Object.keys(pageImages).length : 0
    });

    // Validar parámetros requeridos
    if (!fileName) {
      throw new Error("fileName is required");
    }
    if (!submissionId) {
      throw new Error("submissionId is required");
    }
    if (!pageImages || typeof pageImages !== "object") {
      throw new Error("pageImages must be an object");
    }
    if (Object.keys(pageImages).length === 0) {
      throw new Error("No pages to annotate");
    }
    if (!storagePath && !pdfUrl) {
      throw new Error("Either storagePath or pdfUrl must be provided");
    }

    // 1. Descargar PDF original
    let pdfBytes: ArrayBuffer;
    
    if (storagePath) {
      const { data, error } = await supabase.storage
        .from(storageBucket)
        .download(storagePath);
      
      if (error) throw error;
      pdfBytes = await data.arrayBuffer();
    } else if (pdfUrl) {
      const response = await fetch(pdfUrl);
      if (!response.ok) throw new Error(`Failed to fetch PDF: ${response.status}`);
      pdfBytes = await response.arrayBuffer();
    } else {
      throw new Error("No storagePath or pdfUrl provided");
    }

    // 2. Cargar PDF con pdf-lib
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const pages = pdfDoc.getPages();

    // 3. Superponer imágenes PNG ya renderizadas
    let annotatedCount = 0;

    for (const [pageNumStr, dataUrl] of Object.entries(pageImages as PageImages)) {
      const pageNum = parseInt(pageNumStr);
      if (pageNum < 1 || pageNum > pages.length) continue;

      const page = pages[pageNum - 1];
      const { width, height } = page.getSize();

      // Convertir dataURL a bytes
      const base64Data = dataUrl.split(',')[1];
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Embed PNG
      const pngImage = await pdfDoc.embedPng(bytes);

      // Superponer en la página
      page.drawImage(pngImage, {
        x: 0,
        y: 0,
        width,
        height,
      });

      annotatedCount++;
    }

    if (annotatedCount === 0) {
      throw new Error("No annotations to save");
    }

    // 4. Guardar PDF con anotaciones
    const annotatedPdfBytes = await pdfDoc.save();

    // 5. Generar nombre y subir a Storage
    // SIEMPRE crear un nuevo archivo con timestamp para evitar problemas de caché
    // y para que el usuario vea claramente que hay una nueva versión
    let annotatedPath: string;
    let annotatedFileName: string;
    
    // Extraer el nombre base del archivo (sin la carpeta feedback/ y sin el prefijo annotated_)
    let baseFileName = fileName;
    
    if (storagePath && storagePath.startsWith("feedback/")) {
      // Si estamos editando un feedback existente, extraer el nombre base
      const pathParts = storagePath.split("/");
      const existingFileName = pathParts[pathParts.length - 1];
      
      // Remover el prefijo "annotated_TIMESTAMP_" si existe
      const match = existingFileName.match(/^annotated_\d+_(.+)$/);
      if (match) {
        baseFileName = match[1]; // Mantener solo el nombre original
      } else {
        baseFileName = existingFileName;
      }
      
      console.log("Editing existing feedback, extracted base name:", baseFileName);
    }
    
    // Crear nuevo nombre con timestamp actualizado
    const safeFileName = baseFileName
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, "_")
      .replace(/[^a-zA-Z0-9._-]/g, "_");
    
    annotatedFileName = `annotated_${Date.now()}_${safeFileName}`;
    annotatedPath = `feedback/${submissionId}/${annotatedFileName}`;
    
    console.log("Creating new feedback file:", { annotatedPath, baseFileName, annotatedFileName });

    console.log("Uploading to storage:", { storageBucket, annotatedPath, size: annotatedPdfBytes.byteLength });

    const { error: uploadError } = await supabase.storage
      .from(storageBucket)
      .upload(annotatedPath, annotatedPdfBytes, {
        contentType: "application/pdf",
        upsert: false, // No sobrescribir, siempre crear nuevo archivo
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      throw uploadError;
    }

    console.log("File uploaded successfully");

    // 6. Actualizar base de datos - REEMPLAZAR archivo existente en lugar de agregar
    console.log("Fetching submission:", submissionId);
    
    const { data: submission, error: fetchError } = await supabase
      .from("assignment_submissions")
      .select("feedback_files")
      .eq("id", submissionId)
      .single();

    if (fetchError) {
      console.error("Fetch error:", fetchError);
      throw fetchError;
    }

    // Obtener archivos existentes
    const existingFiles = Array.isArray(submission.feedback_files) ? submission.feedback_files : [];
    
    // Eliminar archivos antiguos del storage (si existen)
    if (existingFiles.length > 0) {
      console.log("Deleting old feedback files from storage:", existingFiles.length);
      for (const oldFile of existingFiles) {
        if (oldFile.path || oldFile.file_path) {
          const pathToDelete = oldFile.path || oldFile.file_path;
          const { error: deleteError } = await supabase.storage
            .from(storageBucket)
            .remove([pathToDelete]);
          
          if (deleteError) {
            console.error("Error deleting old file:", pathToDelete, deleteError);
            // No lanzar error, continuar con el proceso
          } else {
            console.log("Deleted old file:", pathToDelete);
          }
        }
      }
    }
    
    // REEMPLAZAR con el nuevo archivo (array con un solo elemento)
    const updatedFiles = [
      {
        bucket: storageBucket,
        path: annotatedPath,
        file_path: annotatedPath,
        fileName: annotatedFileName,
        file_name: annotatedFileName,
        mimeType: "application/pdf",
        mime_type: "application/pdf",
        fileSize: annotatedPdfBytes.byteLength,
        file_size: annotatedPdfBytes.byteLength,
        createdAt: new Date().toISOString(),
      },
    ];

    console.log("Updating submission with single file (replacing old ones):", { submissionId, fileCount: updatedFiles.length });

    const { error: updateError } = await supabase
      .from("assignment_submissions")
      .update({ feedback_files: updatedFiles })
      .eq("id", submissionId);

    if (updateError) {
      console.error("Update error:", updateError);
      throw updateError;
    }

    console.log("Database updated successfully - old files replaced");

    return new Response(
      JSON.stringify({
        success: true,
        fileName: annotatedFileName,
        annotatedCount,
        fileSize: annotatedPdfBytes.byteLength,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (error) {
    console.error("Error in annotate-pdf function:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
