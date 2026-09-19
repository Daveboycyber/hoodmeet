"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { useRouter } from "next/navigation";
import ConnectButton from "../components/ConnectButton";

export default function Home() {
  const { isConnected } = useAccount();
  const router = useRouter();
  const [slug, setSlug] = useState("");

  function go(e) {
    e.preventDefault();
    const id = slug.toLowerCase().replace(/[^a-z0-9-]/g, "") || "demo";
    router.push(`/room/${id}`);
  }

  return (
    <div className="join">
      <div className="join-card">
        <div className="logo"><i>H</i> HoodMeet</div>
        <h1>Join a meeting</h1>
        <p>Simple video rooms on Robinhood Chain</p>
        <form onSubmit={go}>
          <label>Meeting ID</label>
          <input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="Enter meeting ID" required minLength={3} />
          <div className="actions">
            <button className="btn-blue" type="submit">Join</button>
            <button className="btn-ghost" type="submit">Host a meeting</button>
          </div>
        </form>
        <div className="wallet"><ConnectButton /></div>
        {!isConnected && <p className="wallet">Connect a wallet to host a paid or token-gated room.</p>}
      </div>
    </div>
  );
}
