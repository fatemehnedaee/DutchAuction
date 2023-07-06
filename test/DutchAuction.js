const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time, mine } = require("@nomicfoundation/hardhat-network-helpers");

const getCurrentPrice = async function (minPrice, maxPrice, startDate, endDate){
  const blockNumBefore = await ethers.provider.getBlockNumber();
  const blockBefore = await ethers.provider.getBlock(blockNumBefore);
  const timestampBefore = blockBefore.timestamp
  const elapsedTime = timestampBefore - startDate
  const stepPrice = (maxPrice - minPrice) / (BigInt(endDate) - BigInt(startDate))
  return minPrice + (stepPrice * BigInt(elapsedTime))
}

describe("DutchAuction", function () {
  
  let dutchAuction
  let myToken
  let currentDate
  let startDate
  let endDate
  const minPrice = ethers.parseEther("1")
  const maxPrice = ethers.parseEther("5")

  before(async function() {
    dutchAuction = await ethers.deployContract("DutchAuction")
    myToken = await ethers.deployContract("MyToken");

    [owner, signer1, signer2, signer3] = await ethers.getSigners()
  })

  describe("List", function(){

    it("should revert if collection address is zero!", async function() {
      await expect(dutchAuction.list(ethers.ZeroAddress, 0, 0, 0, 0, 0))
      .to.be.revertedWith("Not exist collection!")
    })

    it("should revert if msg sender is not equal with owner!", async function() {
      await myToken.safeMint(owner)
      await expect(dutchAuction.connect(signer1).list(await myToken.getAddress(), 0, 0, 0, 0, 0))     
      .to.be.revertedWith("Invalid owner!")
    })

    it("should revert if min price is equal with zero and max price is less and equal than min price!", async function() {
      await expect(dutchAuction.list(myToken.getAddress(), 0, ethers.parseEther("0"), ethers.parseEther("0"), 0, 0))
      .to.be.revertedWith("Invalid price!")
    })

    it("should revert if end date is less and equal than start date!", async function() {
      await expect(dutchAuction
        .list(myToken.getAddress(), 0, minPrice, maxPrice, Date.now(), Date.now()))
        .to.be.revertedWith("Invalid date!")
    })

    it("should list successfuly", async function() {
      currentDate = Math.trunc(Date.now() / 1000)
      await time.setNextBlockTimestamp(currentDate)
      await mine()
      startDate = currentDate
      endDate = currentDate + (60*60*24*5)
      await expect(dutchAuction.connect(owner).list(myToken.getAddress(), 0, minPrice, maxPrice, startDate, endDate))
      .to.emit(dutchAuction, 'List')
      .withArgs(owner.address, await myToken.getAddress(), 0, minPrice, maxPrice, startDate, endDate)

      // Testing list with take parametres of list
      const listItem = await dutchAuction.lists(await myToken.getAddress(), 0)
      expect(listItem)
      .to.be.deep.equal([owner.address, await myToken.getAddress(), 0, minPrice, maxPrice, startDate, endDate])

      // Approved token 0 to dutchAuction
      await myToken.connect(owner).approve(await dutchAuction.getAddress(), 0)

    })
  })

  describe("GetPrice", function(){

    it("should revert if current date is less than start date!", async function(){
      await expect(dutchAuction.getPrice(minPrice, maxPrice, currentDate + 100, currentDate + 200))
      .to.be.revertedWith("buy not start!")
    })

    it("should revert if current date is longer than end date!", async function(){
      await expect(dutchAuction.getPrice(minPrice, maxPrice, currentDate - 200, currentDate - 100))
      .to.be.revertedWith("buy ended!")
    })

    it("get price successfuly", async function(){
      const currentPrice = await dutchAuction.getPrice(minPrice, maxPrice, startDate, endDate)
      expect(currentPrice).to.be.equal(await getCurrentPrice(minPrice, maxPrice, startDate, endDate))
    })

  })

  describe("Buy", function(){

    it("should revert if owner address is zero", async function(){
      await expect(dutchAuction.buy(await myToken.getAddress(), 1)).to.be.revertedWith("Token id not exist!");
    })

    it("should revert if value is less than current price", async function(){
      const currentPrice = await dutchAuction.getPrice(minPrice, maxPrice, startDate, endDate)
      const value = currentPrice - ethers.parseEther("1.0")
      await expect(dutchAuction.connect(signer1).buy(await myToken.getAddress(), 0, {value: value}))
      .to.be.revertedWith("Invalid value!");
    })

    it("should transfer price to owner successful and changed owner and delete token0 from lists", async function(){
      const currentPrice = await getCurrentPrice(minPrice, maxPrice, startDate, endDate)
      const value = currentPrice + ethers.parseEther("1.0")
      const oldOwnerBalance = await ethers.provider.getBalance(owner)
      await(dutchAuction.connect(signer1).buy(await myToken.getAddress(), 0, {value: value}))
      const newOwnerBalance =await ethers.provider.getBalance(owner)
      expect(newOwnerBalance).to.be.equal(oldOwnerBalance + currentPrice)
      
      // Changed owner
      const newOwner = await myToken.ownerOf(0)
      expect(newOwner).to.be.equal(signer1.address)

      // Delete token0 from lists
      expect((await dutchAuction.lists(await myToken.getAddress(), 0))[0]).to.be.equal(ethers.ZeroAddress)
    })

  })
  
})
