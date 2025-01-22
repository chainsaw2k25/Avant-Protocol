const { ethers } = require('ethers'); 
const axios = require('axios'); 
const dotenv = require('dotenv'); 
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
  }
];

const mintContractAddress = process.env.MINT_CONTRACT_ADDRESS;
const depositContractAddress = process.env.DEPOSIT_CONTRACT_ADDRESS;

const AVALANCHE_WS_URL = process.env.AVALANCHE_WS_URL;
const provider = new ethers.WebSocketProvider(AVALANCHE_WS_URL);

const discordWebhookUrl = process.env.DISCORD_WEBHOOK_URL; // Access the variable from the .env file

const mintContract = new ethers.Contract(mintContractAddress, mintContractABI, provider);
const depositContract = new ethers.Contract(depositContractAddress, depositContractABI, provider);

async function sendToWebhook(message) {
  try {
    await axios.post(discordWebhookUrl, { content: message });
    console.log('Event details sent to Discord successfully!');
  } catch (error) {
    console.error('Error sending message to Discord:', error);
  }
}


sendToWebhook("**🚨Avant Event Bot is active**");

mintContract.on('Mint', async (minter, benefactor, beneficiary, collateralAsset, collateralAmount, avusdAmount) => {
  console.log('Mint Event Detected:');
  console.log('Raw Parameters:', { minter, benefactor, beneficiary, collateralAsset, collateralAmount, avusdAmount });

  try {
    
const formattedCollateralAmount = (Number(collateralAmount) / 10 ** 6).toFixed(2); 
const formattedAvusdAmount = (Number(avusdAmount) / 10 ** 18).toFixed(2); 

const truncatedBeneficiary = `${owner.slice(0, 5)}#####`; 
    
    const mintMessage = `
    **🚨New Mint Alert!**
    **Minter**: ${truncatedBeneficiary}
    **Collateral Asset**: ${formattedCollateralAmount} USDC
    **AvUSD Minted**: ${formattedAvusdAmount} AVUSD
    `.trim();

      
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
   
  const formattedAssets = (Number(assets) / 10 ** 18).toFixed(2); 
  const formattedShares =  (Number(shares) / 10 ** 18).toFixed(2); 

 const truncatedOwner = `${owner.slice(0, 5)}#####`; 

     const depositMessage = `
     **🚨New Stake Alert!🚨**
     **Staker**: ${truncatedOwner}
     **Assets Deposited**: ${formattedAssets} avUSD
     **savUSD Minted**: ${formattedShares} savUSD
     `.trim();

     
     console.log('Sending message to Discord:', depositMessage);

       await sendToWebhook(depositMessage);
      } catch (error) {
        console.error('Error handling Deposit event:', error);
      }
    });

setInterval(() => {
  provider.getBlockNumber()
  .then((blockNumber) => {
    console.log(`WebSocket connection is active. Current block: ${blockNumber}`);
  })
  .catch((error) => {
    console.error('WebSocket connection error:', error);
  });
}, 300000);

