"use client";

import { useEffect, useRef, useState } from "react";

async function getMedia() {
  try {
    return await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  } catch {
    try {
      return await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    } catch {
      return new MediaStream();
    }
  }
}

function shortWallet(a) {
  if (!a) return "";
  return a.slice(0, 6) + "\u2026" + a.slice(-4);
}

export default function VideoRoom({ roomId }) {
  const localRef = useRef(null);
  const [peers, setPeers] = useState([]);
  const peersRef = useRef(new Map());
  const [status, setStatus] = useState("idle");
  const [role, setRole] = useState("");
  const [muted, setMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [hand, setHand] = useState(false);
  const [wallet, setWallet] = useState("");
  const [mediaNote, setMediaNote] = useState("");
  const streamRef = useRef(null);
  const camStreamRef = useRef(null);
  const peerRef = useRef(null);
  const callsRef = useRef(new Map());

  useEffect(() => {
    if (window.ethereum) {
      window.ethereum.request({ method: "eth_accounts" }).then((a) => a[0] && setWallet(a[0]));
    }
  }, []);

  useEffect(() => {
    let dead = false;
    let retry;

    function upsert(id, stream) {
      peersRef.current.set(id, { id, stream });
      setPeers(Array.from(peersRef.current.values()));
    }
    function drop(id) {
      peersRef.current.delete(id);
      callsRef.current.delete(id);
      setPeers(Array.from(peersRef.current.values()));
    }
    function hook(call) {
      callsRef.current.set(call.peer, call);
      call.on("stream", (remote) => upsert(call.peer, remote));
      call.on("close", () => drop(call.peer));
      call.on("error", () => drop(call.peer));
    }

    async function boot() {
      setStatus("camera");
      const stream = await getMedia();
      if (dead) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = stream;
      camStreamRef.current = stream;
      const hasVideo = stream.getVideoTracks().length > 0;
      const hasAudio = stream.getAudioTracks().length > 0;
      if (!hasVideo && !hasAudio) {
        setMediaNote("No cam/mic");
        setCamOff(true);
        setMuted(true);
      } else if (!hasVideo) {
        setMediaNote("Audio only");
        setCamOff(true);
      }
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
        call.answer(streamRef.current);
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
          if (dead) return;
          const call = guest.call(hostId, streamRef.current);
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
          call.answer(streamRef.current);
          hook(call);
        });
        guest.on("error", (e) => setStatus(String(e?.type || e)));
      });
    }

    boot();
    return () => {
      dead = true;
      clearInterval(retry);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      camStreamRef.current?.getTracks().forEach((t) => t.stop());
      peerRef.current?.destroy();
    };
  }, [roomId]);

  function replaceTracks(next) {
    streamRef.current = next;
    if (localRef.current) localRef.current.srcObject = next;
    callsRef.current.forEach((call) => {
      const senders = call.peerConnection?.getSenders?.() || [];
      next.getTracks().forEach((track) => {
        const sender = senders.find((s) => s.track && s.track.kind === track.kind);
        if (sender) sender.replaceTrack(track);
      });
    });
  }

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

  async function toggleShare() {
    if (sharing) {
      const cam = camStreamRef.current;
      if (cam) replaceTracks(cam);
      setSharing(false);
      return;
    }
    try {
      const screen = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });
      const audio = streamRef.current?.getAudioTracks() || [];
      const mixed = new MediaStream([...screen.getVideoTracks(), ...audio]);
      screen.getVideoTracks()[0].onended = () => {
        if (camStreamRef.current) replaceTracks(camStreamRef.current);
        setSharing(false);
      };
      replaceTracks(mixed);
      setSharing(true);
      setCamOff(false);
    } catch {
      /* user cancelled */
    }
  }

  const count = peers.length + 1;
  const stageClass =
    count <= 1 ? "n1" : count === 2 ? "n2" : count <= 4 ? "n4" : "n5";
  const selfLabel =
    shortWallet(wallet) ||
    [role || status, mediaNote].filter(Boolean).join(" \u00b7 ") ||
    "You";

  return (
    <>
      <div className={`stage ${stageClass}`}>
        <div className={`tile${hand ? " hand" : ""}`}>
          <video ref={localRef} autoPlay muted playsInline />
          {!streamRef.current?.getVideoTracks().some((t) => t.enabled) && (
            <div className="avatar">{(wallet || "You").slice(0, 1).toUpperCase()}</div>
          )}
          <div className="tag">You \u00b7 {selfLabel}</div>
          <div className="badges">
            {hand && <span className="badge hand">Hand</span>}
            {sharing && <span className="badge">Sharing</span>}
            {muted && <span className="badge">Muted</span>}
          </div>
        </div>
        {peers.map((p) => (
          <Remote key={p.id} stream={p.stream} label={p.id.slice(0, 10)} />
        ))}
        {peers.length === 0 && status === "live" && (
          <div className="tile">
            <div className="avatar">+</div>
            <div className="tag">
              {role === "host"
                ? "Waiting for others \u2014 share this Meeting ID"
                : "Connecting to host\u2026"}
            </div>
          </div>
        )}
      </div>
      <div className="dock">
        <button
          type="button"
          className={muted ? "ctrl off" : "ctrl"}
          onClick={toggleMute}
          title="Microphone"
        >
          {muted ? "Mic off" : "Mic"}
        </button>
        <button
          type="button"
          className={camOff ? "ctrl off" : "ctrl"}
          onClick={toggleCam}
          title="Camera"
        >
          {camOff ? "Cam off" : "Cam"}
        </button>
        <button
          type="button"
          className={sharing ? "ctrl on" : "ctrl"}
          onClick={toggleShare}
          title="Share screen"
        >
          {sharing ? "Stop" : "Share"}
        </button>
        <button
          type="button"
          className={hand ? "ctrl on" : "ctrl"}
          onClick={() => setHand((h) => !h)}
          title="Raise hand"
        >
          Hand
        </button>
        <a className="ctrl leave" href="/" title="Leave">
          Leave
        </a>
      </div>
    </>
  );
}

function Remote({ stream, label }) {
  const ref = useRef(null);
  const [hasVideo, setHasVideo] = useState(true);

  useEffect(() => {
    const v = ref.current;
    if (!v || !stream) return;
    v.srcObject = stream;
    // Remote audio must NOT be muted (local is muted to avoid echo)
    v.muted = false;
    v.play().catch(() => {
      // Autoplay policy: try muted then unmute on gesture is harder;
      // user already gestured by joining, so retry once.
      v.muted = true;
      v.play().then(() => {
        v.muted = false;
      }).catch(() => {});
    });
    const vid = stream.getVideoTracks()[0];
    setHasVideo(!!vid && vid.enabled && vid.readyState === "live");
    const onEnd = () => setHasVideo(false);
    vid?.addEventListener("ended", onEnd);
    return () => vid?.removeEventListener("ended", onEnd);
  }, [stream]);

  return (
    <div className="tile">
      <video ref={ref} autoPlay playsInline />
      {!hasVideo && <div className="avatar">{(label || "?").slice(0, 1).toUpperCase()}</div>}
      <div className="tag">{label}</div>
    </div>
  );
}
