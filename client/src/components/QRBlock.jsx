import { QRCodeSVG } from 'qrcode.react';

export function QRBlock({ url, code }) {
  return (
    <div style={{
      background: '#fff',
      padding: '1rem',
      borderRadius: '16px',
      display: 'inline-flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '0.75rem',
    }}>
      <QRCodeSVG
        value={url}
        size={240}
        level="H"
        includeMargin={false}
      />
      <div style={{
        fontFamily: 'monospace',
        fontSize: '2rem',
        letterSpacing: '0.4em',
        fontWeight: 700,
        color: '#0a0a14',
        paddingLeft: '0.4em',
      }}>
        {code}
      </div>
    </div>
  );
}
