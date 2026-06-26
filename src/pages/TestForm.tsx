import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface SimpleFormData {
  name: string;
  code: string;
  description: string;
}

const TestForm = () => {
  const [formData, setFormData] = useState<SimpleFormData>({
    name: '',
    code: '',
    description: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Form data:', formData);
    alert(`Curso creado: ${formData.name} (${formData.code})`);
    // Reset form
    setFormData({ name: '', code: '', description: '' });
  };

  return (
    <Card className="max-w-md mx-auto mt-8">
      <CardHeader>
        <CardTitle>Formulario de Prueba - Crear Curso</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="test-name">Nombre del Curso</Label>
            <Input
              id="test-name"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Ej: Matemáticas Básicas"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="test-code">Código del Curso</Label>
            <Input
              id="test-code"
              type="text"
              value={formData.code}
              onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value }))}
              placeholder="Ej: MAT101"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="test-description">Descripción</Label>
            <Textarea
              id="test-description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Descripción del curso..."
              rows={3}
            />
          </div>

          <div className="flex gap-2">
            <Button 
              type="button" 
              variant="outline"
              onClick={() => setFormData({ name: '', code: '', description: '' })}
            >
              Limpiar
            </Button>
            <Button type="submit">
              Crear Curso
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default TestForm;