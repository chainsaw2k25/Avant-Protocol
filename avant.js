const { ethers } = require('ethers'); 
const axios = require('axios'); 
const dotenv = require('dotenv'); 
const express = require('express');

dotenv.config(); 

// --- ABIs ---

const mintContractABI = [
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
  // Deposit event (for listening)
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
  },
  // Minimal ERC20 surface we need from the share token
  {
    "inputs": [],
    "name": "totalSupply",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "decimals",
    "outputs": [{ "internalType": "uint8", "name": "", "type": "uint8" }],
    "stateMutability": "view",
    "type": "function"
  }
];

// Generic minimal ERC20 (totalSupply + decimals)
const erc20ABI = [
  { "inputs": [], "name": "totalSupply", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "decimals",    "outputs": [{ "internalType": "uint8",   "name": "", "type": "uint8"    }], "stateMutability": "view", "type": "function" },
];

// For deposit contracts you also query for totalSupply/decimals (share token) + the Deposit event
const depositContractABI = [
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
  },
  { "inputs": [], "name": "totalSupply", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "decimals",    "outputs": [{ "internalType": "uint8",   "name": "", "type": "uint8"    }], "stateMutability": "view", "type": "function" },
];

const requestManagerABI = [
  {
    anonymous: false,
    inputs: [
      { indexed: true,  internalType: "uint256", name: "id",            type: "uint256" },
      { indexed: true,  internalType: "address", name: "provider",      type: "address" },
      { indexed: false, internalType: "address", name: "depositToken",  type: "address" },
      { indexed: false, internalType: "uint256", name: "amount",        type: "uint256" },
      { indexed: false, internalType: "uint256", name: "minMintAmount", type: "uint256" },
    ],
    name: "MintRequestCreated",
    type: "event",
  },
];

const avbtcxRequestManagerABI = requestManagerABI; // identical event

// --- Addresses from env ---

const mintContractAddress            = process.env.MINT_CONTRACT_ADDRESS;
const depositContractAddress         = process.env.DEPOSIT_CONTRACT_ADDRESS;      // savUSD / avUSDx deposit
const SupplyContractAddress          = process.env.SUPPLY_CONTRACT_ADDRESS;       // avUSD token
const avbtcMintAddress               = process.env.AVBTC_MINT_CONTRACT;           // avBTC minter
const savbtcDepositAddress           = process.env.SAVBTC_DEPOSIT_CONTRACT;       // savBTC (ERC4626 shares)
const avbtcSupply                    = process.env.AVBTC_SUPPLY_CONTRACT;         // avBTC token
const avusdxRequestManagerAddress    = process.env.AVUSDX_REQUEST_MANAGER;        // avUSDx request manager
const avusdxAddress                  = process.env.AVUSDX_CONTRACT;               // avUSDx token
const avbtcxRequestManagerAddress    = process.env.AVBTCX_REQUEST_MANAGER;        // avBTCx request manager
const avbtcxAddress                  = process.env.AVBTCX_CONTRACT;               // avBTCx token

const AVALANCHE_WS_URL = process.env.AVALANCHE_WS_URL;
const discordWebhookUrl = process.env.DISCORD_WEBHOOK_URL; 

// --- Provider & Contracts (reassigned on reconnect) ---

let provider = new ethers.WebSocketProvider(AVALANCHE_WS_URL);

let mintContract;
let depositContract;
let SupplyContract;
let avbtcMintContract;
let savbtcDepositContract;
let avbtcSupplyContract;
let avusdxRequestManager;
let avusdxContract;
let avbtcxRequestManager;
let avbtcxContract;

// Create all contracts (and allow re-creation on reconnect)
function createContracts() {
  mintContract            = new ethers.Contract(mintContractAddress,         mintContractABI,            provider);
  depositContract         = new ethers.Contract(depositContractAddress,      depositContractABI,         provider);
  SupplyContract          = new ethers.Contract(SupplyContractAddress,       erc20ABI,                   provider); // avUSD ERC20
  avbtcMintContract       = new ethers.Contract(avbtcMintAddress,            avbtcMintABI,               provider);
  savbtcDepositContract   = new ethers.Contract(savbtcDepositAddress,        savbtcDepositABI,           provider);
  avbtcSupplyContract     = new ethers.Contract(avbtcSupply,                 erc20ABI,                   provider); // avBTC ERC20
  avusdxRequestManager    = new ethers.Contract(avusdxRequestManagerAddress, requestManagerABI,          provider);
  avusdxContract          = new ethers.Contract(avusdxAddress,               erc20ABI,                   provider); // avUSDx ERC20
  avbtcxRequestManager    = new ethers.Contract(avbtcxRequestManagerAddress, avbtcxRequestManagerABI,    provider);
  avbtcxContract          = new ethers.Contract(avbtcxAddress,               erc20ABI,                   provider); // avBTCx ERC20
}

createContracts();

// --- Express ---

const app = express();
const port = process.env.PORT || 10000; 

// --- Helpers ---

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

