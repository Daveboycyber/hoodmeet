"use client";

import { useParams } from "next/navigation";
import VideoRoom from "../../../components/VideoRoom";
import ConnectButton from "../../../components/ConnectButton";

export default function RoomPage() {
  const { id } = useParams();
  const slug = String(id || "demo");
  return (
    <div className="meet">
      <div className="topbar">
        <div><strong>{slug}</strong></div>
        <div className="meta"><ConnectButton /></div>
      </div>
      <VideoRoom roomId={slug} />
    </div>
  );
}
