import {MapPin,Navigation} from "lucide-react";

export default function DemoRouteMap({route,t}){
  return <section className="demoMapCard" id="demo-route"><div className="mapHeading"><div><span>{t.demoRoute}</span><h2>{t.route}</h2></div><Navigation/></div><div className="demoMap" aria-label={t.demoRoute}><span className="mapRoad roadOne"/><span className="mapRoad roadTwo"/><span className="mapRoad roadThree"/><svg viewBox="0 0 320 220" role="img"><path className="routeShadow" d="M52 175 C72 140, 105 150, 126 112 S193 93, 211 61 S251 45, 274 40"/><path className="routeLine" d="M52 175 C72 140, 105 150, 126 112 S193 93, 211 61 S251 45, 274 40" strokeDasharray="7 6"/></svg><div className="mapPoint start"><span/><b>{t.yourLocation}</b></div><div className="mapPoint finish"><MapPin size={23}/><b>{t.destination}</b></div><div className="routeBadge">{route.minutes} {t.minutes} · {route.distanceKm} km</div></div><p>{t.demoRouteNotice}</p></section>;
}
