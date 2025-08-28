const { ethers } = require('ethers'); 
const axios = require('axios'); 
const dotenv = require('dotenv'); 
const express = require('express');

dotenv.config(); 

const mintContractABI = [
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "minter",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "benefactor",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "beneficiary",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "address",
        "name": "collateral_asset",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "collateral_amount",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "avantcoin_amount",
        "type": "uint256"
      }
    ],
    "name": "Mint",
    "type": "event"
  }
];


const avbtcMintABI = [
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "address", "name": "minter", "type": "address" },
      { "indexed": true, "internalType": "address", "name": "benefactor", "type": "address" },
      { "indexed": true, "internalType": "address", "name": "beneficiary", "type": "address" },
      { "indexed": false, "internalType": "address", "name": "collateral_asset", "type": "address" },
      { "indexed": false, "internalType": "uint256", "name": "collateral_amount", "type": "uint256" },
      { "indexed": false, "internalType": "uint256", "name": "avantcoin_amount", "type": "uint256" }
    ],
    "name": "Mint",
    "type": "event"
  }
];


const savbtcDepositABI = [
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "address", "name": "sender", "type": "address" },
      { "indexed": true, "internalType": "address", "name": "owner", "type": "address" },
      { "indexed": false, "internalType": "uint256", "name": "assets", "type": "uint256" },
      { "indexed": false, "internalType": "uint256", "name": "shares", "type": "uint256" }
    ],
    "name": "Deposit",
    "type": "event"
  }
];

const totalSupplyABI = [
  {
    "inputs": [],
    "name": "totalSupply",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
];


const depositContractABI = [

  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "sender",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "owner",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "assets",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "shares",
        "type": "uint256"
      }
    ],
    "name": "Deposit",
    "type": "event"
  },
  {
    "inputs": [],
    "name": "totalSupply",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
];

const supplyAbi = [
  {
    "inputs": [],
    "name": "totalSupply",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  }
];

const mintContractAddress = process.env.MINT_CONTRACT_ADDRESS;
const depositContractAddress = process.env.DEPOSIT_CONTRACT_ADDRESS;
const SupplyContractAddress = process.env.SUPPLY_CONTRACT_ADDRESS;
const avbtcMintAddress = process.env.AVBTC_MINT_CONTRACT;
const savbtcDepositAddress = process.env.SAVBTC_DEPOSIT_CONTRACT;
const avbtcSupply = process.env.AVBTC_SUPPLY_CONTRACT;


const AVALANCHE_WS_URL = process.env.AVALANCHE_WS_URL;
let provider = new ethers.WebSocketProvider(AVALANCHE_WS_URL);

const discordWebhookUrl = process.env.DISCORD_WEBHOOK_URL; 

const mintContract = new ethers.Contract(mintContractAddress, mintContractABI, provider);
const depositContract = new ethers.Contract(depositContractAddress, depositContractABI, provider);
const SupplyContract = new ethers.Contract(SupplyContractAddress, totalSupplyABI, provider);  
const avbtcMintContract = new ethers.Contract(avbtcMintAddress, avbtcMintABI, provider);
const savbtcDepositContract = new ethers.Contract(savbtcDepositAddress, savbtcDepositABI, provider);
const avbtcSupplyContract = new ethers.Contract(avbtcSupply, supplyAbi, provider);


const app = express();
const port = process.env.PORT || 10000; 


async function sendToWebhook(message) {
  try {
    await axios.post(discordWebhookUrl, message);
    console.log('Event details sent to Discord successfully!');
  } catch (error) {
    if (error.response) {
      console.error('Error sending message to Discord:', error.response.data); 
    } else {
      console.error('Error sending message to Discord:', error);
    }
  }
}

