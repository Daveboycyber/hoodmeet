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

function canScreenShare() {
  return typeof navigator !== "undefined" &&
    !!navigator.mediaDevices?.getDisplayMedia &&
    !/Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
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
  const [hands, setHands] = useState({});
  const [sharingIds, setSharingIds] = useState({});
  const [spotId, setSpotId] = useState(null);
  const [wallet, setWallet] = useState("");
  const [mediaNote, setMediaNote] = useState("");
  const [shareHint, setShareHint] = useState("");
  const streamRef = useRef(null);
  const camStreamRef = useRef(null);
  const peerRef = useRef(null);
  const callsRef = useRef(new Map());
  const connsRef = useRef(new Map());
  const myIdRef = useRef("");
  const rosterRef = useRef(new Set());

  useEffect(() => {
    if (window.ethereum) {
      window.ethereum.request({ method: "eth_accounts" }).then((a) => a[0] && setWallet(a[0]));
    }
  }, []);

  useEffect(() => {
    let dead = false;
    let retry;

    function publishPeers() {
      setPeers(Array.from(peersRef.current.values()));
    }
    function upsert(id, stream) {
      const prev = peersRef.current.get(id) || {};
      peersRef.current.set(id, { ...prev, id, stream });
      publishPeers();
    }
    function drop(id) {
      peersRef.current.delete(id);
      callsRef.current.delete(id);
      connsRef.current.delete(id);
      rosterRef.current.delete(id);
      setHands((h) => {
        const n = { ...h };
        delete n[id];
        return n;
      });
      setSharingIds((s) => {
        const n = { ...s };
        delete n[id];
        return n;
      });
      publishPeers();
    }

    function broadcast(msg) {
      const raw = JSON.stringify(msg);
      connsRef.current.forEach((c) => {
        try {
          if (c.open) c.send(raw);
        } catch {}
      });
    }

    function handleData(from, raw) {
      let msg;
      try {
        msg = typeof raw === "string" ? JSON.parse(raw) : raw;
      } catch {
        return;
      }
      if (!msg || !msg.type) return;
      if (msg.type === "roster" && Array.isArray(msg.ids)) {
        msg.ids.forEach((id) => {
          if (id && id !== myIdRef.current) dialPeer(id);
        });
      }
      if (msg.type === "hand") {
        setHands((h) => ({ ...h, [from]: !!msg.on }));
      }
      if (msg.type === "share") {
        setSharingIds((s) => ({ ...s, [from]: !!msg.on }));
        if (msg.on) setSpotId(from);
        else setSpotId((cur) => (cur === from ? null : cur));
      }
      if (msg.type === "hello") {
        rosterRef.current.add(from);
        if (role === "host" || peerRef.current?.id?.startsWith?.("hm-")) {
          broadcastRoster();
        }
      }
    }

    function broadcastRoster() {
      const ids = [myIdRef.current, ...rosterRef.current];
      broadcast({ type: "roster", ids });
    }

    function wireConn(conn) {
      connsRef.current.set(conn.peer, conn);
      rosterRef.current.add(conn.peer);
      conn.on("data", (d) => handleData(conn.peer, d));
      conn.on("open", () => {
        try {
          conn.send(JSON.stringify({ type: "hello" }));
          conn.send(
            JSON.stringify({
              type: "roster",
              ids: [myIdRef.current, ...rosterRef.current],
            })
          );
          if (hand) conn.send(JSON.stringify({ type: "hand", on: true }));
          if (sharing) conn.send(JSON.stringify({ type: "share", on: true }));
        } catch {}
      });
      conn.on("close", () => drop(conn.peer));
    }

    function hookCall(call) {
      if (callsRef.current.has(call.peer)) {
        try {
          call.close();
        } catch {}
        return;
      }
      callsRef.current.set(call.peer, call);
      call.on("stream", (remote) => upsert(call.peer, remote));
      call.on("close", () => drop(call.peer));
      call.on("error", () => drop(call.peer));
    }

    function dialPeer(peerId) {
      const me = peerRef.current;
      if (!me || !peerId || peerId === myIdRef.current) return;
      if (!connsRef.current.has(peerId)) {
        try {
          const conn = me.connect(peerId, { reliable: true });
          wireConn(conn);
        } catch {}
      }
      if (!callsRef.current.has(peerId) && streamRef.current) {
        try {
          const call = me.call(peerId, streamRef.current);
          if (call) hookCall(call);
        } catch {}
      }
    }

    function attachPeer(p, isHost) {
      peerRef.current = p;
      p.on("open", (id) => {
        if (dead) return;
        myIdRef.current = id;
        setRole(isHost ? "host" : "guest");
        setStatus("live");
      });
      p.on("connection", (conn) => wireConn(conn));
      p.on("call", (call) => {
        call.answer(streamRef.current);
        hookCall(call);
        // also open data channel back
        if (!connsRef.current.has(call.peer)) {
          try {
            wireConn(p.connect(call.peer, { reliable: true }));
          } catch {}
        }
      });
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
      asHost.on("error", (err) => {
        if (err?.type !== "unavailable-id") {
          setStatus(String(err?.type || err));
          return;
        }
        asHost.destroy();
        const guest = new Peer();
        attachPeer(guest, false);
        guest.on("open", () => {
          dialPeer(hostId);
          retry = setInterval(() => {
            if (!dead) dialPeer(hostId);
          }, 3000);
        });
      });
      attachPeer(asHost, true);
    }

    boot();
    return () => {
      dead = true;
      clearInterval(retry);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      camStreamRef.current?.getTracks().forEach((t) => t.stop());
      peerRef.current?.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  function broadcast(msg) {
    const raw = JSON.stringify(msg);
    connsRef.current.forEach((c) => {
      try {
        if (c.open) c.send(raw);
      } catch {}
    });
  }

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

  function toggleHand() {
    setHand((h) => {
      const next = !h;
      broadcast({ type: "hand", on: next });
      return next;
    });
  }

  async function toggleShare() {
    if (sharing) {
      const cam = camStreamRef.current;
      if (cam) replaceTracks(cam);
      setSharing(false);
      setSpotId(null);
      broadcast({ type: "share", on: false });
      return;
    }
    if (!canScreenShare()) {
      setShareHint("Screen share needs desktop Chrome or Edge");
      setTimeout(() => setShareHint(""), 4000);
      return;
    }
    try {
      const screen = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 15 },
        audio: false,
      });
      const audio = streamRef.current?.getAudioTracks() || [];
      const mixed = new MediaStream([...screen.getVideoTracks(), ...audio]);
      screen.getVideoTracks()[0].onended = () => {
        if (camStreamRef.current) replaceTracks(camStreamRef.current);
        setSharing(false);
        setSpotId(null);
        broadcast({ type: "share", on: false });
      };
      replaceTracks(mixed);
      setSharing(true);
      setCamOff(false);
      setSpotId("local");
      broadcast({ type: "share", on: true });
    } catch {
      /* cancelled */
    }
  }

  const count = peers.length + 1;
  const stageClass = spotId
    ? "spotlight"
    : count <= 1
      ? "alone"
      : count === 3
        ? "trio"
        : "";
  const selfLabel =
    shortWallet(wallet) ||
    [role || status, mediaNote].filter(Boolean).join(" \u00b7 ") ||
    "You";

  return (
    <>
      <div className="stage-wrap">
        <div className={`stage ${stageClass}`}>
          <div
            className={`tile camera${hand ? " hand" : ""}${spotId === "local" ? " spot" : ""}`}
          >
            <video ref={localRef} autoPlay muted playsInline />
            {(camOff || !streamRef.current?.getVideoTracks().length) && (
              <div className="avatar">{(wallet || "Y").slice(0, 1).toUpperCase()}</div>
            )}
            <div className="tag">You \u00b7 {selfLabel}</div>
            <div className="badges">
              {hand && <span className="badge hand">Hand</span>}
              {sharing && <span className="badge">Sharing</span>}
              {muted && <span className="badge">Muted</span>}
            </div>
            {sharing && (
              <button type="button" className="expand" onClick={() => setSpotId((s) => (s === "local" ? null : "local"))}>
                {spotId === "local" ? "Exit full" : "Expand"}
              </button>
            )}
          </div>

          {peers.map((p) => (
            <Remote
              key={p.id}
              stream={p.stream}
              label={p.id.slice(0, 10)}
              hand={!!hands[p.id]}
              sharing={!!sharingIds[p.id]}
              spot={spotId === p.id}
              onExpand={() => setSpotId((s) => (s === p.id ? null : p.id))}
            />
          ))}

          {peers.length === 0 && status === "live" && (
            <div className="tile wait">
              <div className="avatar">+</div>
              <div className="tag">
                {role === "host"
                  ? "Waiting for others \u2014 share Meeting ID"
                  : "Connecting to host\u2026"}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="dock">
        <button type="button" className={muted ? "ctrl off" : "ctrl"} onClick={toggleMute}>
          {muted ? "Mic off" : "Mic"}
        </button>
        <button type="button" className={camOff ? "ctrl off" : "ctrl"} onClick={toggleCam}>
          {camOff ? "Cam off" : "Cam"}
        </button>
        <button type="button" className={sharing ? "ctrl on" : "ctrl"} onClick={toggleShare}>
          {sharing ? "Stop" : "Share"}
        </button>
        <button type="button" className={hand ? "ctrl on" : "ctrl"} onClick={toggleHand}>
          Hand
        </button>
        <a className="ctrl leave" href="/">
          Leave
        </a>
        {shareHint && <div className="hint">{shareHint}</div>}
      </div>
    </>
  );
}

function Remote({ stream, label, hand, sharing, spot, onExpand }) {
  const ref = useRef(null);
  const [hasVideo, setHasVideo] = useState(true);

  useEffect(() => {
    const v = ref.current;
    if (!v || !stream) return;
    v.srcObject = stream;
    v.muted = false;
    v.play().catch(() => {
      v.muted = true;
      v.play()
        .then(() => {
          v.muted = false;
        })
        .catch(() => {});
    });
    const vid = stream.getVideoTracks()[0];
    setHasVideo(!!vid && vid.readyState === "live");
    const onMute = () => setHasVideo(vid && vid.enabled && vid.readyState === "live");
    vid?.addEventListener("ended", onMute);
    vid?.addEventListener("mute", onMute);
    vid?.addEventListener("unmute", onMute);
    return () => {
      vid?.removeEventListener("ended", onMute);
      vid?.removeEventListener("mute", onMute);
      vid?.removeEventListener("unmute", onMute);
    };
  }, [stream]);

  return (
    <div className={`tile camera${hand ? " hand" : ""}${spot ? " spot" : ""}`}>
      <video ref={ref} autoPlay playsInline />
      {!hasVideo && <div className="avatar">{(label || "?").slice(0, 1).toUpperCase()}</div>}
      <div className="tag">{label}</div>
      <div className="badges">
        {hand && <span className="badge hand">Hand</span>}
        {sharing && <span className="badge">Sharing</span>}
      </div>
      {sharing && (
        <button type="button" className="expand" onClick={onExpand}>
          {spot ? "Exit full" : "Expand"}
        </button>
      )}
    </div>
  );
}
