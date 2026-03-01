'use client';

import { useState } from 'react';
import { Header } from './header';
import { Sidebar } from './sidebar';
import { Footer } from './footer';
import { UserData } from '@/lib/auth/user-context';

interface MainLayoutProps {
  children: React.ReactNode;
  user: UserData;
}

export function MainLayout({ children, user }: MainLayoutProps) {
 
  return (
    <>
      <Header user={user} />
      <main
        className="container"
        style={{
          minHeight: 'calc(100vh - 10px)',
        }}
      >
        <div className="container-fluid py-4">
          {children}
        </div>
      </main>
      <Footer />
    </>
  );
}
