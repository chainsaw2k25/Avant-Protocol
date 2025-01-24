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
        "name": "avusd_amount",
        "type": "uint256"
      }
    ],
    "name": "Mint",
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

const mintContractAddress = process.env.MINT_CONTRACT_ADDRESS;
const depositContractAddress = process.env.DEPOSIT_CONTRACT_ADDRESS;
const SupplyContractAddress = process.env.SUPPLY_CONTRACT_ADDRESS;

const AVALANCHE_WS_URL = process.env.AVALANCHE_WS_URL;
const provider = new ethers.WebSocketProvider(AVALANCHE_WS_URL);

const discordWebhookUrl = process.env.DISCORD_WEBHOOK_URL; 

const mintContract = new ethers.Contract(mintContractAddress, mintContractABI, provider);
const depositContract = new ethers.Contract(depositContractAddress, depositContractABI, provider);
const SupplyContract = new ethers.Contract(SupplyContractAddress, totalSupplyABI, provider);  

const app = express();
const port = process.env.PORT || 10000; 


async function sendToWebhook(message) {
  try {
    await axios.post(discordWebhookUrl, { content: message });
    console.log('Event details sent to Discord successfully!');
  } catch (error) {
    console.error('Error sending message to Discord:', error);
  }
}


function formatNumber(value, decimals = 2) {
  return Number(value).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

mintContract.on('Mint', async (minter, benefactor, beneficiary, collateralAsset, collateralAmount, avusdAmount) => {
  console.log('Mint Event Detected:');
  console.log('Raw Parameters:', { minter, benefactor, beneficiary, collateralAsset, collateralAmount, avusdAmount });
  
  
  try {
      const formattedAvusdAmount = formatNumber(Number(avusdAmount) / 10 ** 18); 

const currentTotalSupply = await SupplyContract.totalSupply();
console.log('Raw currentTotalSupply:', currentTotalSupply.toString()); 

const formattedTotalSupply = formatNumber(Number(currentTotalSupply) / 10 ** 18); 

const truncatedBeneficiary = `${beneficiary.slice(0, 6)}...${beneficiary.slice(-4)}`;

const mintMessage = `
> **🔔 New MINT Order 📈** 
> 
> • Amount: ${formattedAvusdAmount} avUSD
> • Placed by: ${truncatedBeneficiary}
> • New supply: ${formattedTotalSupply} avUSD 
> \u200B
`;


console.log('Sending message to Discord:', mintMessage);
await sendToWebhook(mintMessage);
} catch (error) {
  console.error('Error handling Mint event:', error);
}
});

depositContract.on('Deposit', async (sender, owner, assets, shares) => {
  console.log('Deposit Event Detected:');
  console.log('Raw Parameters:', { sender, owner, assets, shares });

  try {
  
  const formattedAssets = formatNumber(Number(assets) / 10 ** 18); 

const stakedTotalSupply = await depositContract.totalSupply();
console.log('Raw currentTotalSupply:', stakedTotalSupply.toString()); 

const totalMintSupply = await SupplyContract.totalSupply();
console.log('Raw currentTotalSupply:', totalMintSupply.toString()); 

const normalizedStakedTotalSupply = Number(stakedTotalSupply) / 10 ** 18;
const normalizedTotalMintSupply = Number(totalMintSupply) / 10 ** 18;

  const percentage = ((normalizedStakedTotalSupply / normalizedTotalMintSupply) * 100).toFixed(2);

  const formattedstakedTotalSupply = formatNumber(normalizedStakedTotalSupply);

  const truncatedOwner = `${owner.slice(0, 6)}...${owner.slice(-4)}`;

const depositMessage = `
> **📥 New STAKE Event! 📈**
> 
> • Amount: ${formattedAssets} avUSD
> • Placed by: ${truncatedOwner}
> • Staked: ${formattedstakedTotalSupply} avUSD (${percentage}%)
> \u200B
`;

     
     console.log('Sending message to Discord:', depositMessage);

       await sendToWebhook(depositMessage);
      } catch (error) {
        console.error('Error handling Deposit event:', error);
      }
    });

app.get('/', (req, res) => {
res.send('Web3 event bot is running');
    }); 

app.listen(port, '0.0.0.0', () => {
  console.log(`Server running on port ${port}`);
});


setInterval(() => {
  provider.getBlockNumber()
  .then((blockNumber) => {
    console.log(`WebSocket connection is active. Current block: ${blockNumber}`);
  })
  .catch((error) => {
    console.error('WebSocket connection error:', error);
  });
}, 1800000); 

