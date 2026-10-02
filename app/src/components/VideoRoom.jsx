"use client";

import { useEffect, useRef, useState } from "react";

async function getMedia() {
  try {
    return await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  } catch (e1) {
    try {
      return await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    } catch (e2) {
      return new MediaStream();
    }
  }
}

function shortWallet(a) {
  if (!a) return "";
  return a.slice(0, 6) + "..." + a.slice(-4);
}

function canScreenShare() {
  if (typeof navigator === "undefined") return false;
  if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) return false;
  return !/Android|iPhone|iPad|iPod/i.test(navigator.userAgent || "");
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
  const handRef = useRef(false);
  const sharingRef = useRef(false);

  useEffect(() => {
    if (typeof window !== "undefined" && window.ethereum) {
      window.ethereum.request({ method: "eth_accounts" }).then(function (a) {
        if (a && a[0]) setWallet(a[0]);
      });
    }
  }, []);

  useEffect(() => {
    var dead = false;
    var retry;

    function publishPeers() {
      setPeers(Array.from(peersRef.current.values()));
    }
    function upsert(id, stream) {
      var prev = peersRef.current.get(id) || {};
      peersRef.current.set(id, Object.assign({}, prev, { id: id, stream: stream }));
      publishPeers();
    }
    function drop(id) {
      peersRef.current.delete(id);
      callsRef.current.delete(id);
      connsRef.current.delete(id);
      rosterRef.current.delete(id);
      setHands(function (h) {
        var n = Object.assign({}, h);
        delete n[id];
        return n;
      });
      setSharingIds(function (s) {
        var n = Object.assign({}, s);
        delete n[id];
        return n;
      });
      publishPeers();
    }

    function broadcast(msg) {
      var raw = JSON.stringify(msg);
      connsRef.current.forEach(function (c) {
        try {
          if (c.open) c.send(raw);
        } catch (e) {}
      });
    }

    function broadcastRoster() {
      var ids = [myIdRef.current].concat(Array.from(rosterRef.current));
      broadcast({ type: "roster", ids: ids });
    }

    function handleData(from, raw) {
      var msg;
      try {
        msg = typeof raw === "string" ? JSON.parse(raw) : raw;
      } catch (e) {
        return;
      }
      if (!msg || !msg.type) return;
      if (msg.type === "roster" && Array.isArray(msg.ids)) {
        msg.ids.forEach(function (id) {
          if (id && id !== myIdRef.current) dialPeer(id);
        });
      }
      if (msg.type === "hand") {
        setHands(function (h) {
          var n = Object.assign({}, h);
          n[from] = !!msg.on;
          return n;
        });
      }
      if (msg.type === "share") {
        setSharingIds(function (s) {
          var n = Object.assign({}, s);
          n[from] = !!msg.on;
          return n;
        });
        if (msg.on) setSpotId(from);
        else
          setSpotId(function (cur) {
            return cur === from ? null : cur;
          });
      }
      if (msg.type === "hello") {
        rosterRef.current.add(from);
        if (myIdRef.current.indexOf("hm-") === 0) broadcastRoster();
      }
    }

    function wireConn(conn) {
      connsRef.current.set(conn.peer, conn);
      rosterRef.current.add(conn.peer);
      conn.on("data", function (d) {
        handleData(conn.peer, d);
      });
      conn.on("open", function () {
        try {
          conn.send(JSON.stringify({ type: "hello" }));
          conn.send(
            JSON.stringify({
              type: "roster",
              ids: [myIdRef.current].concat(Array.from(rosterRef.current)),
            })
          );
          if (handRef.current) conn.send(JSON.stringify({ type: "hand", on: true }));
          if (sharingRef.current) conn.send(JSON.stringify({ type: "share", on: true }));
        } catch (e) {}
      });
      conn.on("close", function () {
        drop(conn.peer);
      });
    }

    function hookCall(call) {
      if (callsRef.current.has(call.peer)) {
        try {
          call.close();
        } catch (e) {}
        return;
      }
      callsRef.current.set(call.peer, call);
      call.on("stream", function (remote) {
        upsert(call.peer, remote);
      });
      call.on("close", function () {
        drop(call.peer);
      });
      call.on("error", function () {
        drop(call.peer);
      });
    }

    function dialPeer(peerId) {
      var me = peerRef.current;
      if (!me || !peerId || peerId === myIdRef.current) return;
      if (!connsRef.current.has(peerId)) {
        try {
          var conn = me.connect(peerId, { reliable: true });
          wireConn(conn);
        } catch (e) {}
      }
      if (!callsRef.current.has(peerId) && streamRef.current) {
        try {
          var call = me.call(peerId, streamRef.current);
          if (call) hookCall(call);
        } catch (e) {}
      }
    }

    function attachPeer(p, isHost) {
      peerRef.current = p;
      p.on("open", function (id) {
        if (dead) return;
        myIdRef.current = id;
        setRole(isHost ? "host" : "guest");
        setStatus("live");
      });
      p.on("connection", function (conn) {
        wireConn(conn);
      });
      p.on("call", function (call) {
        call.answer(streamRef.current);
        hookCall(call);
        if (!connsRef.current.has(call.peer)) {
          try {
            wireConn(p.connect(call.peer, { reliable: true }));
          } catch (e) {}
        }
      });
    }

    async function boot() {
      setStatus("camera");
      var stream = await getMedia();
      if (dead) {
        stream.getTracks().forEach(function (t) {
          t.stop();
        });
        return;
      }
      streamRef.current = stream;
      camStreamRef.current = stream;
      var hasVideo = stream.getVideoTracks().length > 0;
      var hasAudio = stream.getAudioTracks().length > 0;
      if (!hasVideo && !hasAudio) {
        setMediaNote("No cam/mic");
        setCamOff(true);
        setMuted(true);
      } else if (!hasVideo) {
        setMediaNote("Audio only");
        setCamOff(true);
      }
      if (localRef.current) localRef.current.srcObject = stream;

      var PeerMod = await import("peerjs");
      var Peer = PeerMod.default;
      var hostId = ("hm-" + roomId).slice(0, 50);
      setStatus("signaling");

      var asHost = new Peer(hostId);
      asHost.on("error", function (err) {
        if (!err || err.type !== "unavailable-id") {
          setStatus(String((err && err.type) || err || "error"));
          return;
        }
        asHost.destroy();
        var guest = new Peer();
        attachPeer(guest, false);
        guest.on("open", function () {
          dialPeer(hostId);
          retry = setInterval(function () {
            if (!dead) dialPeer(hostId);
          }, 3000);
        });
      });
      attachPeer(asHost, true);
    }

    boot();
    return function () {
      dead = true;
      clearInterval(retry);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(function (t) {
          t.stop();
        });
      }
      if (camStreamRef.current) {
        camStreamRef.current.getTracks().forEach(function (t) {
          t.stop();
        });
      }
      if (peerRef.current) peerRef.current.destroy();
    };
  }, [roomId]);

  function broadcast(msg) {
    var raw = JSON.stringify(msg);
    connsRef.current.forEach(function (c) {
      try {
        if (c.open) c.send(raw);
      } catch (e) {}
    });
  }

  function replaceTracks(next) {
    streamRef.current = next;
    if (localRef.current) localRef.current.srcObject = next;
    callsRef.current.forEach(function (call) {
      var pc = call.peerConnection;
      var senders = (pc && pc.getSenders && pc.getSenders()) || [];
      next.getTracks().forEach(function (track) {
        var sender = senders.find(function (s) {
          return s.track && s.track.kind === track.kind;
        });
        if (sender) sender.replaceTrack(track);
      });
    });
  }

  function toggleMute() {
    var tracks = streamRef.current && streamRef.current.getAudioTracks();
    var t = tracks && tracks[0];
    if (t) {
      t.enabled = !t.enabled;
      setMuted(!t.enabled);
    }
  }
  function toggleCam() {
    var tracks = streamRef.current && streamRef.current.getVideoTracks();
    var t = tracks && tracks[0];
    if (t) {
      t.enabled = !t.enabled;
      setCamOff(!t.enabled);
    }
  }

  function toggleHand() {
    setHand(function (h) {
      var next = !h;
      handRef.current = next;
      broadcast({ type: "hand", on: next });
      return next;
    });
  }

  async function toggleShare() {
    if (sharing) {
      var cam = camStreamRef.current;
      if (cam) replaceTracks(cam);
      setSharing(false);
      sharingRef.current = false;
      setSpotId(null);
      broadcast({ type: "share", on: false });
      return;
    }
    if (!canScreenShare()) {
      setShareHint("Screen share needs desktop Chrome or Edge");
      setTimeout(function () {
        setShareHint("");
      }, 4000);
      return;
    }
    try {
      var screen = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 15 },
        audio: false,
      });
      var audio = (streamRef.current && streamRef.current.getAudioTracks()) || [];
      var mixed = new MediaStream(screen.getVideoTracks().concat(audio));
      screen.getVideoTracks()[0].onended = function () {
        if (camStreamRef.current) replaceTracks(camStreamRef.current);
        setSharing(false);
        sharingRef.current = false;
        setSpotId(null);
        broadcast({ type: "share", on: false });
      };
      replaceTracks(mixed);
      setSharing(true);
      sharingRef.current = true;
      setCamOff(false);
      setSpotId("local");
      broadcast({ type: "share", on: true });
    } catch (e) {}
  }

  var count = peers.length + 1;
  var stageClass = spotId
    ? "spotlight"
    : count <= 1
      ? "alone"
      : count === 3
        ? "trio"
        : "";
  var selfLabel =
    shortWallet(wallet) ||
    [role || status, mediaNote].filter(Boolean).join(" · ") ||
    "You";

  return (
    <>
      <div className="stage-wrap">
        <div className={"stage " + stageClass}>
          <div
            className={
              "tile camera" +
              (hand ? " hand" : "") +
              (spotId === "local" ? " spot" : "")
            }
          >
            <video ref={localRef} autoPlay muted playsInline />
            {(camOff ||
              !(streamRef.current && streamRef.current.getVideoTracks().length)) && (
              <div className="avatar">{(wallet || "Y").slice(0, 1).toUpperCase()}</div>
            )}
            <div className="tag">You · {selfLabel}</div>
            <div className="badges">
              {hand && <span className="badge hand">Hand</span>}
              {sharing && <span className="badge">Sharing</span>}
              {muted && <span className="badge">Muted</span>}
            </div>
            {sharing && (
              <button
                type="button"
                className="expand"
                onClick={function () {
                  setSpotId(function (s) {
                    return s === "local" ? null : "local";
                  });
                }}
              >
                {spotId === "local" ? "Exit full" : "Expand"}
              </button>
            )}
          </div>

          {peers.map(function (p) {
            return (
              <Remote
                key={p.id}
                stream={p.stream}
                label={p.id.slice(0, 10)}
                hand={!!hands[p.id]}
                sharing={!!sharingIds[p.id]}
                spot={spotId === p.id}
                onExpand={function () {
                  setSpotId(function (s) {
                    return s === p.id ? null : p.id;
                  });
                }}
              />
            );
          })}

          {peers.length === 0 && status === "live" && (
            <div className="tile wait">
              <div className="avatar">+</div>
              <div className="tag">
                {role === "host"
                  ? "Waiting for others — share Meeting ID"
                  : "Connecting to host…"}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="dock">
        <button
          type="button"
          className={muted ? "ctrl off" : "ctrl"}
          onClick={toggleMute}
        >
          {muted ? "Mic off" : "Mic"}
        </button>
        <button
          type="button"
          className={camOff ? "ctrl off" : "ctrl"}
          onClick={toggleCam}
        >
          {camOff ? "Cam off" : "Cam"}
        </button>
        <button
          type="button"
          className={sharing ? "ctrl on" : "ctrl"}
          onClick={toggleShare}
        >
          {sharing ? "Stop" : "Share"}
        </button>
        <button
          type="button"
          className={hand ? "ctrl on" : "ctrl"}
          onClick={toggleHand}
        >
          Hand
        </button>
        <a className="ctrl leave" href="/">
          Leave
        </a>
        {shareHint ? <div className="hint">{shareHint}</div> : null}
      </div>
    </>
  );
}

function Remote({ stream, label, hand, sharing, spot, onExpand }) {
  var ref = useRef(null);
  var _hv = useState(true);
  var hasVideo = _hv[0];
  var setHasVideo = _hv[1];

  useEffect(
    function () {
      var v = ref.current;
      if (!v || !stream) return;
      v.srcObject = stream;
      v.muted = false;
      v.play().catch(function () {
        v.muted = true;
        v.play()
          .then(function () {
            v.muted = false;
          })
          .catch(function () {});
      });
      var vid = stream.getVideoTracks()[0];
      setHasVideo(!!vid && vid.readyState === "live");
      function onMute() {
        setHasVideo(!!(vid && vid.enabled && vid.readyState === "live"));
      }
      if (vid) {
        vid.addEventListener("ended", onMute);
        vid.addEventListener("mute", onMute);
        vid.addEventListener("unmute", onMute);
      }
      return function () {
        if (vid) {
          vid.removeEventListener("ended", onMute);
          vid.removeEventListener("mute", onMute);
          vid.removeEventListener("unmute", onMute);
        }
      };
    },
    [stream]
  );

  return (
    <div
      className={
        "tile camera" + (hand ? " hand" : "") + (spot ? " spot" : "")
      }
    >
      <video ref={ref} autoPlay playsInline />
      {!hasVideo && (
        <div className="avatar">{(label || "?").slice(0, 1).toUpperCase()}</div>
      )}
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
