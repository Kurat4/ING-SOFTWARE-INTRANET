import React from 'react';
import ParentSidebar from '@/components/parent/ParentSidebar';
import { Header } from '@/components/layout/Header';

interface ParentLayoutProps {
  children: React.ReactNode;
}

export const ParentLayout: React.FC<ParentLayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen flex w-full bg-background">
      <ParentSidebar />
      
      <div className="flex-1 flex flex-col">
        <Header />
        
        <main className="flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  );
};
