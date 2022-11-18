/* eslint-disable no-underscore-dangle */
/* eslint-disable no-await-in-loop */
/* eslint-disable no-plusplus */
const {
  time,
  loadFixture,
} = require('@nomicfoundation/hardhat-network-helpers')
const { anyValue } = require('@nomicfoundation/hardhat-chai-matchers/withArgs')
const { ethers } = require('hardhat')
const { expect } = require('chai')

const buyTicketBlock = (lotto, account, blockSize) => {
  const ticketsBought = []

  for (let index = 0; index < blockSize; index += 1) {
    ticketsBought.push(
      lotto
        .connect(account)
        .buyTicket({ value: ethers.utils.parseUnits('0.1', 'ether') })
    )
  }

  return ticketsBought
}

const evokeTicketBuyers = async (lotto, blockSize, ifConsoleLog) => {
  return (async () => {
    const [
      address1,
      address2,
      address3,
      address4,
      address5,
      address6,
      address7,
      address8,
      address9,
      address10,
    ] = await ethers.getSigners()

    await Promise.all(buyTicketBlock(lotto, address1, blockSize))
    if (ifConsoleLog) console.log('BLOCK 1 BOUGHT')
    await Promise.all(buyTicketBlock(lotto, address2, blockSize))
    if (ifConsoleLog) console.log('BLOCK 2 BOUGHT')
    await Promise.all(buyTicketBlock(lotto, address3, blockSize))
    if (ifConsoleLog) console.log('BLOCK 3 BOUGHT')
    await Promise.all(buyTicketBlock(lotto, address4, blockSize))
    if (ifConsoleLog) console.log('BLOCK 4 BOUGHT')
    await Promise.all(buyTicketBlock(lotto, address5, blockSize))
    if (ifConsoleLog) console.log('BLOCK 5 BOUGHT')
    await Promise.all(buyTicketBlock(lotto, address6, blockSize))
    if (ifConsoleLog) console.log('BLOCK 6 BOUGHT')
    await Promise.all(buyTicketBlock(lotto, address7, blockSize))
    if (ifConsoleLog) console.log('BLOCK 7 BOUGHT')
    await Promise.all(buyTicketBlock(lotto, address8, blockSize))
    if (ifConsoleLog) console.log('BLOCK 8 BOUGHT')
    await Promise.all(buyTicketBlock(lotto, address9, blockSize))
    if (ifConsoleLog) console.log('BLOCK 9 BOUGHT')
    await Promise.all(buyTicketBlock(lotto, address10, blockSize))
    if (ifConsoleLog) console.log('BLOCK 10 BOUGHT')
  })()
}

const manageTicketBuyers = (lotto, patches, soldTickets, ifConsoleLog) => {
  return (async () => {
    let patch = 1

    for (let index = 0; index < patches; index += 1) {
      // eslint-disable-next-line no-await-in-loop
      await evokeTicketBuyers(lotto, soldTickets / patches / 10, ifConsoleLog)
      if (ifConsoleLog) console.log(`PATCH ${patch++}`)
    }
  })()
}