async function getDecimals(contract, fallback = 18) {
  try {
    const d = await contract.decimals();
    return Number(d);
  } catch {
    return fallback;
  }
}

// --- Queue System --- //
const eventQueue = [];

// Process 1 event per second
setInterval(async () => {
  if (eventQueue.length === 0) return;

  const { eventType, args } = eventQueue.shift();
  try {
      if (eventType === 'Mint') {
        const { minter, benefactor, beneficiary, collateralAsset, collateralAmount, avantcoinAmount } = args;

        const decimals = await getDecimals(SupplyContract, 18); // avUSD token decimals
        const formattedAvantcoinAmount = formatNumber(parseFloat(ethers.formatUnits(avantcoinAmount, decimals)));

        const currentTotalSupply = await SupplyContract.totalSupply();
        const formattedTotalSupply = formatNumber(parseFloat(ethers.formatUnits(currentTotalSupply, decimals)));

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
        await sendToWebhook(mintMessage);
      }

      else if (eventType === 'Deposit') {
        const { sender, owner, assets, shares } = args;

        // depositContract represents the share token (ERC4626) — use its decimals
        const shareDecimals = await getDecimals(depositContract, 18);
        const formattedAssets = formatNumber(parseFloat(ethers.formatUnits(assets, shareDecimals)));

        const stakedTotalSupply = await depositContract.totalSupply();
        const totalMintSupply   = await SupplyContract.totalSupply();

        const normalizedStaked = parseFloat(ethers.formatUnits(stakedTotalSupply, shareDecimals));
        const baseDecimals = await getDecimals(SupplyContract, 18);
        const normalizedTotal  = parseFloat(ethers.formatUnits(totalMintSupply, baseDecimals));

        const percentage = normalizedTotal > 0 ? ((normalizedStaked / normalizedTotal) * 100).toFixed(2) : "0.00";
        const formattedStaked = formatNumber(normalizedStaked);

        const truncatedOwner = `${owner.slice(0, 6)}...${owner.slice(-4)}`;

        const depositMessage = {
          embeds: [
            {
              description: `
**📥 New STAKE Event! 📈**

Amount: ${formattedAssets} avUSD
Placed by: ${truncatedOwner}
Staked: ${formattedStaked} avUSD (${percentage}%)
`,
              color: 3447003
            }
          ]
        };
        await sendToWebhook(depositMessage);
      }

      else if (eventType === 'MintBTC') {
        const { minter, benefactor, beneficiary, collateralAsset, collateralAmount, avantcoinAmount } = args;

        // avBTC ERC20
        const avbtcDecimals = await getDecimals(avbtcSupplyContract, 18);
        const formattedAvbtcAmount = formatNumber(parseFloat(ethers.formatUnits(avantcoinAmount, avbtcDecimals)), 4);

        const currentTotalSupply = await avbtcSupplyContract.totalSupply();
        const formattedTotalSupply = formatNumber(parseFloat(ethers.formatUnits(currentTotalSupply, avbtcDecimals)), 2);

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
              color: 3066993
            }
          ]
        };
        await sendToWebhook(mintBTCMessage);
      }

      else if (eventType === 'DepositBTC') {
        const { sender, owner, assets, shares } = args;

        // savBTC (shares) decimals
        const savbtcShareDecimals = await getDecimals(savbtcDepositContract, 18);
        const formattedAssets = formatNumber(parseFloat(ethers.formatUnits(assets, savbtcShareDecimals)), 4);

        const stakedTotalSupply = await savbtcDepositContract.totalSupply(); // xBTC shares supply
        const totalMintSupply   = await avbtcSupplyContract.totalSupply();   // avBTC token total supply

        const normalizedStaked = parseFloat(ethers.formatUnits(stakedTotalSupply, savbtcShareDecimals));
        const avbtcDecimals = await getDecimals(avbtcSupplyContract, 18);
        const normalizedTotal = parseFloat(ethers.formatUnits(totalMintSupply, avbtcDecimals));

        const percentage = normalizedTotal > 0 ? ((normalizedStaked / normalizedTotal) * 100).toFixed(2) : "0.00";
        const formattedStaked = formatNumber(normalizedStaked, 2);

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
              color: 3447003
            }
          ]
        };
        await sendToWebhook(depositBTCMessage);
      }

      else if (eventType === 'Boost') {
        const { provider: boostProvider, amount } = args;

        // avUSDx ERC20
        const decimals = await getDecimals(avusdxContract, 18);
        const formattedAmount = formatNumber(parseFloat(ethers.formatUnits(amount, decimals)));

        const truncatedProvider = `${boostProvider.slice(0, 6)}...${boostProvider.slice(-4)}`;

        const totalSupply = await avusdxContract.totalSupply();
        const formattedTotalSupply = formatNumber(parseFloat(ethers.formatUnits(totalSupply, decimals)));

        const boostMessage = {
          embeds: [
            {
              description: `
**🔔 New Boost Order 📈**

Amount: ${formattedAmount} avUSD
Placed by: ${truncatedProvider}
New supply: ${formattedTotalSupply} avUSDx
`,
              color: 0xFF69B4
            }
          ]
        };

        await sendToWebhook(boostMessage);
      }

      else if (eventType === 'avbtcxBoost') {
        const { provider: boostProvider, amount } = args;

        // avBTCx ERC20
        const decimals = await getDecimals(avbtcxContract, 18);
        const formattedAmount = formatNumber(parseFloat(ethers.formatUnits(amount, decimals)), 4);

        const truncatedProvider = `${boostProvider.slice(0, 6)}...${boostProvider.slice(-4)}`;

        const totalSupply = await avbtcxContract.totalSupply();
        const formattedTotalSupply = formatNumber(parseFloat(ethers.formatUnits(totalSupply, decimals)), 2);

        const boostMessage = {
          embeds: [
            {
              description: `
**🔔 New Boost Order 📈**

Amount: ${formattedAmount} avBTC  
Placed by: ${truncatedProvider}  
New supply: ${formattedTotalSupply} avBTCx
`,
              color: 0xFF69B4
            }
          ]
        };

        await sendToWebhook(boostMessage);
      }

    } catch (error) {
      console.error('Error processing event:', error);
     }
}, 1000); // <-- send max 1 per second

