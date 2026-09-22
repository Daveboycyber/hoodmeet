"use client";

import { useEffect, useRef, useState } from "react";

export default function VideoRoom({ roomId }) {
  const localRef = useRef(null);
  const [peers, setPeers] = useState([]);
  const peersRef = useRef(new Map());
  const [status, setStatus] = useState("idle");
  const [role, setRole] = useState("");
  const [muted, setMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);
  const streamRef = useRef(null);
  const peerRef = useRef(null);

  useEffect(() => {
    let dead = false;
    let retry;

    function upsert(id, stream, call) {
      peersRef.current.set(id, { id, stream, call });
      setPeers(Array.from(peersRef.current.values()));
    }
    function drop(id) {
      peersRef.current.delete(id);
      setPeers(Array.from(peersRef.current.values()));
    }
    function hook(call) {
      call.on("stream", (remote) => upsert(call.peer, remote, call));
      call.on("close", () => drop(call.peer));
      call.on("error", () => drop(call.peer));
    }

    async function boot() {
      try {
        setStatus("camera");
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (dead) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (localRef.current) localRef.current.srcObject = stream;

        const { default: Peer } = await import("peerjs");
        const hostId = ("hm-" + roomId).slice(0, 50);
        setStatus("signaling");

        const asHost = new Peer(hostId);
        asHost.on("open", () => {
          if (dead) return;
          peerRef.current = asHost;
          setRole("host");
          setStatus("live");
        });
        asHost.on("call", (call) => {
          call.answer(stream);
          hook(call);
        });
        asHost.on("error", (err) => {
          if (err?.type !== "unavailable-id") {
            setStatus(String(err?.type || err));
            return;
          }
          asHost.destroy();
          const guest = new Peer();
          peerRef.current = guest;
          function dial() {
            const call = guest.call(hostId, stream);
            if (call) hook(call);
          }
          guest.on("open", () => {
            if (dead) return;
            setRole("guest");
            setStatus("live");
            dial();
            retry = setInterval(() => {
              if (peersRef.current.size === 0 && !dead) dial();
            }, 2500);
          });
          guest.on("call", (call) => {
            call.answer(stream);
            hook(call);
          });
          guest.on("error", (e) => setStatus(String(e?.type || e)));
        });
      } catch (e) {
        setStatus(e.message || "media error");
      }
    }

    boot();
    return () => {
      dead = true;
      clearInterval(retry);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      peerRef.current?.destroy();
    };
  }, [roomId]);

  function toggleMute() {
    const t = streamRef.current?.getAudioTracks()[0];
    if (t) {
      t.enabled = !t.enabled;
      setMuted(!t.enabled);
    }
  }
  function toggleCam() {
    const t = streamRef.current?.getVideoTracks()[0];
    if (t) {
      t.enabled = !t.enabled;
      setCamOff(!t.enabled);
    }
  }

  return (
    <>
      <div className="stage">
        <div className="tile">
          <video ref={localRef} autoPlay muted playsInline />
          <div className="tag">You · {role || status}</div>
        </div>
        {peers.map((p) => (
          <Remote key={p.id} stream={p.stream} label={p.id.slice(0, 12)} />
        ))}
        {peers.length === 0 && (
          <div className="tile">
            <div className="tag">Waiting for the other window…</div>
          </div>
        )}
      </div>
      <div className="dock">
        <button className={muted ? "ctrl off" : "ctrl"} onClick={toggleMute}>{muted ? "Mic off" : "Mic"}</button>
        <button className={camOff ? "ctrl off" : "ctrl"} onClick={toggleCam}>{camOff ? "Cam off" : "Cam"}</button>
        <a className="ctrl leave" href="/">Leave</a>
      </div>
    </>
  );
}

function Remote({ stream, label }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) {
      ref.current.srcObject = stream;
      ref.current.play().catch(() => {});
    }
  }, [stream]);
  return (
    <div className="tile">
      <video ref={ref} autoPlay playsInline muted />
      <div className="tag">{label}</div>
    </div>
  );
}
