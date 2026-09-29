"use client";

import { useParams } from "next/navigation";
import VideoRoom from "../../../components/VideoRoom";
import PayGate from "../../../components/PayGate";
import ConnectButton from "../../../components/ConnectButton";

export default function RoomPage() {
  const { id } = useParams();
  const slug = String(id || "demo");
  return (
    <div className="meet">
      <div className="topbar">
        <div className="room-id">{slug}</div>
        <div className="meta">
          <ConnectButton />
        </div>
      </div>
      <PayGate slug={slug}>
        <VideoRoom roomId={slug} />
      </PayGate>
    </div>
  );
}
