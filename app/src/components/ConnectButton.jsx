"use client";

import { useEffect, useState } from "react";

const TESTNET = {
  chainId: "0xb626",
  chainName: "Robinhood Chain Testnet",
  rpcUrls: ["https://rpc.testnet.chain.robinhood.com"],
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  blockExplorerUrls: ["https://explorer.testnet.chain.robinhood.com"],
};

export default function ConnectButton() {
  const [addr, setAddr] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    const eth = window.ethereum;
    if (!eth) return;
    eth.request({ method: "eth_accounts" }).then((a) => a[0] && setAddr(a[0]));
    const on = (a) => setAddr(a[0] || "");
    eth.on?.("accountsChanged", on);
    return () => eth.removeListener?.("accountsChanged", on);
  }, []);

  async function connect() {
    setErr("");
    const eth = window.ethereum;
    if (!eth) {
      setErr("Install MetaMask");
      return;
    }
    try {
      const acc = await eth.request({ method: "eth_requestAccounts" });
      setAddr(acc[0] || "");
      try {
        await eth.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: TESTNET.chainId }],
        });
      } catch (e) {
        if (e.code === 4902) {
          await eth.request({ method: "wallet_addEthereumChain", params: [TESTNET] });
        }
      }
    } catch (e) {
      setErr(e.message || "rejected");
    }
  }

  if (addr) {
    return (
      <button className="pill" type="button">
        {addr.slice(0, 6)}…{addr.slice(-4)}
      </button>
    );
  }
  return (
    <>
      <button className="pill" type="button" onClick={connect}>
        Connect wallet
      </button>
      {err && <p className="wallet">{err}</p>}
    </>
  );
}
