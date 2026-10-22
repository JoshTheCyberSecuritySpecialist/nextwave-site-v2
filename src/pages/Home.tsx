import { Hero } from '../components/Hero';
import { HomeSections } from '../components/HomeSections';
import { PackageSection } from '../components/PackageSection';
import { ProductDemo } from '../components/ProductDemo';

interface HomeProps {
  onNavigate: (page: string) => void;
}

export const Home = ({ onNavigate }: HomeProps) => {
  return (
    <div className="overflow-x-clip">
      <Hero onNavigate={onNavigate} />
      <ProductDemo />
      <PackageSection onNavigate={onNavigate} />
      <HomeSections onNavigate={onNavigate} />
    </div>
  );
};
