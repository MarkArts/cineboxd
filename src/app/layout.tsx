import type { Metadata } from "next";

// Disable all static generation
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export const metadata: Metadata = {
  title: "Cineboxd API",
  description: "API for fetching Letterboxd watchlist showtimes",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0, backgroundColor: '#0f1419' }}>
        {children}
      </body>
    </html>
  );
}
