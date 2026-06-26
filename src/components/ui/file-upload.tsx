import React, { useState, useRef } from 'react';
import { Upload, File, X, Image, Video, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

interface FileUploadProps {
  onFileSelect: (files: File[]) => void;
  accept?: string;
  multiple?: boolean;
  maxSize?: number; // in MB
  className?: string;
  disabled?: boolean;
}

interface UploadedFile {
  file: File;
  progress: number;
  status: 'uploading' | 'completed' | 'error';
  id: string;
}

export function FileUpload({
  onFileSelect,
  accept = "*/*",
  multiple = false,
  maxSize = 20, // 20MB default
  className,
  disabled = false
}: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getFileIcon = (file: File) => {
    if (file.type.startsWith('image/')) return Image;
    if (file.type.startsWith('video/')) return Video;
    if (file.type.includes('pdf') || file.type.includes('document')) return FileText;
    return File;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleFileSelect = (files: FileList) => {
    const validFiles: File[] = [];
    const newUploadedFiles: UploadedFile[] = [];

    Array.from(files).forEach((file) => {
      if (file.size <= maxSize * 1024 * 1024) {
        validFiles.push(file);
        newUploadedFiles.push({
          file,
          progress: 0,
          status: 'uploading',
          id: Math.random().toString(36).substr(2, 9)
        });
      }
    });

    setUploadedFiles(prev => [...prev, ...newUploadedFiles]);
    onFileSelect(validFiles);

    // Simulate upload progress
    newUploadedFiles.forEach((uploadedFile) => {
      const interval = setInterval(() => {
        setUploadedFiles(prev => prev.map(f => {
          if (f.id === uploadedFile.id) {
            const newProgress = Math.min(f.progress + 10, 100);
            return {
              ...f,
              progress: newProgress,
              status: newProgress === 100 ? 'completed' : 'uploading'
            };
          }
          return f;
        }));
      }, 200);

      setTimeout(() => clearInterval(interval), 2000);
    });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (!disabled && e.dataTransfer.files) {
      handleFileSelect(e.dataTransfer.files);
    }
  };

  const removeFile = (id: string) => {
    setUploadedFiles(prev => prev.filter(f => f.id !== id));
  };

  return (
    <div className={cn("space-y-4", className)}>
      <Card
        className={cn(
          "border-2 border-dashed p-6 text-center cursor-pointer transition-colors",
          isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25",
          disabled && "opacity-50 cursor-not-allowed"
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !disabled && fileInputRef.current?.click()}
      >
        <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
        <div className="space-y-2">
          <p className="text-lg font-medium">
            {isDragging ? 'Suelta los archivos aquí' : 'Arrastra archivos aquí o haz clic para seleccionar'}
          </p>
          <p className="text-sm text-muted-foreground">
            Máximo {maxSize}MB por archivo. {multiple ? 'Múltiples archivos permitidos.' : 'Un archivo por vez.'}
          </p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          className="hidden"
          onChange={(e) => e.target.files && handleFileSelect(e.target.files)}
          disabled={disabled}
        />
      </Card>

      {uploadedFiles.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Archivos subidos:</h4>
          {uploadedFiles.map((uploadedFile) => {
            const IconComponent = getFileIcon(uploadedFile.file);
            return (
              <Card key={uploadedFile.id} className="p-3">
                <div className="flex items-center gap-3">
                  <IconComponent className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{uploadedFile.file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(uploadedFile.file.size)}
                    </p>
                    {uploadedFile.status === 'uploading' && (
                      <Progress value={uploadedFile.progress} className="h-1 mt-1" />
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {uploadedFile.status === 'completed' && (
                      <span className="text-xs text-green-600 font-medium">Completado</span>
                    )}
                    {uploadedFile.status === 'error' && (
                      <span className="text-xs text-red-600 font-medium">Error</span>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFile(uploadedFile.id);
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}