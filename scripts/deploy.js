// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// You can also run a script with `npx hardhat run <script>`. If you do that, Hardhat
// will compile your contracts, add the Hardhat Runtime Environment's members to the
// global scope, and execute the script.
const hre = require('hardhat')

const localChainId = '31337'
const minBet = 0.1
const maxBet = 10
let lotto = null

const deploy = async (contractName, args = []) => {
  const Contract = await hre.ethers.getContractFactory(contractName)
  const contract = await Contract.deploy(...args)
  return await contract.deployed()
}

const getRndInteger = (min, max) => {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

const automatedTicketBuyer = async () => {
  const signers = await hre.ethers.getSigners()
  const signer = signers[getRndInteger(1, 19)]
  await lotto.connect(signer).buyTicket({
    value: ethers.utils.parseUnits(
      (getRndInteger(1, 100) / 10).toString(),
      'ether'
    ),
  })
  setTimeout(automatedTicketBuyer, getRndInteger(3000, 6000))
}

const onLotteryStart = (
  lottery,
  startTime,
  totalTickets,
  minBet,
  maxBet,
  duration
) => {
  console.log(
    'LOTTERY START',
    lottery,
    startTime.toString(),
    totalTickets.toString(),
    ethers.utils.formatEther(minBet).toString(),
    ethers.utils.formatEther(maxBet).toString(),
    duration.toString()
  )
}

const onTicketBuy = (ticketNumber, owner, bet) => {
  console.log(
    'TICKET BUY',
    ticketNumber.toString(),
    owner,
    ethers.utils.formatEther(bet).toString()
  )
}

async function main() {
  // const vrfCoordinatorV2MockBaseFee = '100000000000000000'
  // const vrfCoordinatorV2MockGasPriceLink = '1000000000'
  const keyHash =
    '0x0000000000000000000000000000000000000000000000000000000000000000'
  const vrfV2SubscriptionManagerLinkBalance = '5000000000000000000'
  const totalTickets = 10000
  const minBet = 0.1
  const maxBet = 10
  const duration = 604800

  const linkToken = await deploy('LinkToken')
  const vrfCoordinatorV2Mock = await deploy('VRFCoordinatorV2Mock', [
    hre.ethers.utils.parseEther('0.1'),
    '1000000000',
  ])
  const upkeepManager = await deploy('UpkeepManager', ['0x'])

  lotto = await deploy('Lotto', [
    linkToken.address,
    vrfCoordinatorV2Mock.address,
    upkeepManager.address,
    keyHash,
    totalTickets,
    hre.ethers.utils.parseUnits(minBet.toString(), 'ether'),
    hre.ethers.utils.parseUnits(maxBet.toString(), 'ether'),
    duration,
  ])

  const vrfV2SubscriptionManager = await hre.ethers.getContractAt(
    'VRFv2SubscriptionManager',
    await lotto.getVRFv2SubscriptionManager()
  )

  await linkToken.transfer(
    vrfV2SubscriptionManager.address,
    vrfV2SubscriptionManagerLinkBalance
  )

  lotto.on('LotteryStart', onLotteryStart)
  lotto.on('TicketBuy', onTicketBuy)

  await lotto.startLottery()
  automatedTicketBuyer()
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
