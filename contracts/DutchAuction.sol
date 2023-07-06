// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "hardhat/console.sol";

contract DutchAuction {

    event List (address owner, address collectionAddress, uint tockenId, uint minPrice, uint maxPrice, uint startDate, uint endDate);
    event Buy (address owner, address buyer, address collectionAddress, uint tockenId, uint buyPrice, uint date);

    struct ListItem {
        address owner;
        address collectionAddress;
        uint tockenId;
        uint minPrice;
        uint maxPrice;
        uint startDate;
        uint endDate;
    }

    mapping (address => mapping (uint => ListItem)) public lists;
   
    function list (address collectionAddress, uint tockenId, uint minPrice, uint maxPrice, uint startDate, uint endDate) public {

        require (collectionAddress != address(0), "Not exist collection!");

        address ownerOf = IERC721(collectionAddress).ownerOf(tockenId);
        require (msg.sender == ownerOf, "Invalid owner!");

        require (minPrice > 0 && maxPrice > minPrice , "Invalid price!");

        require (endDate > startDate, "Invalid date!");

        lists[collectionAddress][tockenId] = ListItem ({
            owner: msg.sender,
            collectionAddress: collectionAddress,
            tockenId: tockenId,
            minPrice: minPrice,
            maxPrice: maxPrice,
            startDate: startDate,
            endDate: endDate
        });

        emit List(msg.sender, collectionAddress, tockenId, minPrice, maxPrice, startDate, endDate);

    }

    function getPrice (uint minPrice, uint maxPrice, uint startDate, uint endDate) public view returns (uint correntPrice) {
         
        uint currentDate = block.timestamp;
    
        require (currentDate >= startDate, "buy not start!");
        require (currentDate <= endDate, "buy ended!");

        uint elapsedTime = currentDate - startDate;
        uint stepPrice = (maxPrice - minPrice) / (endDate - startDate);
        uint currentPrice;

        if(currentDate >= startDate && currentDate <= endDate){
            currentPrice = minPrice + (stepPrice * elapsedTime);
        }

        return currentPrice;

    }

    function buy (address collectionAddress, uint tockenId) public payable {

        ListItem memory listtItem = lists[collectionAddress][tockenId];
        require(listtItem.owner != address(0), "Token id not exist!");

        uint currentPrice = getPrice (listtItem.minPrice, listtItem.maxPrice, listtItem.startDate, listtItem.endDate);
        uint currentDate = block.timestamp;

        require(msg.value >= currentPrice, "Invalid value!");

        (bool success, ) = listtItem.owner.call{value: currentPrice}("");
        require(success, "Send ETH failed!");

        IERC721(collectionAddress).safeTransferFrom(listtItem.owner, msg.sender, tockenId);

        emit Buy(listtItem.owner, msg.sender, collectionAddress, tockenId, currentPrice, currentDate);

        delete lists[collectionAddress][tockenId];

    }

}
