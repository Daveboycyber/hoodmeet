"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ConnectButton from "../components/ConnectButton";
import { createRoom } from "../lib/eth";

export default function Home() {
  const router = useRouter();
  const [slug, setSlug] = useState("");
  const [access, setAccess] = useState("0");
  const [price, setPrice] = useState("10");
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");

  function cleanId() {
    return slug.toLowerCase().replace(/[^a-z0-9-]/g, "");
  }

  async function onJoin(e) {
    e.preventDefault();
    const id = cleanId();
    if (id.length < 3) {
      setErr("Meeting ID needs at least 3 letters");
      return;
    }
    setErr("");
    router.push("/room/" + id);
  }

  async function onHost(e) {
    e.preventDefault();
    const id = cleanId();
    if (id.length < 3) {
      setErr("Meeting ID needs at least 3 letters");
      return;
    }
    setErr("");

    // Open rooms: no chain tx, just open the video room
    if (access === "0") {
      router.push("/room/" + id);
      return;
    }

    // Paid rooms: register on-chain first (gas only for host; no MEET spend)
    setBusy("Confirm in MetaMask (create room)…");
    try {
      await createRoom({
        slug: id,
        title: id,
        access: 1,
        priceMeet: price,
      });
      setBusy("");
      router.push("/room/" + id);
    } catch (ex) {
      setBusy("");
      setErr(ex.shortMessage || ex.message || "rejected");
    }
  }

  return (
    <div className="join">
      <div className="join-card">
        <div className="logo">
          <i>H</i> HoodMeet
        </div>
        <h1>Join a meeting</h1>
        <p>Open rooms are free. Paid rooms charge MEET when a guest joins.</p>
        <form>
          <label>Meeting ID</label>
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="my-room"
            required
            minLength={3}
          />
          <label>Access</label>
          <select value={access} onChange={(e) => setAccess(e.target.value)}>
            <option value="0">Open (free)</option>
            <option value="1">Paid (MEET)</option>
          </select>
          {access === "1" && (
            <>
              <label>Price in MEET</label>
              <input
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                type="number"
                min="1"
              />
            </>
          )}
          <div className="actions">
            <button className="btn-blue" type="button" onClick={onJoin} disabled={!!busy}>
              Join
            </button>
            <button className="btn-ghost" type="button" onClick={onHost} disabled={!!busy}>
              Host a meeting
            </button>
          </div>
        </form>
        {busy && <p className="wallet">{busy}</p>}
        {err && <p className="err">{err}</p>}
        <div className="wallet">
          <ConnectButton />
        </div>
        <p className="wallet" style={{ marginTop: 12 }}>
          Use the same Meeting ID in both windows. Host first, then Join.
        </p>
      </div>
    </div>
  );
}
