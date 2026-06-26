import React from 'react';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { BookOpen } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AdminProgramasManagement from './AdminProgramasManagement';
import AdminEdicionesManagement from './AdminEdicionesManagement';
import AdminModulosManagement from './AdminModulosManagement';

const AdminCourseManagement = () => {
  return (
    <DashboardLayout>
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-1 flex items-center gap-2">
            <BookOpen className="h-8 w-8" />
            Gestión de Cursos
          </h1>
          <p className="text-gray-600">Administra programas, ediciones y módulos de los cursos educativos</p>
        </div>

        <Tabs defaultValue="programas" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 max-w-[600px]">
            <TabsTrigger value="programas">Programas</TabsTrigger>
            <TabsTrigger value="ediciones">Ediciones</TabsTrigger>
            <TabsTrigger value="modulos">Módulos</TabsTrigger>
          </TabsList>

          <TabsContent value="programas" className="space-y-6">
            <AdminProgramasManagement />
          </TabsContent>

          <TabsContent value="ediciones" className="space-y-6">
            <AdminEdicionesManagement />
          </TabsContent>

          <TabsContent value="modulos" className="space-y-6">
            <AdminModulosManagement />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default AdminCourseManagement;
