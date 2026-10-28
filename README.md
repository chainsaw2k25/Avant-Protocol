# Avant Protocol Monitoring Bot

A Node.js-based monitoring bot built to track selected protocol events across Avalanche and Ethereum and deliver notifications to Discord.

The project combines blockchain event monitoring, WebSocket connections, event handling, and Discord webhook integration to make selected protocol activity easier to monitor.

## Features

- **Multi-chain monitoring:** Supports selected monitoring tasks across Avalanche and Ethereum.
- **Event tracking:** Monitors configured protocol events, such as token minting, supply changes, and deposits, where implemented.
- **Discord notifications:** Sends relevant event updates to a configured Discord webhook.
- **WebSocket connectivity:** Uses blockchain WebSocket connections for event monitoring.
- **Connection recovery:** Includes reconnection and heartbeat handling to improve monitoring reliability.
- **Event processing:** Uses an event queue to help process incoming notifications.

**Note:** The exact events and features available depend on the current implementation and configuration.*

## Tech Stack

- JavaScript
- Node.js
- ethers.js
- Avalanche C-Chain
- Ethereum
- Discord Webhooks
- WebSocket connections

## How It Works

1. Connects to configured blockchain networks.
2. Subscribes to selected smart contract events.
3. Processes relevant event data.
4. Sends formatted notifications to Discord.
5. Attempts to recover connectivity when supported connections are interrupted.

## Requirements

* Node.js and npm
* RPC/WebSocket endpoints for the networks you want to monitor
* A Discord webhook URL
* Contract addresses and event configurations required by the implementation

## Setup

1. Clone the repository:

   ```bash
   git clone https://github.com/chainsaw2k25/Avant-Protocol.git
   cd Avant-Protocol
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Configure your environment variables using a local `.env` file.

   Add the variables required by the application, using the names expected by the source code. Never commit real credentials or webhook URLs.

4. Start the application using the command configured for the project.

   Check `package.json` for the available scripts and the correct start command.

## Configuration

The bot requires network endpoints, Discord notification configuration, and any contract addresses or settings used by its monitoring modules.

Keep sensitive values in environment variables. Do not publish private RPC credentials, API keys, Discord webhook URLs, or other secrets.

## Reliability

The project includes connection management and event-processing logic intended to improve monitoring reliability. Actual uptime and recovery behavior depend on network availability, endpoint limits, and runtime configuration.

## Security

- Keep `.env` files out of version control.
- Use `.gitignore` to exclude secrets and local configuration.
- Rotate any credentials that may have been exposed.
- Review logs before sharing them publicly to ensure they do not contain sensitive information.

## Author

Built as a technical project supporting blockchain protocol monitoring and Discord-based notifications.

GitHub: https://github.com/chainsaw2k25

---

**This repository is provided for demonstration and educational purposes. Review the code and configuration before deploying it in a production environment.**
