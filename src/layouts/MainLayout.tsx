import { ReactNode } from 'react';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { BackgroundMatrix } from '../components/BackgroundMatrix';

interface MainLayoutProps {
  children: ReactNode;
  currentPage: string;
  onNavigate: (page: string) => void;
}

export const MainLayout = ({ children, currentPage, onNavigate }: MainLayoutProps) => {
  return (
    <div className="relative min-h-screen">
      <BackgroundMatrix />
      <Navbar currentPage={currentPage} onNavigate={onNavigate} />
      <main className="relative z-10">{children}</main>
      <Footer onNavigate={onNavigate} />
    </div>
  );
};
