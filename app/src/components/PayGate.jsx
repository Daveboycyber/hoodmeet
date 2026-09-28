"use client";

import { useEffect, useState } from "react";
import { decodeFunctionResult, encodeFunctionData } from "viem";
import { approveMeet, call, joinRoom, slugId } from "../lib/eth";
import { roomAbi } from "../abi/RoomRegistry";
import { CONTRACTS } from "../lib/chain";

export default function PayGate({ slug, children }) {
  const [needPay, setNeedPay] = useState(false);
  const [id, setId] = useState(0n);
  const [msg, setMsg] = useState("");
  const [ok, setOk] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        if (!window.ethereum) {
          if (live) setChecking(false);
          return;
        }
        const acc =
          (await window.ethereum.request({ method: "eth_accounts" }))[0] || "";
        const n = await slugId(slug);
        if (!live) return;
        if (n === 0n) {
          setChecking(false);
          return;
        }
        setId(n);
        const data = encodeFunctionData({
          abi: roomAbi,
          functionName: "rooms",
          args: [n],
        });
        const raw = await call(CONTRACTS.rooms, data);
        const room = decodeFunctionResult({
          abi: roomAbi,
          functionName: "rooms",
          data: raw,
        });
        const access = Number(room.access ?? room[3] ?? 0);
        const host = String(room.host ?? room[0] ?? "").toLowerCase();
        const isHost = acc && host === acc.toLowerCase();
        if (live) {
          setNeedPay(access === 1 && !isHost);
          setChecking(false);
        }
      } catch {
        if (live) setChecking(false);
      }
    })();
    return () => {
      live = false;
    };
  }, [slug]);

  if (checking) {
    return (
      <div className="join">
        <div className="join-card">
          <p className="wallet">Checking room…</p>
        </div>
      </div>
    );
  }

  if (ok || !needPay) return children;

  async function pay() {
    setMsg("1/2 Approve MEET in MetaMask");
    try {
      await approveMeet();
      setMsg("2/2 Join room in MetaMask");
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
        <p>This room requires MEET. Host does not pay.</p>
        <button className="btn-blue" type="button" onClick={pay}>
          Pay &amp; enter
        </button>
        {msg && <p className="wallet">{msg}</p>}
      </div>
    </div>
  );
}