describe('Lotto', () => {
  const vrfCoordinatorV2MockBaseFee = '100000000000000000'
  const vrfCoordinatorV2MockGasPriceLink = '1000000000'
  const keyHash =
    '0x0000000000000000000000000000000000000000000000000000000000000000'
  const vrfv2SubscriptionManagerLinkBalance = '5000000000000000000'
  const totalTickets = 300
  const onSaleTickets = 10
  const soldTickets = totalTickets - onSaleTickets
  const minBet = 0.1
  const maxBet = 10
  const duration = 604800
  const secondsInThirtyDays = 2592000

  // quick fix to let gas reporter fetch data from gas station & coinmarketcap
  before((done) => {
    setTimeout(done, 2000)
  })

  /* Fixture progression */
  const deployLotto = async () => {
    const linkTokenContract = await ethers.getContractFactory('LinkToken')
    const vrfCoordinatorV2MockContract = await ethers.getContractFactory(
      'VRFCoordinatorV2Mock'
    )
    const lottoContract = await ethers.getContractFactory('Lotto')
    const upkeepManagerContract = await ethers.getContractFactory(
      'UpkeepManager'
    )

    const linkToken = await linkTokenContract.deploy()
    await linkToken.deployed()

    const vrfCoordinatorV2Mock = await vrfCoordinatorV2MockContract.deploy(
      vrfCoordinatorV2MockBaseFee,
      vrfCoordinatorV2MockGasPriceLink
    )
    await vrfCoordinatorV2Mock.deployed()

    const upkeepManager = await upkeepManagerContract.deploy('0x')
    await upkeepManager.deployed()

    const lotto = await lottoContract.deploy(
      linkToken.address,
      vrfCoordinatorV2Mock.address,
      upkeepManager.address,
      keyHash,
      totalTickets,
      ethers.utils.parseUnits(minBet.toString(), 'ether'),
      ethers.utils.parseUnits(maxBet.toString(), 'ether'),
      duration
    )
    await lotto.deployed()
    await upkeepManager.setAutomationCompatibleContract(lotto.address)

    return { linkToken, vrfCoordinatorV2Mock, upkeepManager, lotto }
  }

  const startLotto = async () => {
    const { linkToken, vrfCoordinatorV2Mock, upkeepManager, lotto } =
      await loadFixture(deployLotto)
    const vrfv2SubscriptionManager = await ethers.getContractAt(
      'VRFv2SubscriptionManager',
      await lotto.getVRFv2SubscriptionManager()
      // lotto.address
    )

    await linkToken.transfer(
      vrfv2SubscriptionManager.address,
      vrfv2SubscriptionManagerLinkBalance
    )
    await lotto.startLottery()

    return {
      linkToken,
      vrfCoordinatorV2Mock,
      upkeepManager,
      lotto,
      vrfv2SubscriptionManager,
    }
  }

  const buyTickets = async () => {
    const {
      linkToken,
      vrfCoordinatorV2Mock,
      upkeepManager,
      lotto,
      vrfv2SubscriptionManager,
    } = await loadFixture(startLotto)
    await manageTicketBuyers(lotto, 1, soldTickets, false)

    return {
      linkToken,
      vrfCoordinatorV2Mock,
      upkeepManager,
      lotto,
      vrfv2SubscriptionManager,
    }
  }

  const findWinningNumber = async () => {
    const {
      linkToken,
      vrfCoordinatorV2Mock,
      upkeepManager,
      lotto,
      vrfv2SubscriptionManager,
    } = await loadFixture(buyTickets)

    await time.increase(duration)
    await upkeepManager.checkUpkeep()
    await upkeepManager.performUpkeep()

    const requestId = await vrfv2SubscriptionManager.s_requestId()
    const subscriptionId = await vrfv2SubscriptionManager.s_subscriptionId()

    await vrfCoordinatorV2Mock.fundSubscription(
      subscriptionId,
      vrfv2SubscriptionManagerLinkBalance
    )
    await vrfCoordinatorV2Mock.fulfillRandomWords(
      requestId,
      vrfv2SubscriptionManager.address
    )

    return {
      linkToken,
      vrfCoordinatorV2Mock,
      upkeepManager,
      lotto,
      vrfv2SubscriptionManager,
    }
  }

  const findWinners = async () => {
    const {
      linkToken,
      vrfCoordinatorV2Mock,
      upkeepManager,
      lotto,
      vrfv2SubscriptionManager,
    } = await loadFixture(findWinningNumber)

    await upkeepManager.checkUpkeep()
    await upkeepManager.performUpkeep()

    return {
      linkToken,
      vrfCoordinatorV2Mock,
      upkeepManager,
      lotto,
      vrfv2SubscriptionManager,
    }
  }

  describe('Deployment', () => {
    it('Should deploy lotto', async () => {
      const [address1] = await ethers.getSigners()
      const { linkToken, vrfCoordinatorV2Mock, upkeepManager, lotto } =
        await loadFixture(deployLotto)
      expect(linkToken).to.be.ok
      expect(linkToken.signer.address).to.eq(address1.address)
      expect(vrfCoordinatorV2Mock).to.be.ok
      expect(vrfCoordinatorV2Mock.signer.address).to.eq(address1.address)
      expect(upkeepManager).to.be.ok
      expect(upkeepManager.signer.address).to.eq(address1.address)
      expect(lotto).to.be.ok
      expect(lotto.signer.address).to.eq(address1.address)
    })
  })

  describe('getTimeLeft()', () => {
    it('Should not be able to call if the lottery has not started', async () => {
      const { lotto } = await loadFixture(deployLotto)
      await expect(lotto.getTimeLeft()).to.be.revertedWithCustomError(
        lotto,
        'Lotto__HasNotStarted'
      )
    })
  })

  describe('startLottery()', () => {
    it('Should not be able to start lottery other address than owner', async () => {
      const [, address2] = await ethers.getSigners()
      const { lotto } = await loadFixture(deployLotto)
      await expect(
        lotto.connect(address2).startLottery()
      ).to.be.revertedWithCustomError(lotto, 'Lotto__NotContractOwner')
    })

    it('Should not be able to start lottery if not enough link token for subscription manager', async () => {
      const { lotto } = await loadFixture(deployLotto)
      await expect(lotto.startLottery()).to.be.revertedWithCustomError(
        lotto,
        'Lotto__NotEnoughLinkToken'
      )
    })

    it('Should be able to start lottery', async () => {
      const { lotto, linkToken } = await loadFixture(deployLotto)
      const vrfv2SubscriptionManager = await ethers.getContractAt(
        'VRFv2SubscriptionManager',
        await lotto.getVRFv2SubscriptionManager()
        // lotto.address
      )

      await linkToken.transfer(
        vrfv2SubscriptionManager.address,
        vrfv2SubscriptionManagerLinkBalance
      )

      expect(await linkToken.balanceOf(vrfv2SubscriptionManager.address)).to.eq(
        vrfv2SubscriptionManagerLinkBalance
      )
      await lotto.startLottery()
      expect(await lotto.getHasLotteryStarted()).to.be.true
    })

    it('Should emit { LotteryStart } event', async () => {
      const { lotto, linkToken } = await loadFixture(deployLotto)
      const vrfv2SubscriptionManager = await ethers.getContractAt(
        'VRFv2SubscriptionManager',
        await lotto.getVRFv2SubscriptionManager()
        // lotto.address
      )
      await linkToken.transfer(
        vrfv2SubscriptionManager.address,
        vrfv2SubscriptionManagerLinkBalance
      )
      await expect(lotto.startLottery())
        .to.emit(lotto, 'LotteryStart')
        .withArgs(
          lotto.address,
          anyValue,
          anyValue,
          anyValue,
          anyValue,
          anyValue
        )
    })

    it('Should not be able to start lottery if already started', async () => {
      const { lotto } = await loadFixture(startLotto)
      await expect(lotto.startLottery()).to.be.revertedWithCustomError(
        lotto,
        'Lotto__HasStarted'
      )
    })
  })

  describe('getTimeLeft()', () => {
    it('Should return the correct time left until the finding of the winners can start', async () => {
      const { lotto } = await loadFixture(startLotto)
      const currentTimeLeft = await lotto.getTimeLeft()
      await time.increase(100)
      expect(await lotto.getTimeLeft()).to.eq(currentTimeLeft - 100)
    })

    it('Should return the 0 time left if over the lottery duration', async () => {
      const { lotto } = await loadFixture(startLotto)
      await time.increase(duration * 2)
      expect(await lotto.getTimeLeft()).to.eq(0)
    })
  })

  describe('buyTicket()', () => {
    it('Should be able to buy tickets', async () => {
      const { lotto } = await loadFixture(buyTickets)
      expect((await lotto.getSoldTickets()).toString()).to.eq(
        soldTickets.toString()
      )
      // }).timeout(((soldTickets * 100) / 1000) * 10000)
    })

    it('Should emit { TicketBuy } event', async () => {
      const [address1] = await ethers.getSigners()
      const { lotto } = await loadFixture(buyTickets)
      expect(
        lotto.buyTicket({
          value: ethers.utils.parseUnits(minBet.toString(), 'ether'),
        })
      )
        .to.emit(lotto, 'TicketBuy')
        .withArgs(
          soldTickets + 1,
          address1.address,
          anyValue,
          minBet.toString()
        )
    })

    it('Should not be able to buy a ticket with too small bet', async () => {
      const { lotto } = await loadFixture(buyTickets)
      await expect(
        lotto.buyTicket({
          value: ethers.utils.parseUnits((minBet * 0.9).toString(), 'ether'),
        })
      ).to.be.revertedWithCustomError(lotto, 'Lotto__NotEnoughEth')
    })

    it('Should not be able to buy a ticket with too large bet', async () => {
      const { lotto } = await loadFixture(buyTickets)
      await expect(
        lotto.buyTicket({
          value: ethers.utils.parseUnits((maxBet * 1.1).toString(), 'ether'),
        })
      ).to.be.revertedWithCustomError(lotto, 'Lotto__TooMuchEth')
    })

    it('Should not be able to buy more tickets than on the sale', async () => {
      const { lotto } = await loadFixture(buyTickets)
      await manageTicketBuyers(lotto, 1, onSaleTickets, false)
      await expect(
        lotto.buyTicket({
          value: ethers.utils.parseUnits(minBet.toString(), 'ether'),
        })
      ).to.be.revertedWithCustomError(lotto, 'Lotto__AllTicketsSold')
    })

    it('Should not be able to buy a ticket if duration time has passed', async () => {
      const { lotto } = await loadFixture(buyTickets)
      await time.increase(duration)
      await expect(
        lotto.buyTicket({
          value: ethers.utils.parseUnits(minBet.toString(), 'ether'),
        })
      ).to.be.revertedWithCustomError(lotto, 'Lotto__TicketSellClosed')
    })
  })

  describe('_receiveWinningNumber()', () => {
    it('Should not be able to call if not the subscription manager contract', async () => {
      const { lotto } = await loadFixture(buyTickets)
      await expect(
        lotto._receiveWinningNumber(
          '33026468577693300995530152895619301546891562659424953500679916443748860588810'
        )
      ).to.be.revertedWithCustomError(lotto, 'Lotto__InvalidCaller')
    })

    it('Should be able to call if subscription manager contract', async () => {
      const {
        lotto,
        vrfCoordinatorV2Mock,
        vrfv2SubscriptionManager,
        upkeepManager,
      } = await loadFixture(buyTickets)
      await time.increase(duration)
      await upkeepManager.checkUpkeep()
      expect(await upkeepManager.getIsUpkeepNeeded()).to.be.true
      await upkeepManager.performUpkeep()
      const requestId = await vrfv2SubscriptionManager.s_requestId()
      const subscriptionId = await vrfv2SubscriptionManager.s_subscriptionId()
      await vrfCoordinatorV2Mock.fundSubscription(
        subscriptionId,
        vrfv2SubscriptionManagerLinkBalance
      )
      expect(await lotto.getWinningNumber()).to.eq(0)
      await vrfCoordinatorV2Mock.fulfillRandomWords(
        requestId,
        vrfv2SubscriptionManager.address
      )
      expect(await lotto.getWinningNumber()).to.not.eq(0)
    })

    it('Should emit { WinningNumberRequest } event', async () => {
      const { lotto, upkeepManager } = await loadFixture(buyTickets)
      await time.increase(duration)
      await upkeepManager.checkUpkeep()
      await expect(upkeepManager.performUpkeep())
        .to.emit(lotto, 'WinningNumberRequest')
        .withArgs(lotto.address, anyValue)
    })

    it('Should emit { WinningNumberReceived } event', async () => {
      const {
        lotto,
        vrfCoordinatorV2Mock,
        vrfv2SubscriptionManager,
        upkeepManager,
      } = await loadFixture(buyTickets)
      await time.increase(duration)
      await upkeepManager.checkUpkeep()
      expect(await upkeepManager.getIsUpkeepNeeded()).to.be.true
      await upkeepManager.performUpkeep()
      const requestId = await vrfv2SubscriptionManager.s_requestId()
      const subscriptionId = await vrfv2SubscriptionManager.s_subscriptionId()
      await vrfCoordinatorV2Mock.fundSubscription(
        subscriptionId,
        vrfv2SubscriptionManagerLinkBalance
      )
      expect(await lotto.getWinningNumber()).to.eq(0)
      await expect(
        vrfCoordinatorV2Mock.fulfillRandomWords(
          requestId,
          vrfv2SubscriptionManager.address
        )
      )
        .to.emit(lotto, 'WinningNumberReceived')
        .withArgs(lotto.address, anyValue, anyValue)
    })
  })

  describe('clean()', () => {
    it('Should not be able to call while to lotto has not ended', async () => {
      const { lotto } = await loadFixture(buyTickets)
      await expect(lotto.clean()).to.be.revertedWithCustomError(
        lotto,
        'Lotto__HasNotEnded'
      )
    })
  })

  describe('Finding Winners', () => {
    it(`Should not be able to check a ticket while the lotto is still open`, async () => {
      const { lotto } = await loadFixture(buyTickets)
      expect(await lotto.getHasLotteryStarted()).to.be.true
      await expect(lotto.checkTicket(0)).to.be.revertedWithCustomError(
        lotto,
        'Lotto__HasNotEnded'
      )
    })

    it('Should not be able to find the winning number if game time has not passed', async () => {
      const { upkeepManager } = await loadFixture(buyTickets)
      await upkeepManager.checkUpkeep()
      expect(await upkeepManager.getIsUpkeepNeeded()).to.be.false
    })

    it('Should be able to find the winning number', async () => {
      const { lotto, vrfv2SubscriptionManager } = await loadFixture(
        findWinningNumber
      )
      expect(await lotto.getWinningNumber()).to.eq(
        await vrfv2SubscriptionManager.s_randomWords(0)
      )
    })

    it('Should emit { LotteryEnd } event', async () => {
      const { lotto, upkeepManager } = await loadFixture(findWinningNumber)
      await upkeepManager.checkUpkeep()
      await expect(upkeepManager.performUpkeep())
        .to.emit(lotto, 'LotteryEnd')
        .withArgs(
          lotto.address,
          anyValue,
          anyValue,
          anyValue,
          anyValue,
          anyValue
        )
    })

    it('Should be able to find winners', async () => {
      const { lotto } = await loadFixture(findWinners)
      expect(await lotto.getHasLotteryEnded()).to.be.true
    })

    it('Should not be able to find winners more than once', async () => {
      const { upkeepManager } = await loadFixture(findWinners)
      await upkeepManager.checkUpkeep()
      expect(await upkeepManager.getIsUpkeepNeeded()).to.be.false
    })

    it('Bet pots should add up to correct amount', async () => {
      const { lotto } = await loadFixture(findWinners)
      const winnersBets = await lotto.getWinnersBets()
      const losersBets = await lotto.getLosersBets()
      const ownersFee = await lotto.getOwnersFee()
      const balance = await ethers.provider.getBalance(lotto.address)
      expect(winnersBets.add(losersBets).add(ownersFee).toString()).to.eq(
        balance.toString()
      )
    })

    it('From every consecutive 4 tickets only one should be a winning ticket', async () => {
      const { lotto } = await loadFixture(findWinners)
      /**
       * If the ticket count hasn't surpassed one full circle (256 tickets) and
       * the total amount of tickets isn't dividable with 4. It means that it
       * will have a division remainder from 1 - 3 it could be that all 3 of
       * those could be losers because the 4th one would be the winning ticket.
       * As all the bought tickets belong one of those stacks it is enough to
       * test the bet stacks to see if the algorithm works. Because while finding
       * the winners the losers stacks will be equalized with zero.
       */
      const betStackLength =
        totalTickets > 256 ? 256 : totalTickets - (totalTickets % 4)
      /* eslint-disable no-await-in-loop */
      for (let index = 0; index < betStackLength; index += 4) {
        const betStack1 = await lotto.getBetStack(index)
        const betStack2 = await lotto.getBetStack(index + 1)
        const betStack3 = await lotto.getBetStack(index + 2)
        const betStack4 = await lotto.getBetStack(index + 3)
        const betStackSum =
          (betStack1 > 0) * 1 +
          (betStack2 > 0) * 1 +
          (betStack3 > 0) * 1 +
          (betStack4 > 0) * 1
        expect(betStackSum).to.eq(1)
      }
      /* eslint-enable no-await-in-loop */
    })
  })

  describe('clean()', () => {
    it('Should not be able to call if not the owner', async () => {
      const [, address2] = await ethers.getSigners()
      const { lotto } = await loadFixture(findWinners)
      await time.increase(secondsInThirtyDays)
      await expect(
        lotto.connect(address2).clean()
      ).to.be.revertedWithCustomError(lotto, 'Lotto__NotContractOwner')
    })

    it('Should not be able to call if not open for cleaning', async () => {
      const { lotto } = await loadFixture(findWinners)
      await time.increase(secondsInThirtyDays / 1000)
      await expect(lotto.clean()).to.be.revertedWithCustomError(
        lotto,
        'Lotto__NotOpenForCleaning'
      )
    })

    it('Should be able to call if the time has passed', async () => {
      const [address1] = await ethers.getSigners()
      const { lotto } = await loadFixture(findWinners)
      const playerBalanceBeforeCleaning = await ethers.provider.getBalance(
        address1.address
      )
      const lottoBalance = await ethers.provider.getBalance(lotto.address)
      await time.increase(secondsInThirtyDays)
      const tx = await lotto.clean()
      const receipt = await tx.wait(1)
      const txGasCost = receipt.gasUsed.mul(receipt.effectiveGasPrice)
      const playerBalanceAfterCleaning = await ethers.provider.getBalance(
        address1.address
      )
      expect(
        playerBalanceBeforeCleaning.add(lottoBalance).sub(txGasCost).toString()
      ).to.eq(playerBalanceAfterCleaning.toString())
    })

    it('Should emit { Clean } event', async () => {
      const { lotto } = await loadFixture(findWinners)
      const lottoBalance = await ethers.provider.getBalance(lotto.address)
      await time.increase(secondsInThirtyDays)
      await expect(lotto.clean())
        .to.emit(lotto, 'Clean')
        .withArgs(lotto.address, lottoBalance)
    })
  })

  describe('checkTicket()', () => {
    it('Should be able to check your ticket', async () => {
      const { lotto } = await loadFixture(findWinners)
      expect((await lotto.getTicket(0)).isChecked).to.be.false
      await lotto.checkTicket(0)
      expect((await lotto.getTicket(0)).isChecked).to.be.true
    })

    it('Should emit { TicketCheck } event', async () => {
      const [address1] = await ethers.getSigners()
      const { lotto } = await loadFixture(findWinners)
      await expect(lotto.checkTicket(0))
        .to.emit(lotto, 'TicketCheck')
        .withArgs(address1.address, 0, anyValue, anyValue)
    })

    it('Should not be able to check your ticket that is already checked', async () => {
      const { lotto } = await loadFixture(findWinners)
      await lotto.checkTicket(0)
      expect((await lotto.getTicket(0)).isChecked).to.be.true
      await expect(lotto.checkTicket(0)).to.be.revertedWithCustomError(
        lotto,
        'Lotto__TicketChecked'
      )
    })

    it(`Should not be able to check a ticket that doesn't belong to you`, async () => {
      const { lotto } = await loadFixture(findWinners)
      await expect(
        lotto.checkTicket(totalTickets / 10)
      ).to.be.revertedWithCustomError(lotto, 'Lotto__NotTicketOwner')
    })
  })

  describe('claimTicket()', () => {
    const getWinningTicketIndex = (lotto, index) => {
      return (async () => {
        const betStack1 = await lotto.getBetStack(index)
        const betStack2 = await lotto.getBetStack(index + 1)
        const betStack3 = await lotto.getBetStack(index + 2)
        const betStack4 = await lotto.getBetStack(index + 3)
        return (
          (betStack1 > 0) * (index + 0) +
          (betStack2 > 0) * (index + 1) +
          (betStack3 > 0) * (index + 2) +
          (betStack4 > 0) * (index + 3)
        )
      })()
    }

    it('Should be able to claim a winning ticket', async () => {
      const { lotto } = await loadFixture(findWinners)
      const [address1] = await ethers.getSigners()
      const winningTicketIndex = await getWinningTicketIndex(lotto, 0)
      await lotto.checkTicket(winningTicketIndex)
      const playerBalanceBeforeClaiming = await ethers.provider.getBalance(
        address1.address
      )
      const ticket = await lotto.getTicket(winningTicketIndex)
      const ticketBet = ticket.bet
      const winnersBets = await lotto.getWinnersBets()
      const losersBets = await lotto.getLosersBets()
      const ticketValue = ticketBet.sub(ticketBet.mul(3).div(100))
      const winningAmount = ticketValue.add(
        ticketValue.mul(losersBets).div(winnersBets)
      )
      const tx = await lotto.claimTicket(winningTicketIndex)
      const receipt = await tx.wait(1)
      const txGasCost = receipt.gasUsed.mul(receipt.effectiveGasPrice)
      const playerBalanceAfterClaiming = await ethers.provider.getBalance(
        address1.address
      )
      expect(
        playerBalanceBeforeClaiming.add(winningAmount).sub(txGasCost).toString()
      ).to.eq(playerBalanceAfterClaiming.toString())
    })

    it('Should emit { TicketClaim } event', async () => {
      const { lotto } = await loadFixture(findWinners)
      const [address1] = await ethers.getSigners()
      const winningTicketIndex = await getWinningTicketIndex(lotto, 0)
      await lotto.checkTicket(winningTicketIndex)
      await expect(lotto.claimTicket(winningTicketIndex))
        .to.emit(lotto, 'TicketClaim')
        .withArgs(address1.address, winningTicketIndex, anyValue, anyValue)
    })

    it('Should not be able to claim a claimed ticket', async () => {
      const { lotto } = await loadFixture(findWinners)
      const winningTicketIndex = await getWinningTicketIndex(lotto, 0)
      await lotto.checkTicket(winningTicketIndex)
      expect((await lotto.getTicket(winningTicketIndex)).isClaimed).to.be.false
      await lotto.claimTicket(winningTicketIndex)
      expect((await lotto.getTicket(winningTicketIndex)).isClaimed).to.be.true
      await expect(
        lotto.claimTicket(winningTicketIndex)
      ).to.be.revertedWithCustomError(lotto, 'Lotto__TicketClaimed')
    })

    it('Should not be able to claim a not checked ticket', async () => {
      const { lotto } = await loadFixture(findWinners)
      const winningTicketIndex = await getWinningTicketIndex(lotto, 0)
      await expect(
        lotto.claimTicket(winningTicketIndex)
      ).to.be.revertedWithCustomError(lotto, 'Lotto__TicketNotChecked')
    })

    it('Should not be able to claim a losing ticket', async () => {
      const { lotto } = await loadFixture(findWinners)
      const winningTicketIndex = await getWinningTicketIndex(lotto, 0)
      const notWinningTicketIndex =
        (winningTicketIndex === 0) * 1 +
        (winningTicketIndex === 1) * 2 +
        (winningTicketIndex === 2) * 3 +
        (winningTicketIndex === 3) * 0
      await lotto.checkTicket(notWinningTicketIndex)
      const ticket = await lotto.getTicket(notWinningTicketIndex)
      expect(ticket.isChecked).to.be.true
      expect(ticket.isWinner).to.be.false
      await expect(
        lotto.claimTicket(notWinningTicketIndex)
      ).to.be.revertedWithCustomError(lotto, 'Lotto__TicketNotWinner')
    })
  })

  describe('getTicket()', () => {
    it('Should be able retrieve ticket', async () => {
      const { lotto } = await loadFixture(findWinners)
      const [address1] = await ethers.getSigners()
      const ticket = await lotto.getTicket(0)
      expect(ticket.owner).to.eq(address1.address)
    })

    it('Should not be able to retrieve a ticket not belonging to the owner', async () => {
      const [address1, address2] = await ethers.getSigners()
      const { lotto } = await loadFixture(findWinners)
      expect((await lotto.getTicket(0)).owner).to.eq(address1.address)
      await expect(
        lotto.connect(address2).getTicket(0)
      ).to.be.revertedWithCustomError(lotto, 'Lotto__NotTicketOwner')
    })
  })

  describe('getOwnedTicketNumbers()', () => {
    it('Should return only owned ticket numbers', async () => {
      const { lotto } = await loadFixture(findWinners)
      const ticketNumbersShouldBe = [
        ...new Array((totalTickets - 10) / 10),
      ].map((_, index) => index)
      const ticketNumbersActual = (await lotto.getOwnedTicketNumbers()).map(
        (ticketNumber) => ticketNumber.toNumber()
      )
      expect(ticketNumbersShouldBe.length).to.eq(ticketNumbersActual.length)
      for (let index = 0; index < ticketNumbersShouldBe.length; index += 1) {
        expect(ticketNumbersShouldBe[index]).to.eq(ticketNumbersActual[index])
      }
    })
  })
})
