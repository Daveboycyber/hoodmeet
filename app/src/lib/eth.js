"use client";

import { encodeFunctionData, parseEther } from "viem";
import { roomAbi } from "../abi/RoomRegistry";
import { tokenAbi } from "../abi/MeetToken";
import { CONTRACTS } from "./chain";

export { parseEther };

export async function accounts() {
  const eth = window.ethereum;
  if (!eth) throw new Error("Install MetaMask");
  const a = await eth.request({ method: "eth_requestAccounts" });
  if (!a[0]) throw new Error("No account");
  return a[0];
}

export async function send(to, data) {
  const from = await accounts();
  return ethereum.request({
    method: "eth_sendTransaction",
    params: [{ from, to, data }],
  });
}

export async function call(to, data) {
  return window.ethereum.request({
    method: "eth_call",
    params: [{ to, data }, "latest"],
  });
}

export async function createRoom({ slug, title, access, priceMeet }) {
  const data = encodeFunctionData({
    abi: roomAbi,
    functionName: "createRoom",
    args: [
      slug,
      title || slug,
      access,
      access === 1 ? parseEther(priceMeet || "0") : 0n,
      0n,
      8,
      false,
    ],
  });
  return send(CONTRACTS.rooms, data);
}

export async function slugId(slug) {
  const data = encodeFunctionData({ abi: roomAbi, functionName: "slugToId", args: [slug] });
  const raw = await call(CONTRACTS.rooms, data);
  return BigInt(raw || "0");
}

export async function readRoom(id) {
  const data = encodeFunctionData({ abi: roomAbi, functionName: "rooms", args: [id] });
  const raw = await call(CONTRACTS.rooms, data);
  return raw;
}

export async function approveMeet() {
  const data = encodeFunctionData({
    abi: tokenAbi,
    functionName: "approve",
    args: [CONTRACTS.rooms, parseEther("1000000000")],
  });
  return send(CONTRACTS.token, data);
}

export async function joinRoom(id) {
  const data = encodeFunctionData({ abi: roomAbi, functionName: "joinRoom", args: [id] });
  return send(CONTRACTS.rooms, data);
}
