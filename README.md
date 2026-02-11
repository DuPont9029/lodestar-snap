# Lodestar Snap

A MetaMask Snap implementation of the [Lodestar](https://lodestar.chainsafe.io/) Ethereum light client.

## Overview

This project aims to integrate a fully functional Ethereum light client directly within the MetaMask environment. By running a light client in the browser, users can verify blockchain data trustlessly, reducing reliance on centralized RPC providers (such as Infura or Alchemy) for consensus verification.

The Snap downloads and verifies block headers directly from the Ethereum consensus network, ensuring data integrity through cryptographic proofs.

## Why Use a Light Client?

A Light Client allows you to interact with the Ethereum blockchain without downloading the entire history (TB of data) while maintaining a high level of security and trustlessness.

### Key Capabilities

1.  **Verify Blockchain State Trustlessly**
    - **Header Verification**: Downloads and cryptographically verifies block headers (the "skeleton" of the blockchain).
    - **Sync Committees**: Uses the Beacon Chain sync committees to verify block finality.
    - **No Blind Trust**: Requests data plus a Merkle Proof to verify it locally, rather than blindly trusting an RPC provider.

2.  **Secure Balance Checks**
    - Queries address balances and verifies the response against the state root in the verified block header.
    - Prevents malicious providers from displaying fake balances.

3.  **Verify Contract Storage (State Access)**
    - Reads smart contract storage (e.g., NFT ownership, Uniswap pool prices).
    - Verifies data integrity at a specific block height using Merkle Proofs.

4.  **Verify Event Logs**
    - Verifies transaction receipts and events (e.g., "Did my transaction succeed?").
    - Uses the receipt root in the block header for proof.

5.  **Run on Low-Resource Devices**
    - **Browser Compatible**: Runs inside a web browser (like this Snap!) due to minimal bandwidth and storage requirements.
    - **Fast Sync**: Syncs to the chain tip in seconds.

### Limitations (vs Full Node)

- **No Historical Data**: Does not store history, so it cannot serve old blocks to peers.
- **No Full Execution**: Does not re-execute every transaction to validate state transitions (relies on validator consensus).
- **Limited Mempool**: Typically does not fully participate in P2P transaction gossip.

## Functionality

The Snap exposes a primary RPC method, `initialize`, which performs the following operations:

1.  **Dynamic Loading**: Dynamically imports the Lodestar core modules, including WASM-based BLS and SSZ libraries.
2.  **Network Connection**: Establishes a connection to the Ethereum Mainnet consensus layer (currently bootstrapping via Chainsafe nodes).
3.  **Light Client Sync**: Performs a rapid synchronization starting from a trusted weak subjectivity checkpoint.
4.  **Finality Tracking**: Maintains synchronization by listening for and verifying new finalized block headers.

## Prerequisites

- **Node.js**: Version 18 or higher is required.
- **MetaMask Flask**: The developer-focused distribution of MetaMask, required for installing and testing Snaps that are not yet published to the official directory.

## Installation and Usage

### 1. Clone and Install

Clone the repository and install the project dependencies:

```bash
git clone <repository-url>
cd lodestar-snap
npm install
```

### 2. Start Development Server

To build the Snap in watch mode and start a local server:

```bash
npm start
```

This command will:

- Compile the TypeScript source code.
- Serve the Snap bundle at `http://localhost:8080`.

You can then connect to the local Snap using a test dApp or the [MetaMask Snap Companion](https://snaps.metamask.io/test-snap/).

### 3. Production Build

To generate a static production build:

```bash
npm run build
```

The optimized bundle will be output to the `dist/` directory.

## Technical Architecture

Running a complex consensus client like Lodestar within the restricted MetaMask Snap environment (Secure ECMAScript) requires specific architectural adaptations:

- **Polyfills**: Extensive polyfilling of Node.js core modules (e.g., `Buffer`, `process`, `stream`) is implemented to support Lodestar's dependencies in the browser.
- **Global Injection**: Certain global variables expected by dependencies are injected at runtime to ensure compatibility.
- **WebAssembly**: The Snap leverages WASM for performance-critical cryptographic operations.

## Disclaimer

**Experimental Software**: This is a Proof of Concept (PoC) implementation. While functional, it is intended for research and development purposes and should be used with caution in production environments.
