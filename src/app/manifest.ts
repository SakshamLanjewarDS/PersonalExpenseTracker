import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PocketPlan — Personal Expense Tracker",
    short_name: "PocketPlan",
    description: "Private, mobile-first personal finance application for envelope budgeting and offline tracking.",
    start_url: "/",
    display: "standalone",
    background_color: "#F7F8F5",
    theme_color: "#0F766E",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