// --- Listeners ---

function setupListeners() {
  // Remove old listeners to avoid duplicates after reconnect
  mintContract.removeAllListeners();
  depositContract.removeAllListeners();
  avbtcMintContract.removeAllListeners();
  savbtcDepositContract.removeAllListeners();
  avusdxRequestManager.removeAllListeners();
  avbtcxRequestManager.removeAllListeners();

  mintContract.on('Mint', (minter, benefactor, beneficiary, collateralAsset, collateralAmount, avantcoinAmount) => {
    console.log('Mint Event Detected:', { minter, benefactor, beneficiary, collateralAsset, collateralAmount, avantcoinAmount });
    eventQueue.push({ eventType: 'Mint', args: { minter, benefactor, beneficiary, collateralAsset, collateralAmount, avantcoinAmount } });
    });

  depositContract.on('Deposit', (sender, owner, assets, shares) => {
    console.log('Deposit Event Detected:', { sender, owner, assets, shares });
    eventQueue.push({ eventType: 'Deposit', args: { sender, owner, assets, shares } });
  });

  avbtcMintContract.on('Mint', (minter, benefactor, beneficiary, collateralAsset, collateralAmount, avantcoinAmount) => {
    console.log('avBTC Mint Event:', { minter, benefactor, beneficiary, collateralAsset, collateralAmount, avantcoinAmount });
    eventQueue.push({ eventType: 'MintBTC', args: { minter, benefactor, beneficiary, collateralAsset, collateralAmount, avantcoinAmount } });
  });

  savbtcDepositContract.on('Deposit', (sender, owner, assets, shares) => {
    console.log('savBTC Deposit Event:', { sender, owner, assets, shares });
    eventQueue.push({ eventType: 'DepositBTC', args: { sender, owner, assets, shares } });
  });

  avusdxRequestManager.on('MintRequestCreated', (id, providerAddr, depositToken, amount, minMintAmount) => {
    console.log('avUSDx MintRequestCreated Event Detected:', { id, provider: providerAddr, depositToken, amount, minMintAmount });
    eventQueue.push({ eventType: 'Boost', args: { provider: providerAddr, amount }  }); 
  });

  avbtcxRequestManager.on('MintRequestCreated', (id, providerAddr, depositToken, amount, minMintAmount) => {
    console.log('avBTCx MintRequestCreated Event Detected:', { id, provider: providerAddr, depositToken, amount, minMintAmount });
    eventQueue.push({ eventType: 'avbtcxBoost', args: { provider: providerAddr, amount } });
  });
}

setupListeners();

// --- Server ---

app.get('/', (req, res) => {
  res.send('Web3 event bot is running');
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Server running on port ${port}`);
});

// --- WS Monitoring & Reconnect (ethers v6 safe) ---

function monitorWebSocket() {
  provider.on("network", (newNetwork, oldNetwork) => {
    if (oldNetwork) {
      console.log(`🌐 Network changed from ${oldNetwork.name} to ${newNetwork.name}`);
      reconnectWebSocket();
    }
  });
}

function reconnectWebSocket() {
  setTimeout(() => {
    console.log("🔄 Reconnecting WebSocket...");

    // Recreate provider
    provider = new ethers.WebSocketProvider(AVALANCHE_WS_URL);

    // Recreate contracts and listeners bound to the new provider
    createContracts();
    setupListeners();
    monitorWebSocket();
  }, 1000);
}

monitorWebSocket();

// Periodic health check (main way to detect drops in v6)
setInterval(() => {
  provider.getBlockNumber()
    .then((blockNumber) => {
      console.log(`✅ WebSocket alive. Current block: ${blockNumber}`);
    })
    .catch((error) => {
      console.error("⚠️ WebSocket check failed:", error);
      reconnectWebSocket();
    });
}, 300000); // every 5 mins
