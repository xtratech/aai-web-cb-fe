import './globals.css';

export const metadata = {
  title: 'Pluree Chatbot',
  description: 'Anim AI POC built with Next.js'
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[var(--canvas)] text-[var(--text-primary)]">
        {children}
      </body>
    </html>
  );
}
