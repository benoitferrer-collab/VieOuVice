"use client";
import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";
import type { Notice } from "@/lib/game";
export function NotificationToast({
  notice,
  onOpen,
}: {
  notice: Notice;
  onOpen: () => void;
}) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const id = window.setTimeout(() => setVisible(false), 7000);
    return () => window.clearTimeout(id);
  }, []);
  if (!visible) return null;
  return (
    <div className="toast social-toast" role="status">
      <Bell size={18} />
      <button
        onClick={() => {
          setVisible(false);
          onOpen();
        }}
      >
        {notice.message}
        <span>Voir dans le jeu →</span>
      </button>
      <button
        className="icon-button"
        aria-label="Fermer la notification"
        onClick={() => setVisible(false)}
      >
        <X size={17} />
      </button>
    </div>
  );
}
