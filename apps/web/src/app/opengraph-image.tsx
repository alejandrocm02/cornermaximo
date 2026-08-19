import { ImageResponse } from 'next/og';

export const runtime = 'nodejs';
export const alt = 'CornerMaximo — Sports Intelligence';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(
    <div style={{ width: '100%', height: '100%', display: 'flex', position: 'relative', overflow: 'hidden', background: '#05070B', color: '#F5F7FA', padding: 64, fontFamily: 'Arial' }}>
      <div style={{ position: 'absolute', width: 520, height: 520, borderRadius: 520, background: '#1677FF', opacity: 0.16, right: -120, top: -180 }} />
      <div style={{ position: 'absolute', width: 360, height: 360, borderRadius: 360, background: '#FF2438', opacity: 0.1, left: -120, bottom: -160 }} />
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ width: 88, height: 88, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 20, background: '#10141E', border: '1px solid #2A3140', fontSize: 34, fontWeight: 800 }}>CM</div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 40, fontWeight: 800, letterSpacing: 1 }}>CORNERMAXIMO</div>
            <div style={{ marginTop: 6, fontSize: 18, color: '#8D96A8', letterSpacing: 5 }}>SPORTS INTELLIGENCE</div>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', maxWidth: 960 }}>
          <div style={{ fontSize: 70, lineHeight: 1, fontWeight: 900, letterSpacing: -3 }}>TU DEPORTE.</div>
          <div style={{ marginTop: 10, fontSize: 70, lineHeight: 1, fontWeight: 900, letterSpacing: -3, color: '#1677FF' }}>TUS DATOS.</div>
          <div style={{ marginTop: 10, fontSize: 70, lineHeight: 1, fontWeight: 900, letterSpacing: -3 }}>TU VENTAJA.</div>
          <div style={{ marginTop: 26, fontSize: 23, color: '#C8CDD7' }}>Partidos · estadísticas · scouting · rankings · análisis</div>
        </div>
      </div>
    </div>,
    size,
  );
}
