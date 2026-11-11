"use client";

import React, { useEffect } from "react";

export default function PWAInitializer() {
  useEffect(() => {
    // Disinstalla il Service Worker PWA per rimuovere la cache vecchia
    // che bloccava il caricamento della pagina dopo il deploy.
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .getRegistrations()
        .then((regs) =>
          Promise.all(regs.map((r) => r.unregister()))
        )
        .catch((err) => console.error("SW unregister failed:", err));
    }
  }, []);

  return null;
}
