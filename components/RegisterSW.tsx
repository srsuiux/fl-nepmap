"use client";
import { useEffect } from "react";

// Only in production builds: a service worker would get in the way of hot reloading while developing.
export default function RegisterSW() {
  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return null;
}
