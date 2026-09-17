"use client";
import ConnectButton from "../components/ConnectButton";
import CreateRoom from "../components/CreateRoom";
export default function Home() {
  return (
    <div className="wrap">
      <nav className="nav"><a className="brand" href="/">Hood<span>Meet</span></a><ConnectButton /></nav>
      <span className="badge">Robinhood Chain · testnet 46630</span>
      <h1>Video rooms that settle on-chain.</h1>
      <p className="lede">Wallet login. Paid and token-gated rooms in MEET. Media is peer-to-peer.</p>
      <div className="grid"><CreateRoom /><div className="card"><h2>Flywheel (MVP)</h2><p className="lede" style={{fontSize:15,margin:0}}>Open rooms free. Paid rooms pull MEET. Host closes → 90% host, 10% treasury.</p></div></div>
    </div>
  );
}