function formatNumber(value, decimals = 2) {
  return Number(value).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

const eventQueue = [];
let processingQueue = false;

async function processEventQueue() {
  if (processingQueue || eventQueue.length === 0) return;
  processingQueue = true;

  while (eventQueue.length > 0) {
    const { eventType, args } = eventQueue.shift();
    try {
      if (eventType === 'Mint') {
        const { minter, benefactor, beneficiary, collateralAsset, collateralAmount, avantcoinAmount } = args;
        const formattedAvantcoinAmount = formatNumber(Number(avantcoinAmount) / 10 ** 18);

        const currentTotalSupply = await SupplyContract.totalSupply();
        const formattedTotalSupply = formatNumber(Number(currentTotalSupply) / 10 ** 18);

        const truncatedBeneficiary = `${beneficiary.slice(0, 6)}...${beneficiary.slice(-4)}`;

        const mintMessage = {
          embeds: [
            {
              description: `
**🔔 New MINT Order 📈** 

Amount: ${formattedAvantcoinAmount} avUSD
Placed by: ${truncatedBeneficiary}
New supply: ${formattedTotalSupply} avUSD 
`,
color: 3066993 
}
]
};
        console.log('Sending message to Discord:', JSON.stringify(mintMessage, null, 2));
        await sendToWebhook(mintMessage);
      } 
      
      else if (eventType === 'Deposit') {
        const { sender, owner, assets, shares } = args;
        const formattedAssets = formatNumber(Number(assets) / 10 ** 18);

        const stakedTotalSupply = await depositContract.totalSupply();
        const totalMintSupply = await SupplyContract.totalSupply();

        const normalizedStakedTotalSupply = Number(stakedTotalSupply) / 10 ** 18;
        const normalizedTotalMintSupply = Number(totalMintSupply) / 10 ** 18;

        const percentage = ((normalizedStakedTotalSupply / normalizedTotalMintSupply) * 100).toFixed(2);
        const formattedstakedTotalSupply = formatNumber(normalizedStakedTotalSupply);

        const truncatedOwner = `${owner.slice(0, 6)}...${owner.slice(-4)}`;

        const depositMessage = {
          embeds: [
            {
              description: `
**📥 New STAKE Event! 📈**

Amount: ${formattedAssets} avUSD
Placed by: ${truncatedOwner}
Staked: ${formattedstakedTotalSupply} avUSD (${percentage}%)
`,
color: 3447003 
            }
          ]
        };
        console.log('Sending message to Discord:', JSON.stringify(depositMessage, null, 2));
        await sendToWebhook(depositMessage);
      }


else if (eventType === 'MintBTC') {
        const { minter, benefactor, beneficiary, collateralAsset, collateralAmount, avantcoinAmount } = args;
        const formattedAvbtcAmount = formatNumber(Number(avantcoinAmount) / 10 ** 15, 8);

        const currentTotalSupply = await avbtcSupplyContract.totalSupply();
        const formattedTotalSupply = formatNumber(Number(currentTotalSupply) / 10 ** 15, 8);

        const truncatedBeneficiary = `${beneficiary.slice(0, 6)}...${beneficiary.slice(-4)}`;

        const mintBTCMessage = {
          embeds: [
            {
              description: `
**🔔 New MINT Order 📈**

Amount: ${formattedAvbtcAmount} avBTC  
Placed by: ${truncatedBeneficiary}  
New supply: ${formattedTotalSupply} avBTC
        `,
        color: 15158332
      }
    ]
  };
  await sendToWebhook(mintBTCMessage);

      } else if (eventType === 'DepositBTC') {
        // savBTC Deposit
        const { sender, owner, assets, shares } = args;
       
        const formattedAssets = formatNumber(Number(assets) / 10 ** 18, 8);

  const stakedTotalSupply = await savbtcDepositContract.totalSupply(); 
  const totalMintSupply = await avbtcSupplyContract.totalSupply(); 

  const normalizedStaked = Number(stakedTotalSupply) / 10 ** 18;
  const normalizedTotal = Number(totalMintSupply) / 10 ** 15;

  const percentage = ((normalizedStaked / normalizedTotal) * 100).toFixed(2);
  const formattedStaked = formatNumber(normalizedStaked, 8);

  const truncatedOwner = `${owner.slice(0, 6)}...${owner.slice(-4)}`;

  const depositBTCMessage = {
    embeds: [
      {
        description: `
**📥 New STAKE Event! 📈**

Amount: ${formattedAssets} avBTC  
Placed by: ${truncatedOwner}  
Staked: ${formattedStaked} avBTC (${percentage}%)
        `,
        color: 9807270
      }
    ]
  };
  await sendToWebhook(depositBTCMessage);
}
    } catch (error) {
      console.error('Error processing event:', error);
    }
  }
  processingQueue = false;
}

mintContract.on('Mint', (minter, benefactor, beneficiary, collateralAsset, collateralAmount, avantcoinAmount) => {
  console.log('Mint Event Detected:');
  console.log('Raw Parameters:', { minter, benefactor, beneficiary, collateralAsset, collateralAmount, avantcoinAmount });
  eventQueue.push({ eventType: 'Mint', args: { minter, benefactor, beneficiary, collateralAsset, collateralAmount, avantcoinAmount } });
  processEventQueue();
});

depositContract.on('Deposit', (sender, owner, assets, shares) => {
  console.log('Deposit Event Detected:');
  console.log('Raw Parameters:', { sender, owner, assets, shares });
  eventQueue.push({ eventType: 'Deposit', args: { sender, owner, assets, shares } });
  processEventQueue();
});

avbtcMintContract.on('Mint', (minter, benefactor, beneficiary, collateralAsset, collateralAmount, avantcoinAmount) => {
  console.log('avBTC Mint Event:', { minter, benefactor, beneficiary, collateralAsset, collateralAmount, avantcoinAmount });
  eventQueue.push({ eventType: 'MintBTC', args: { minter, benefactor, beneficiary, collateralAsset, collateralAmount, avantcoinAmount } });
  processEventQueue();
});

savbtcDepositContract.on('Deposit', (sender, owner, assets, shares) => {
  console.log('savBTC Deposit Event:', { sender, owner, assets, shares });
  eventQueue.push({ eventType: 'DepositBTC', args: { sender, owner, assets, shares } });
  processEventQueue();
});


app.get('/', (req, res) => {
  res.send('Web3 event bot is running');
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Server running on port ${port}`);
});

function monitorWebSocket() {
  provider.on('error', (error) => {
    console.error('WebSocket connection closed. Attempting to reconnect...', error);
    reconnectWebSocket();
  });

  provider.on('network', (network, oldNetwork) => {
    if (oldNetwork) {
      console.error('Network changed:', network, oldNetwork);
      reconnectWebSocket();
    }
  });
}

function reconnectWebSocket() {
  setTimeout(() => {
    console.log('Reconnecting WebSocket...');
    provider = new ethers.WebSocketProvider(AVALANCHE_WS_URL);

    mintContract.connect(provider);
    depositContract.connect(provider);
    SupplyContract.connect(provider);
    avbtcMintContract.connect(provider);
    savbtcDepositContract.connect(provider);
    avbtcSupplyContract.connect(provider);

    monitorWebSocket();
  }, 1000); 
}

setInterval(() => {
  provider.getBlockNumber()
    .then((blockNumber) => {
      console.log(`WebSocket connection is active. Current block: ${blockNumber}`);
    })
    .catch((error) => {
      console.error('WebSocket connection error:', error);
    });
}, 300000);
