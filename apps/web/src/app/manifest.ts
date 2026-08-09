import type { MetadataRoute } from 'next';
export default function manifest(): MetadataRoute.Manifest { return {
  name:'CornerMaximo', short_name:'CM', description:'Sports Intelligence: partidos, estadísticas, scouting, rankings y alertas de fútbol.',
  start_url:'/mi-futstats', display:'standalone', background_color:'#05070B', theme_color:'#05070B', lang:'es', categories:['sports'],
  icons:[{src:'/cornermaximo-icon.svg',sizes:'any',type:'image/svg+xml',purpose:'any maskable'}],
}; }
