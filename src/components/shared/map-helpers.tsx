import { useState, useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";

export function MapResizer() {
  const map = useMap();
  useEffect(() => {
    // Force invalidateSize at staggered intervals
    const timers = [100, 300, 600, 1000, 2000].map((ms) =>
      setTimeout(() => {
        map.invalidateSize();
        // Force all tile layers to redraw (fixes stale tiles from SPA navigation)
        map.eachLayer((layer) => {
          if (layer instanceof L.TileLayer) {
            layer.redraw();
          }
        });
      }, ms)
    );
    // Watch for container resize
    const container = map.getContainer();
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(container);
    return () => {
      timers.forEach(clearTimeout);
      observer.disconnect();
    };
  }, [map]);
  return null;
}

export function DeferredMap({ children, style, className }: { children: React.ReactNode; style?: React.CSSProperties; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => {
      if (el.offsetWidth > 0 && el.offsetHeight > 0) setReady(true);
    };
    check();
    if (!ready) {
      const observer = new ResizeObserver(check);
      observer.observe(el);
      const timer = setTimeout(() => setReady(true), 500);
      return () => { observer.disconnect(); clearTimeout(timer); };
    }
  }, [ready]);
  return (
    <div ref={ref} style={style} className={className}>
      {ready ? children : null}
    </div>
  );
}
