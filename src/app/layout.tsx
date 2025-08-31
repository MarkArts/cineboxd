import type { Metadata } from "next";

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
      <body>
        {children}
      </body>
    </html>
  );
}
