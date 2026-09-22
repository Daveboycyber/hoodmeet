export const roomAbi = [
  { type: "function", name: "createRoom", stateMutability: "nonpayable", inputs: [
    { name: "slug", type: "string" }, { name: "title", type: "string" }, { name: "access", type: "uint8" },
    { name: "price", type: "uint256" }, { name: "minStake", type: "uint256" },
    { name: "maxParticipants", type: "uint32" }, { name: "recording", type: "bool" }
  ], outputs: [{ name: "id", type: "uint256" }] },
  { type: "function", name: "joinRoom", stateMutability: "nonpayable", inputs: [{ name: "id", type: "uint256" }], outputs: [] },
  { type: "function", name: "slugToId", stateMutability: "view", inputs: [{ name: "", type: "string" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "rooms", stateMutability: "view", inputs: [{ name: "", type: "uint256" }], outputs: [
    { name: "host", type: "address" }, { name: "slug", type: "string" }, { name: "title", type: "string" },
    { name: "access", type: "uint8" }, { name: "price", type: "uint256" }, { name: "minStake", type: "uint256" },
    { name: "maxParticipants", type: "uint32" }, { name: "createdAt", type: "uint64" },
    { name: "active", type: "bool" }, { name: "recording", type: "bool" }
  ] }
];
