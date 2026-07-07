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

const avbtcMintABI = mintContractABI;
const avethMintABI = mintContractABI;

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

const depositContractABI = savbtcDepositABI;
const savethDepositABI = savbtcDepositABI;

const requestManagerABI = [
  {
    anonymous: false,
    inputs: [
      { indexed: true,  internalType: "uint256", name: "id",            type: "uint256" },
      { indexed: true,  internalType: "address", name: "provider",      type: "address" },
      { indexed: false, internalType: "address", name: "depositToken",  type: "address" },
      { indexed: false, internalType: "uint256", name: "amount",        type: "uint256" },,
    ],
    name: "MintRequestCreated",
    type: "event",
  },
];
const avethRequestManagerABI = [
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

const avbtcxRequestManagerABI = avethRequestManagerABI; // identical event

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

// Ethereum addresses for avETH, savETH, avETHx from env
const avethMintAddress               = process.env.AVETH_MINT_CONTRACT;
const savethDepositAddress           = process.env.SAVETH_DEPOSIT_CONTRACT; 
const avethSupply                    = process.env.AVETH_TOKEN_CONTRACT;
const avethxRequestManagerAddress    = process.env.AVETHX_REQUEST_MANAGER;
const avethxAddress                  = process.env.AVETHX_CONTRACT;


const AVALANCHE_WS_URL = process.env.AVALANCHE_WS_URL;
const ETH_WS_URL = process.env.ETH_WS_URL;
const discordWebhookUrl = process.env.DISCORD_WEBHOOK_URL; 

// --- Provider & Contracts (reassigned on reconnect) ---

let provider = new ethers.WebSocketProvider(AVALANCHE_WS_URL);
let ethProvider = new ethers.WebSocketProvider(ETH_WS_URL);

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

// Ethereum contracts
let avethMintContract;
let savethDepositContract;
let avethSupplyContract;
let avethxRequestManager;
let avethxContract;

// Create all contracts (and allow re-creation on reconnect)
function createAvaxContracts() {
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
function createEthContracts() {
  avethMintContract       = new ethers.Contract(avethMintAddress,            avethMintABI,            ethProvider);
  savethDepositContract   = new ethers.Contract(savethDepositAddress,        savethDepositABI,        ethProvider);
  avethSupplyContract     = new ethers.Contract(avethSupply,                 erc20ABI,                ethProvider);
  avethxRequestManager    = new ethers.Contract(avethxRequestManagerAddress, avethRequestManagerABI,  ethProvider);
  avethxContract          = new ethers.Contract(avethxAddress,               erc20ABI,                ethProvider);
}


createAvaxContracts();
createEthContracts();

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

// Process 1 event per 2 second
setInterval(async () => {
  if (eventQueue.length === 0) return;

  const { eventType, args } = eventQueue.shift();

  console.log(`Queue pop -> eventType: ${eventType}, queue remaining: ${eventQueue.length}`);

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

      else if (eventType === 'MintETH') {
      const { minter, benefactor, beneficiary, collateralAsset, collateralAmount, avantcoinAmount } = args;

      const avethdecimals = await getDecimals(avethSupplyContract, 18);
      const formattedAvethAmount = formatNumber(parseFloat(ethers.formatUnits(avantcoinAmount, avethdecimals)));
      
      const currentTotalSupply = await avethSupplyContract.totalSupply();
      const formattedTotalSupply = formatNumber(parseFloat(ethers.formatUnits(currentTotalSupply, avethdecimals)));
      
      const truncatedBeneficiary = `${beneficiary.slice(0, 6)}...${beneficiary.slice(-4)}`;
      
      const mintETHMessage = {
        embeds: [
          { 
            description: `
  **🔔 New MINT Order 📈**
  
    Amount: ${formattedAvethAmount} avETH
    Placed by: ${truncatedBeneficiary}
    New supply: ${formattedTotalSupply} avETH
            `, 
    
          color: 3066993 
        }
      ]
    };
      await sendToWebhook(mintETHMessage);
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

    else if (eventType === 'DepositETH') {
      const { sender, owner, assets, shares } = args;

      const savethShareDecimals = await getDecimals(savethDepositContract, 18);
      const formattedAssets = formatNumber(parseFloat(ethers.formatUnits(assets, savethShareDecimals)), 4);

      const stakedTotalSupply = await savethDepositContract.totalSupply();
      const totalMintSupply = await avethSupplyContract.totalSupply();

      const normalizedStaked = parseFloat(ethers.formatUnits(stakedTotalSupply, savethShareDecimals));
      const avethDecimals = await getDecimals(avethSupplyContract, 18);
      const normalizedTotal = parseFloat(ethers.formatUnits(totalMintSupply, avethDecimals));
      
      const percentage = normalizedTotal > 0 ? ((normalizedStaked / normalizedTotal) * 100).toFixed(2) : "0.00";
      const formattedStaked = formatNumber(normalizedStaked, 2);

      const truncatedOwner = `${owner.slice(0, 6)}...${owner.slice(-4)}`;
      
      const depositETHMessage = {
        embeds: [
          { 
            description: `
            
    **📥 New STAKE Event! 📈**
    
        Amount: ${formattedAssets} avETH
        Placed by: ${truncatedOwner}
        Staked: ${formattedStaked} avETH (${percentage}%)
        `, 
        
        color: 3447003 
      }
    ]
  };
      await sendToWebhook(depositETHMessage);
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

        const boostBTCXMessage = {
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

        await sendToWebhook(boostBTCXMessage);
      }

else if (eventType === 'avethxBoost') {
      const { provider: boostProvider, amount } = args;

      const decimals = await getDecimals(avethxContract, 18);
      const formattedAmount = formatNumber(parseFloat(ethers.formatUnits(amount, decimals)), 4);
     
      const truncatedProvider = `${boostProvider.slice(0, 6)}...${boostProvider.slice(-4)}`;

      const totalSupply = await avethxContract.totalSupply();
      const formattedTotalSupply = formatNumber(parseFloat(ethers.formatUnits(totalSupply, decimals)), 2);
     
      const boostETHMessage = {
        embeds: [
          { 
            description: `
  **🔔 New Boost Order 📈**
  
  Amount: ${formattedAmount} avETH
  Placed by: ${truncatedProvider}
  New supply: ${formattedTotalSupply} avETHx
    `, 
    color: 0xFF69B4 
      }
    ]
   };
    
      await sendToWebhook(boostETHMessage);
    }


    } catch (error) {
      console.error('Error processing event:', error);
     }
}, 2000); // <-- send max 1 per 2 second

// --- Listeners ---

function setupAvaxListeners() {
  mintContract.removeAllListeners();
  depositContract.removeAllListeners();
  avbtcMintContract.removeAllListeners();
  savbtcDepositContract.removeAllListeners();
  avusdxRequestManager.removeAllListeners();
  avbtcxRequestManager.removeAllListeners();


 // Avalanche listeners
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

  avusdxRequestManager.on('MintRequestCreated', (id, providerAddr, depositToken, amount) => {
    console.log('avUSDx MintRequestCreated Event Detected:', { id, provider: providerAddr, depositToken, amount });
    eventQueue.push({ eventType: 'Boost', args: { provider: providerAddr, amount }  }); 
  });

  avbtcxRequestManager.on('MintRequestCreated', (id, providerAddr, depositToken, amount, minMintAmount) => {
    console.log('avBTCx MintRequestCreated Event Detected:', { id, provider: providerAddr, depositToken, amount, minMintAmount });
    eventQueue.push({ eventType: 'avbtcxBoost', args: { provider: providerAddr, amount } });
  });
}

function setupEthListeners() {
  avethMintContract.removeAllListeners();
  savethDepositContract.removeAllListeners();
  avethxRequestManager.removeAllListeners();

// Ethereum listeners
  avethMintContract.on('Mint', (minter, benefactor, beneficiary, collateralAsset, collateralAmount, avantcoinAmount) => {
    console.log('avETH Mint Event:', { minter, benefactor, beneficiary, collateralAsset, collateralAmount, avantcoinAmount });
    eventQueue.push({ eventType: 'MintETH', args: { minter, benefactor, beneficiary, collateralAsset, collateralAmount, avantcoinAmount } });
  });

  savethDepositContract.on('Deposit', (sender, owner, assets, shares) => {
    console.log('savETH Deposit Event:', { sender, owner, assets, shares });
    eventQueue.push({ eventType: 'DepositETH', args: { sender, owner, assets, shares } });
  });

  avethxRequestManager.on('MintRequestCreated', (id, providerAddr, depositToken, amount, minMintAmount) => {
    console.log('avETHx MintRequestCreated Event Detected:', { id, provider: providerAddr, depositToken, amount, minMintAmount });
    eventQueue.push({ eventType: 'avethxBoost', args: { provider: providerAddr, amount } });
  });
}

setupAvaxListeners();
setupEthListeners();

// --- Server ---

app.get('/', (req, res) => {
  res.send('Web3 event bot is running');
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Server running on port ${port}`);
});


// --- WS Monitoring & Reconnect (for Avalanche & Ethereum) ---

function monitorProvider(wsProvider, name, onReconnect) {
  // ethers v6 WebSocketProvider doesn't use 'connect'/'close' events consistently,
  // so rely on 'network' changes and inspect the internal websocket for close/error.
  wsProvider.on("network", (newNetwork, oldNetwork) => {
    if (oldNetwork) {
      console.log(`[${name}] Network changed from ${oldNetwork.name} to ${newNetwork.name}`);
      onReconnect();
    }
  });

  // optionally: if provider's underlying websocket exists, listen for errors/closes
  wsProvider._websocket?.on?.('error', (err) => {
    console.error(`[${name}] WebSocket error:`, err);
    onReconnect();
  });

  wsProvider._websocket?.on?.('close', (code) => {
    console.error(`[${name}] WebSocket closed. Code:`, code);
    onReconnect();
  });
}

function reconnectAvalanche() {
  setTimeout(() => {
    console.log("[avalanche] Reconnecting...");
    try { provider.destroy?.(); } catch (_) {}
    provider = new ethers.WebSocketProvider(AVALANCHE_WS_URL);
    createAvaxContracts();
    setupAvaxListeners();
    monitorProvider(provider, 'avalanche', reconnectAvalanche);
  }, 1000);
}

function reconnectEthereum() {
  setTimeout(() => {
    console.log("[ethereum] Reconnecting...");
    try { ethProvider.destroy?.(); } catch (_) {}
    ethProvider = new ethers.WebSocketProvider(ETH_WS_URL);
    createEthContracts();
    setupEthListeners();
    monitorProvider(ethProvider, 'ethereum', reconnectEthereum);
  }, 1000);
}

// start monitors
monitorProvider(provider, 'avalanche', reconnectAvalanche);
monitorProvider(ethProvider, 'ethereum', reconnectEthereum);

// Periodic health checks
setInterval(() => {
  provider.getBlockNumber()
    .then((bn) => console.log(`avalanche WebSocket alive. Block: ${bn}`))
    .catch((err) => { console.error('avalanche WS check failed:', err); reconnectAvalanche(); });

  ethProvider.getBlockNumber()
    .then((bn) => console.log(`ethereum WebSocket alive. Block: ${bn}`))
    .catch((err) => { console.error('ethereum WS check failed:', err); reconnectEthereum(); });

}, 300000); // every 5 mins