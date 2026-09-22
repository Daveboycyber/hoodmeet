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

  async function go(e) {
    e.preventDefault();
    const id = slug.toLowerCase().replace(/[^a-z0-9-]/g, "");
    if (id.length < 3) return;
    const isHost = e.nativeEvent.submitter?.textContent?.includes("Host");
    if (!isHost) {
      router.push("/room/" + id);
      return;
    }
    setErr("");
    setBusy("Check MetaMask…");
    try {
      await createRoom({ slug: id, title: id, access: Number(access), priceMeet: price });
      setBusy("Room created");
      router.push("/room/" + id);
    } catch (ex) {
      setBusy("");
      setErr(ex.shortMessage || ex.message || "rejected");
    }
  }

  return (
    <div className="join">
      <div className="join-card">
        <div className="logo"><i>H</i> HoodMeet</div>
        <h1>Join a meeting</h1>
        <p>Open rooms are free. Paid rooms take MEET on join.</p>
        <form onSubmit={go}>
          <label>Meeting ID</label>
          <input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="my-room" required minLength={3} />
          <label>Access</label>
          <select value={access} onChange={(e) => setAccess(e.target.value)}>
            <option value="0">Open (free)</option>
            <option value="1">Paid (MEET)</option>
          </select>
          {access === "1" && (
            <>
              <label>Price in MEET</label>
              <input value={price} onChange={(e) => setPrice(e.target.value)} type="number" min="1" />
            </>
          )}
          <div className="actions">
            <button className="btn-blue" type="submit" disabled={!!busy}>Join</button>
            <button className="btn-ghost" type="submit" disabled={!!busy}>Host a meeting</button>
          </div>
        </form>
        {busy && <p className="wallet">{busy}</p>}
        {err && <p className="err">{err}</p>}
        <div className="wallet"><ConnectButton /></div>
      </div>
    </div>
  );
}
