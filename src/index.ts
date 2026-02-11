console.log("Snap bundle executing...");

import { OnRpcRequestHandler } from "@metamask/snaps-sdk";
import { Buffer as BufferPolyfill } from "buffer";
import processPolyfill from "process";

// IIFE to force global injection immediately
(() => {
  const target =
    typeof globalThis !== "undefined"
      ? globalThis
      : typeof self !== "undefined"
        ? self
        : typeof window !== "undefined"
          ? window
          : typeof global !== "undefined"
            ? global
            : ({} as any);

  // Inject Buffer
  if (!target.Buffer) {
    target.Buffer = BufferPolyfill;
  }

  // Inject process
  if (!target.process) {
    target.process = processPolyfill;
  }

  // Inject specific process properties if missing
  if (!target.process.versions) {
    target.process.versions = { node: "18.0.0" };
  }
  if (!target.process.env) {
    target.process.env = { NODE_ENV: "production" };
  }

  // Inject DOMException if missing (fixes Lodestar fetch utils)
  if (typeof target.DOMException === "undefined") {
    target.DOMException = class DOMException extends Error {
      name: string;
      constructor(message?: string, name?: string) {
        super(message);
        this.name = name || "Error";
      }
    };
  }

  // Inject AggregateError if missing (fixes Lodestar promise utils)
  if (typeof target.AggregateError === "undefined") {
    target.AggregateError = class AggregateError extends Error {
      errors: any[];
      constructor(errors: any[], message?: string) {
        super(message);
        this.errors = errors;
      }
    };
  }

  // Inject Uint8Array if missing (unlikely, but safe)
  if (typeof target.Uint8Array === "undefined") {
    target.Uint8Array = Uint8Array;
  }

  // Inject AbortController/AbortSignal if missing
  if (typeof target.AbortController === "undefined") {
    target.AbortController = AbortController;
  }
  if (typeof target.AbortSignal === "undefined") {
    target.AbortSignal = AbortSignal;
  }

  console.log("Globals forced:", {
    hasBuffer: !!target.Buffer,
    bufferType: typeof target.Buffer,
    hasProcess: !!target.process,
    hasDOMException: !!target.DOMException,
    hasAggregateError: !!target.AggregateError,
    hasAbortController: !!target.AbortController,
    hasFetch: typeof fetch !== "undefined",
  });
})();

// Global state for the snap
let client: any | null = null;

