import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <main>{children}</main>
      <Footer />
    </>
  );
}
