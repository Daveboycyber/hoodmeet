// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "openzeppelin-contracts/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";

contract RoomRegistry is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable meet;
    address public treasury;
    uint16 public protocolBps = 1000;

    enum Access { Open, Paid, TokenGated }

    struct Room {
        address host;
        string slug;
        string title;
        Access access;
        uint256 price;
        uint256 minStake;
        uint32 maxParticipants;
        uint64 createdAt;
        bool active;
        bool recording;
    }

    uint256 public nextRoomId = 1;
    mapping(uint256 => Room) public rooms;
    mapping(string => uint256) public slugToId;
    mapping(uint256 => mapping(address => bool)) public paid;
    mapping(uint256 => uint256) public collected;

    event RoomCreated(uint256 indexed id, address indexed host, string slug, Access access, uint256 price);
    event RoomJoined(uint256 indexed id, address indexed user);
    event RoomClosed(uint256 indexed id);
    event Payout(uint256 indexed id, address indexed host, uint256 hostAmount, uint256 protocolAmount);

    constructor(IERC20 _meet, address _treasury) Ownable(msg.sender) {
        meet = _meet;
        treasury = _treasury;
    }

    function setProtocolBps(uint16 bps) external onlyOwner {
        require(bps <= 2000, "max 20%");
        protocolBps = bps;
    }

    function setTreasury(address t) external onlyOwner {
        require(t != address(0), "zero");
        treasury = t;
    }

    function createRoom(
        string calldata slug,
        string calldata title,
        Access access,
        uint256 price,
        uint256 minStake,
        uint32 maxParticipants,
        bool recording
    ) external returns (uint256 id) {
        require(bytes(slug).length >= 3 && bytes(slug).length <= 32, "slug");
        require(slugToId[slug] == 0, "taken");
        require(maxParticipants >= 2 && maxParticipants <= 50, "size");
        if (access == Access.Paid) require(price > 0, "price");
        if (access == Access.TokenGated) require(minStake > 0, "stake");

        id = nextRoomId++;
        rooms[id] = Room({
            host: msg.sender,
            slug: slug,
            title: title,
            access: access,
            price: price,
            minStake: minStake,
            maxParticipants: maxParticipants,
            createdAt: uint64(block.timestamp),
            active: true,
            recording: recording
        });
        slugToId[slug] = id;
        emit RoomCreated(id, msg.sender, slug, access, price);
    }

    function joinRoom(uint256 id) external nonReentrant {
        Room storage r = rooms[id];
        require(r.active, "closed");
        require(r.host != address(0), "missing");

        if (r.access == Access.Paid && msg.sender != r.host) {
            if (!paid[id][msg.sender]) {
                meet.safeTransferFrom(msg.sender, address(this), r.price);
                paid[id][msg.sender] = true;
                collected[id] += r.price;
            }
        } else if (r.access == Access.TokenGated && msg.sender != r.host) {
            require(meet.balanceOf(msg.sender) >= r.minStake, "gate");
        }

        emit RoomJoined(id, msg.sender);
    }

    function closeAndSettle(uint256 id) external nonReentrant {
        Room storage r = rooms[id];
        require(msg.sender == r.host || msg.sender == owner(), "auth");
        require(r.active, "closed");
        r.active = false;

        uint256 pot = collected[id];
        collected[id] = 0;
        if (pot > 0) {
            uint256 proto = (pot * protocolBps) / 10_000;
            uint256 hostAmt = pot - proto;
            if (proto > 0) meet.safeTransfer(treasury, proto);
            if (hostAmt > 0) meet.safeTransfer(r.host, hostAmt);
            emit Payout(id, r.host, hostAmt, proto);
        }
        emit RoomClosed(id);
    }

    function canJoin(uint256 id, address user) external view returns (bool) {
        Room storage r = rooms[id];
        if (!r.active) return false;
        if (user == r.host) return true;
        if (r.access == Access.Open) return true;
        if (r.access == Access.Paid) return paid[id][user];
        if (r.access == Access.TokenGated) return meet.balanceOf(user) >= r.minStake;
        return false;
    }
}