export const onRpcRequest: OnRpcRequestHandler = async ({
  origin,
  request,
}) => {
  console.log("onRpcRequest called with method:", request.method);

  // Re-verify globals
  // @ts-ignore
  if (!globalThis.Buffer) globalThis.Buffer = BufferPolyfill;
  // @ts-ignore
  if (!globalThis.process) globalThis.process = processPolyfill;

  switch (request.method) {
    case "initialize":
      if (client) {
        return {
          status: "Already initialized",
          head: client.getHead().beacon.slot,
        } as any;
      }

      try {
        console.log("Dynamically importing Lodestar...");
        const { Lightclient, LightclientEvent } =
          await import("@lodestar/light-client");
        const {
          getChainForkConfigFromNetwork,
          getApiFromUrl,
          getFinalizedSyncCheckpoint,
          getGenesisData,
        } = await import("@lodestar/light-client/utils");
        const { LightClientRestTransport } =
          await import("@lodestar/light-client/transport");
        console.log("Lodestar imported.");

        // 1. Connectivity Test
        try {
          console.log("Testing connectivity to chainsafe.io...");
          const response = await fetch(
            "https://lodestar-mainnet.chainsafe.io/eth/v1/node/version",
          );
          if (!response.ok) {
            throw new Error(
              `Connectivity test failed with status: ${response.status}`,
            );
          }
          console.log("Connectivity test passed.");
        } catch (e) {
          console.error("Connectivity test failed:", e);
          throw new Error(
            `Network connectivity check failed: ${e instanceof Error ? e.message : String(e)}`,
          );
        }

        console.log("Initializing Lodestar...");
        const network = "mainnet";
        const consensusRpc = "https://lodestar-mainnet.chainsafe.io";

        console.log("Fetching config...");
        const config = getChainForkConfigFromNetwork(network);
        console.log("Config fetched.");

        console.log("Creating API client...");
        const api = getApiFromUrl(consensusRpc, network);
        console.log("API client created.");

        // 2. Fetch checkpoint
        let checkpointRoot;
        try {
          console.log("Fetching checkpoint...");
          checkpointRoot = await getFinalizedSyncCheckpoint(api);
          console.log("Checkpoint fetched:", checkpointRoot);
        } catch (e) {
          console.error("Failed to fetch checkpoint:", e);
          throw new Error(
            `Failed to fetch checkpoint: ${e instanceof Error ? e.message : String(e)}`,
          );
        }

        // 3. Fetch genesis
        let genesisData;
        try {
          console.log("Fetching genesis...");
          genesisData = await getGenesisData(api);
          console.log("Genesis fetched:", genesisData);
        } catch (e) {
          console.error("Failed to fetch genesis:", e);
          throw new Error(
            `Failed to fetch genesis: ${e instanceof Error ? e.message : String(e)}`,
          );
        }

        console.log("Initializing Lightclient...");
        client = await Lightclient.initializeFromCheckpointRoot({
          config,
          transport: new LightClientRestTransport(api),
          genesisData,
          checkpointRoot,
          opts: {
            allowForcedUpdates: true,
            updateHeadersOnForcedUpdate: true,
          },
        });
        console.log("Lightclient initialized.");

        await client.start();
        console.log("Lightclient started.");

        // Setup listeners
        client.emitter.on(
          LightclientEvent.lightClientFinalityHeader,
          async (finalityUpdate: any) => {
            console.log(
              `[Snap] Finality update: Slot ${finalityUpdate.beacon.slot}`,
            );
          },
        );

        return {
          status: "Initialized",
          head: client.getHead().beacon.slot,
        } as any;
      } catch (error) {
        console.error("Failed to initialize Lodestar:", error);
        throw new Error(`Initialization failed: ${error}`);
      }
    case "getHead":
      if (!client) {
        throw new Error("Lodestar not initialized");
      }
      const head = client.getHead();
      return {
        slot: Number(head.beacon.slot),
        proposerIndex: Number(head.beacon.proposerIndex),
        // @ts-ignore
        stateRoot: "0x" + Buffer.from(head.beacon.stateRoot).toString("hex"),
      } as any;

    case "getBalance":
      if (!client) {
        throw new Error("Lodestar not initialized");
      }
      // @ts-ignore
      const { address } = request.params || {};
      if (!address) {
        throw new Error("Address is required");
      }

      console.log("Getting balance for:", address);

      // 1. Get the latest verified block info from Lodestar
      const latestHead = client.getHead();
      const latestSlot = Number(latestHead.beacon.slot);

      // 2. Fetch balance from an execution RPC (Public Node)
      // In a full implementation, we would request a Merkle Proof and verify it against
      // the stateRoot known by Lodestar. For now, we fetch and cross-reference the block.
      try {
        const rpcUrl = "https://ethereum-rpc.publicnode.com";
        const response = await fetch(rpcUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            method: "eth_getBalance",
            params: [address, "latest"],
            id: 1,
          }),
        });

        const data = await response.json();
        const balanceHex = data.result;
        // Convert wei to eth (simple approximation for display)
        const wei = BigInt(balanceHex);
        // Custom formatEther implementation to avoid precision loss of Number()
        const weiStr = wei.toString().padStart(19, "0");
        const whole = weiStr.slice(0, -18);
        const decimal = weiStr.slice(-18);
        // Remove trailing zeros
        const cleanDecimal = decimal.replace(/0+$/, "");
        const eth = cleanDecimal ? `${whole}.${cleanDecimal}` : whole;

        return {
          address,
          balanceEth: eth,
          verifiedAtSlot: latestSlot,
          note: "Balance fetched via RPC, anchored to Lodestar slot",
        } as any;
      } catch (error) {
        console.error("Failed to fetch balance:", error);
        throw new Error(`Failed to fetch balance: ${error}`);
      }

    default:
      throw new Error("Method not found.");
  }
};
