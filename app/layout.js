import './globals.css';

export const metadata = {
  title: 'Pluree Chatbot',
  description: 'Anim AI POC built with Next.js'
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[var(--off-white)] text-[var(--black)]">
        {children}
      </body>
    </html>
  );
}
