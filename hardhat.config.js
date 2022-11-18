require('@nomicfoundation/hardhat-toolbox')
require('hardhat-abi-exporter')

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  defaultNetwork: 'localhost',
  networks: {
    localhost: {
      url: 'http://localhost:8545',
    },
  },
  solidity: {
    compilers: [
      {
        version: '0.8.7',
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    ],
  },
  gasReporter: {
    currency: 'USD',
    coinmarketcap: process.env.COINMARKETCAP || null,
    enabled: true,
  },
  abiExporter: {
    path: '../frontend/abi',
    runOnCompile: true,
    clear: true,
    flat: true,
    only: [],
    spacing: 2,
    pretty: false,
  },
}
