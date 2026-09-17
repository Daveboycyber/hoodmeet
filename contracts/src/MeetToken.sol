// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "openzeppelin-contracts/contracts/access/Ownable.sol";

/// @title MEET — utility token for HoodMeet rooms, subscriptions, and node rewards
contract MeetToken is ERC20, Ownable {
    uint256 public constant MAX_SUPPLY = 1_000_000_000 ether;

    constructor() ERC20("HoodMeet", "MEET") Ownable(msg.sender) {
        _mint(msg.sender, 100_000_000 ether);
    }

    function mint(address to, uint256 amount) external onlyOwner {
        require(totalSupply() + amount <= MAX_SUPPLY, "cap");
        _mint(to, amount);
    }
}
