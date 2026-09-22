"use client";

import { useEffect, useState } from "react";
import { approveMeet, joinRoom, slugId } from "../lib/eth";

export default function PayGate({ slug, children }) {
  const [needPay, setNeedPay] = useState(false);
  const [id, setId] = useState(0n);
  const [msg, setMsg] = useState("");
  const [ok, setOk] = useState(false);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        if (!window.ethereum) return;
        const n = await slugId(slug);
        if (!live) return;
        setId(n);
        setNeedPay(n > 0n);
      } catch {
        /* open demo room with no on-chain record */
      }
    })();
    return () => {
      live = false;
    };
  }, [slug]);

  if (ok || !needPay) return children;

  async function pay() {
    setMsg("Approve MEET in MetaMask…");
    try {
      await approveMeet();
      setMsg("Join room in MetaMask…");
      await joinRoom(id);
      setOk(true);
    } catch (e) {
      setMsg(e.message || "rejected");
    }
  }

  return (
    <div className="join">
      <div className="join-card">
        <h1>Paid room</h1>
        <p>This meeting ID is on-chain. Approve MEET, then join.</p>
        <button className="btn-blue" type="button" onClick={pay}>
          Pay &amp; enter
        </button>
        {msg && <p className="wallet">{msg}</p>}
        <p className="wallet">Host can enter without paying.</p>
      </div>
    </div>
  );
}
