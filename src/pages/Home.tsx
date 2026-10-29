import { Hero } from '../components/Hero';
import { HomeSections } from '../components/HomeSections';
import { PackagePreview } from '../components/PackagePreview';
import { PackageSection } from '../components/PackageSection';
import { ProductDemo } from '../components/ProductDemo';

interface HomeProps {
  onNavigate: (page: string) => void;
}

export const Home = ({ onNavigate }: HomeProps) => {
  return (
    <div className="overflow-x-clip">
      <section className="px-4 pb-8 pt-28 sm:px-6 sm:pt-32 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-10 lg:flex-row lg:items-center">
          <Hero onNavigate={onNavigate} />
          <ProductDemo />
        </div>
      </section>
      <PackageSection onNavigate={onNavigate} />
      <PackagePreview />
      <HomeSections onNavigate={onNavigate} />
    </div>
  );
};
