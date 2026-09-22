"use client";

import { useEffect, useState } from "react";
import { decodeFunctionResult } from "viem";
import { approveMeet, call, joinRoom, slugId } from "../lib/eth";
import { roomAbi } from "../abi/RoomRegistry";
import { CONTRACTS } from "../lib/chain";
import { encodeFunctionData } from "viem";

export default function PayGate({ slug, children }) {
  const [paid, setPaid] = useState(false);
  const [id, setId] = useState(0n);
  const [msg, setMsg] = useState("");
  const [ok, setOk] = useState(false);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        if (!window.ethereum) return;
        const n = await slugId(slug);
        if (!live || n === 0n) return;
        setId(n);
        const data = encodeFunctionData({ abi: roomAbi, functionName: "rooms", args: [n] });
        const raw = await call(CONTRACTS.rooms, data);
        const room = decodeFunctionResult({ abi: roomAbi, functionName: "rooms", data: raw });
        const access = Number(room.access ?? room[3]);
        if (live) setPaid(access === 1);
      } catch {
        /* stay open */
      }
    })();
    return () => {
      live = false;
    };
  }, [slug]);

  if (ok || !paid) return children;

  async function pay() {
    setMsg("1/2 Approve MEET");
    try {
      await approveMeet();
      setMsg("2/2 Join room");
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
        <p>Approve MEET, then join. Host does not pay.</p>
        <button className="btn-blue" type="button" onClick={pay}>Pay &amp; enter</button>
        {msg && <p className="wallet">{msg}</p>}
      </div>
    </div>
  );
}
