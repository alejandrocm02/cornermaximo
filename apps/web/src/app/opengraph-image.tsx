import { ImageResponse } from 'next/og';

export const runtime = 'nodejs';
export const alt = 'FutStats — estadísticas, scouting y comparador de fútbol';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: '#07130d', color: 'white', padding: 64, fontFamily: 'Arial' }}>
        <div style={{ display: 'flex', fontSize: 30, fontWeight: 800, color: '#7fffb2' }}>FutStats</div>
        <div style={{ display: 'flex', flexDirection: 'column', maxWidth: 960 }}>
          <div style={{ display: 'flex', fontSize: 66, lineHeight: 1.05, fontWeight: 900 }}>Estadísticas, scouting y comparador de fútbol</div>
          <div style={{ display: 'flex', marginTop: 24, fontSize: 25, color: '#a8b8ae' }}>Percentiles · métricas por 90 · jugadores similares · alertas</div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#82988a', fontSize: 16 }}>
          <div style={{ display: 'flex' }}>Datos para entender mejor el rendimiento</div>
          <div style={{ display: 'flex' }}>FutStats</div>
        </div>
      </div>
    ),
    size,
  );
}
