// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {MeetToken} from "../src/MeetToken.sol";
import {RoomRegistry} from "../src/RoomRegistry.sol";

contract Deploy is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address treasury = vm.envOr("TREASURY", vm.addr(pk));
        vm.startBroadcast(pk);
        MeetToken token = new MeetToken();
        RoomRegistry rooms = new RoomRegistry(token, treasury);
        vm.stopBroadcast();
    }
}
