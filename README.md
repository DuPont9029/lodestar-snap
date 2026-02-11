# Lodestar Snap

A MetaMask Snap implementation of the [Lodestar](https://lodestar.chainsafe.io/) Ethereum light client.

## Overview

This project aims to integrate a fully functional Ethereum light client directly within the MetaMask environment. By running a light client in the browser, users can verify blockchain data trustlessly, reducing reliance on centralized RPC providers (such as Infura or Alchemy) for consensus verification.

The Snap downloads and verifies block headers directly from the Ethereum consensus network, ensuring data integrity through cryptographic proofs.

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
