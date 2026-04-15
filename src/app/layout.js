import "./globals.css";

export const metadata = {
  title: "Geo Political Intelligence System",
  description: "Real-time geopolitical intelligence with live feeds, mapped incidents, and macro risk signals"
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-slate-100 text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}
