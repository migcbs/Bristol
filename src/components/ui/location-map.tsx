"use client";

import {
  AnimatePresence,
  motion,
  useMotionValue,
  useSpring,
  useTransform,
} from "framer-motion";
import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";

interface LocationMapProps {
  /** Location name to display */
  location?: string;
  /** Latitude coordinate */
  latitude?: number;
  /** Longitude coordinate */
  longitude?: number;
  /** Zoom level for the map (1-18) */
  zoom?: number;
  /** Additional CSS classes */
  className?: string;
  /** Whether the card starts expanded */
  defaultExpanded?: boolean;
}

// Convert lat/lng to tile coordinates
function latLngToTile(lat: number, lng: number, zoom: number) {
  const n = 2 ** zoom;
  const x = Math.floor(((lng + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n
  );
  return { x, y };
}

// Carto's light basemap — clean and neutral, matches the site's light cards.
// Free for reasonable-traffic, attributed use (attribution is rendered
// below the map, see "© OpenStreetMap contributors" in the expanded view).
function getTileUrl(x: number, y: number, z: number) {
  return `https://cartodb-basemaps-a.global.ssl.fastly.net/light_all/${z}/${x}/${y}.png`;
}

function formatCoordinates(lat: number, lng: number) {
  const latDir = lat >= 0 ? "N" : "S";
  const lngDir = lng >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(4)}° ${latDir}, ${Math.abs(lng).toFixed(4)}° ${lngDir}`;
}

export function LocationMap({
  location = "Plantel",
  latitude,
  longitude,
  zoom = 14,
  className,
  defaultExpanded = false,
}: LocationMapProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [tilesLoaded, setTilesLoaded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const hasCoordinates = latitude !== undefined && longitude !== undefined;

  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const rotateX = useTransform(mouseY, [-50, 50], [8, -8]);
  const rotateY = useTransform(mouseX, [-50, 50], [-8, 8]);

  const springRotateX = useSpring(rotateX, { stiffness: 300, damping: 30 });
  const springRotateY = useSpring(rotateY, { stiffness: 300, damping: 30 });

  const coordinates = useMemo(
    () => (hasCoordinates ? formatCoordinates(latitude, longitude) : null),
    [hasCoordinates, latitude, longitude]
  );

  // Generate tile URLs for a 3x3 grid around the center tile
  const tiles = useMemo(() => {
    if (!hasCoordinates) return [];
    const centerTile = latLngToTile(latitude, longitude, zoom);
    const tileUrls: { url: string; offsetX: number; offsetY: number }[] = [];

    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        tileUrls.push({
          url: getTileUrl(centerTile.x + dx, centerTile.y + dy, zoom),
          offsetX: dx,
          offsetY: dy,
        });
      }
    }

    return tileUrls;
  }, [hasCoordinates, latitude, longitude, zoom]);

  // Preload tiles
  useEffect(() => {
    if (tiles.length === 0) return;
    let loadedCount = 0;
    const totalTiles = tiles.length;

    tiles.forEach((tile) => {
      const img = new Image();
      img.onload = () => {
        loadedCount++;
        if (loadedCount === totalTiles) setTilesLoaded(true);
      };
      img.onerror = () => {
        loadedCount++;
        if (loadedCount === totalTiles) setTilesLoaded(true);
      };
      img.src = tile.url;
    });
  }, [tiles]);

  function handleMouseMove(e: React.MouseEvent) {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    mouseX.set(e.clientX - centerX);
    mouseY.set(e.clientY - centerY);
  }

  function handleMouseLeave() {
    mouseX.set(0);
    mouseY.set(0);
    setIsHovered(false);
  }

  function handleClick() {
    if (hasCoordinates) setIsExpanded(!isExpanded);
  }

  return (
    <motion.div
      ref={containerRef}
      className={`relative select-none ${hasCoordinates ? "cursor-pointer" : ""} ${className ?? ""}`}
      style={{ perspective: 1000 }}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
    >
      <motion.div
        className="relative overflow-hidden rounded-2xl border border-border bg-white"
        style={{
          rotateX: springRotateX,
          rotateY: springRotateY,
          transformStyle: "preserve-3d",
        }}
        animate={{
          width: isExpanded ? 320 : 240,
          height: isExpanded ? 260 : 140,
        }}
        transition={{ type: "spring", stiffness: 400, damping: 35 }}
      >
        <div className="pointer-events-none absolute inset-0 z-20 bg-[radial-gradient(ellipse_at_top_right,rgba(43,43,122,0.05),transparent_70%)]" />

        <AnimatePresence>
          {isExpanded && (
            <motion.div
              className="pointer-events-none absolute inset-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
            >
              <div className="absolute inset-0 overflow-hidden">
                <div
                  className="absolute"
                  style={{
                    width: "768px",
                    height: "768px",
                    left: "50%",
                    top: "50%",
                    transform: "translate(-50%, -50%)",
                  }}
                >
                  {tiles.map((tile, index) => (
                    <motion.div
                      key={`${tile.offsetX}-${tile.offsetY}`}
                      className="absolute"
                      style={{
                        width: "256px",
                        height: "256px",
                        left: `${(tile.offsetX + 1) * 256}px`,
                        top: `${(tile.offsetY + 1) * 256}px`,
                      }}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: tilesLoaded ? 1 : 0 }}
                      transition={{ duration: 0.3, delay: index * 0.05 }}
                    >
                      {/* Plain <img>, not next/image: these are external
                          OSM/Carto map tiles. next/image would need the
                          tile host allow-listed in next.config and would
                          just render blank in production otherwise —
                          which is exactly what happened on Vercel. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={tile.url}
                        alt=""
                        width={256}
                        height={256}
                        loading="lazy"
                        className="h-full w-full"
                      />
                    </motion.div>
                  ))}
                </div>
              </div>

              {!tilesLoaded && <div className="absolute inset-0 animate-pulse bg-surface" />}

              <motion.div
                className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2"
                initial={{ scale: 0, y: -20 }}
                animate={{ scale: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 400, damping: 20, delay: 0.3 }}
              >
                <svg
                  width="30"
                  height="30"
                  viewBox="0 0 24 24"
                  fill="none"
                  style={{ filter: "drop-shadow(0 2px 6px rgba(230,51,41,0.5))" }}
                >
                  <path
                    d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"
                    className="fill-accent"
                  />
                  <circle cx="12" cy="9" r="2.5" className="fill-white" />
                </svg>
              </motion.div>

              <div className="absolute inset-0 z-10 bg-gradient-to-t from-white via-transparent to-transparent opacity-70" />
              <div className="absolute inset-x-0 bottom-0 z-10 px-2 pb-1 text-right text-[9px] text-muted/80">
                © OpenStreetMap
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="relative z-20 flex h-full flex-col justify-between p-5">
          <motion.div
            animate={{ opacity: isExpanded ? 0 : 1 }}
            transition={{ duration: 0.3 }}
          >
            <motion.svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-accent"
              animate={{
                filter: isHovered
                  ? "drop-shadow(0 0 8px rgba(230,51,41,0.5))"
                  : "drop-shadow(0 0 4px rgba(230,51,41,0.25))",
              }}
              transition={{ duration: 0.3 }}
            >
              <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
              <line x1="9" x2="9" y1="3" y2="18" />
              <line x1="15" x2="15" y1="6" y2="21" />
            </motion.svg>
          </motion.div>

          <div className="space-y-1">
            <motion.h3
              className="font-display text-sm font-semibold tracking-tight text-primary"
              animate={{ x: isHovered ? 4 : 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
            >
              {location}
            </motion.h3>

            <AnimatePresence>
              {isExpanded && coordinates && (
                <motion.p
                  className="font-mono text-xs text-muted"
                  initial={{ opacity: 0, y: -10, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: "auto" }}
                  exit={{ opacity: 0, y: -10, height: 0 }}
                  transition={{ duration: 0.25 }}
                >
                  {coordinates}
                </motion.p>
              )}
            </AnimatePresence>

            <motion.div
              className="h-px bg-gradient-to-r from-accent/50 via-accent/30 to-transparent"
              initial={{ scaleX: 0, originX: 0 }}
              animate={{ scaleX: isHovered || isExpanded ? 1 : 0.3 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            />
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default LocationMap;
