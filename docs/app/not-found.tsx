import Link from 'next/link';

export default function NotFound() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        gap: '1rem',
        fontFamily: 'sans-serif',
      }}
    >
      <h1 style={{ fontSize: '2rem', fontWeight: 'bold' }}>404</h1>
      <p style={{ color: '#666' }}>This page could not be found.</p>
      <Link href="/en" style={{ color: '#2563eb' }}>
        Go to docs →
      </Link>
    </div>
  );
}
