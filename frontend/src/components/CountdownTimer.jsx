import React, { useState, useEffect } from "react";

export default function CountdownTimer({ endTime }) {
  const [display, setDisplay] = useState("--:--:--");
  const [isUrgent, setIsUrgent] = useState(false);

  useEffect(() => {
    function tick() {
      const end = new Date(endTime).getTime();
      const diff = Math.max(0, end - Date.now());
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setDisplay([h, m, s].map((v) => String(v).padStart(2, "0")).join(":"));
      setIsUrgent(diff < 5 * 60 * 1000);
    }

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endTime]);

  return (
    <span
      className={`font-mono font-bold tabular-nums ${
        isUrgent ? "text-red-400" : "text-green-400"
      }`}
    >
      {display}
    </span>
  );
}
