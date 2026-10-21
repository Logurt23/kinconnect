"use client";

import { LocateFixed } from "lucide-react";
import { useState } from "react";

/** Fills the lat/lon fields from the browser. Nothing is sent until the form is saved. */
export function UseMyLocation() {
  const [msg, setMsg] = useState("");
  return (
    <span className="flex items-center gap-2">
      <button
        type="button"
        className="btn-small"
        onClick={() => {
          if (!navigator.geolocation) return setMsg("This browser can't share location.");
          setMsg("Locating...");
          navigator.geolocation.getCurrentPosition(
            (p) => {
              (document.getElementById("lat") as HTMLInputElement).value = p.coords.latitude.toFixed(4);
              (document.getElementById("lon") as HTMLInputElement).value = p.coords.longitude.toFixed(4);
              setMsg("Filled in. Save to keep it.");
            },
            () => setMsg("Location was blocked."),
          );
        }}
      >
        <LocateFixed size={14} /> Use my location
      </button>
      <span className="text-xs text-muted">{msg}</span>
    </span>
  );
}
