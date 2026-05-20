import './globals.css';

export const metadata = {
  title: 'SheBlooms Feedback Hub',
  description: 'Team feedback intelligence for SheBlooms Venture',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
