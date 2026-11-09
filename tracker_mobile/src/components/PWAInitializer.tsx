"use client";

import React, { useEffect } from "react";

export default function PWAInitializer() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker
          .register("/sw.js")
          .then((reg) => console.log("SW registered:", reg))
          .catch((err) => console.error("SW registration failed:", err));
      });
    }
  }, []);

  return null;
}
