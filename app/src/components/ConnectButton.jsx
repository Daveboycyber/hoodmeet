"use client";

import { useAccount, useConnect, useDisconnect, useChainId, useSwitchChain } from "wagmi";
import { activeChain } from "../lib/chain";

export default function ConnectButton() {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();

  if (!isConnected) {
    return (
      <button className="pill" disabled={isPending} onClick={() => connect({ connector: connectors[0] })}>
        {isPending ? "Connecting…" : "Connect wallet"}
      </button>
    );
  }

  const short = `${address.slice(0, 6)}…${address.slice(-4)}`;
  const wrong = chainId !== activeChain.id;

  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      {wrong && (
        <button className="pill" onClick={() => switchChain({ chainId: activeChain.id })}>
          Switch to Robinhood Testnet
        </button>
      )}
      <button className="pill" onClick={() => disconnect()}>{short}</button>
    </div>
  );
}
