import type { ReactNode } from 'react';
import Header from './Header';
import Footer from './Footer';

type Props = { eyebrow?: string; title: string; intro?: string; children?: ReactNode };

export default function PageShell({ eyebrow, title, intro, children }: Props) {
  return (
    <>
      <Header />
      <main className="section page-main">
        <div className="container page-container">
          {eyebrow && <span className="eyebrow">{eyebrow}</span>}
          <h1 className="page-title">{title}</h1>
          {intro && <p className="lead">{intro}</p>}
          {children}
        </div>
      </main>
      <Footer />
    </>
  );
}
