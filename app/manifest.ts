import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ROTRG Taxi",
    short_name: "ROTRG",
    description: "Fleet workspace for ROTRG Taxi drivers",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#070b12",
    theme_color: "#070b12",
    orientation: "portrait",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
