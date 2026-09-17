"use client";
import { useState } from "react";
import { useAccount } from "wagmi";
import { useRouter } from "next/navigation";
export default function CreateRoom() {
  const { address, isConnected } = useAccount();
  const router = useRouter();
  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");
  const [access, setAccess] = useState(0);
  const [maxP, setMaxP] = useState(8);
  function submit(e) { e.preventDefault(); router.push("/room/"+(slug.toLowerCase().replace(/[^a-z0-9-]/g,"")||"demo")); }
  return (
    <form className="card" onSubmit={submit}>
      <h2>New room</h2>
      <label>Slug</label><input value={slug} onChange={e=>setSlug(e.target.value)} placeholder="dao-call" required minLength={3} />
      <label>Title</label><input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Weekly governance" />
      <div className="row"><div><label>Access</label><select value={access} onChange={e=>setAccess(Number(e.target.value))}><option value={0}>Open</option><option value={1}>Paid (MEET)</option><option value={2}>Token-gated</option></select></div><div><label>Max people</label><input type="number" min={2} max={50} value={maxP} onChange={e=>setMaxP(e.target.value)} /></div></div>
      <button className="btn" disabled={!isConnected}>{isConnected ? "Open local room (contracts not deployed)" : "Connect wallet first"}</button>
      {address && <p className="meta">Host {address}</p>}
    </form>
  );
}
