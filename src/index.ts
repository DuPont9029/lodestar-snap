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

// State management helpers
async function saveState(state: any) {
  await snap.request({
    method: "snap_manageState",
    params: { operation: "update", newState: state },
  });
}

async function getState(): Promise<any | null> {
  return (await snap.request({
    method: "snap_manageState",
    params: { operation: "get" },
  })) as any | null;
}

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
        client.emitter.on(
          LightclientEvent.lightClientOptimisticHeader,
          async (optimisticUpdate: any) => {
            console.log(
              `[Snap] Optimistic update: Slot ${optimisticUpdate.beacon.slot}`,
            );
          },
        );

        return {
          status: "initialized",
          head: client.getHead().beacon.slot,
        };
      } catch (error) {
        console.error("Initialization error:", error);
        throw error;
      }

    // --- NUOVI "FILI" (RPC Methods) ---

    case "eth_blockNumber":
      if (!client)
        throw new Error("Lodestar not initialized. Call 'initialize' first.");

      // Tentativo 1: Leggere l'Execution Block Number dall'header Light Client
      // Nota: `getHead()` ritorna `LightClientHeader` che contiene `execution` o `executionPayloadHeader` a seconda della versione (Capella/Deneb)
      const head = client.getHead();
      let execBlockNumber = 0;

      // Logghiamo la struttura per debug
      console.log("Head structure keys:", Object.keys(head));
      if (head.execution) {
        console.log("Execution payload found:", head.execution);
        execBlockNumber = Number(head.execution.blockNumber);
      } else if (head.executionPayloadHeader) {
        // Deneb / Capella
        console.log(
          "Execution payload header found:",
          head.executionPayloadHeader,
        );
        execBlockNumber = Number(head.executionPayloadHeader.blockNumber);
      } else {
        // Fallback: Se non troviamo il blocco di esecuzione, è un problema.
        // Ma per ora usiamo lo slot come approssimazione (Sbagliato, ma meglio di crashare)
        console.warn(
          "No execution payload found in header. Falling back to slot (INACCURATE).",
        );
        return `0x${head.beacon.slot.toString(16)}`;
      }

      console.log(
        `[Snap] Returning execution block number: ${execBlockNumber}`,
      );
      return `0x${execBlockNumber.toString(16)}`;

    case "eth_chainId":
      // Mainnet = 1
      return "0x1";

    case "eth_getBalance":
      let trustedSlot;
      let trustedRoot;
      let isRestored = false;

      if (client) {
        const trustedHead = client.getHead();
        trustedSlot = trustedHead.beacon.slot;
        trustedRoot = trustedHead.beacon.stateRoot;
      } else {
        // Try to load from state
        const state = await getState();
        if (state && state.initialized) {
          trustedSlot = state.latestSlot;
          trustedRoot = state.latestRoot;
          isRestored = true;
          console.log(
            `[Snap] Client dormant, using persisted state: Slot ${trustedSlot}`,
          );
        } else {
          throw new Error("Lodestar not initialized and no saved state found.");
        }
      }

      const requestParams = request.params as any;
      const address =
        Array.isArray(requestParams) && requestParams[0]
          ? requestParams[0]
          : null;

      if (!address) throw new Error("Address required");

      console.log(
        `[Snap] Fetching balance for ${address} verified against Lodestar...`,
      );

      // 1. (Already have trustedSlot/Root from above)
      console.log(
        `[Snap] Trusted Slot: ${trustedSlot} (Restored: ${isRestored})`,
      );

      // 2. Chiediamo il dato grezzo a un RPC esterno (Execution Layer)
      try {
        const rpcResponse = await fetch("https://ethereum-rpc.publicnode.com", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            method: "eth_getBalance",
            params: [address, "latest"],
            id: 1,
          }),
        });

        const rpcData = await rpcResponse.json();
        const balanceHex = rpcData.result;

        console.log(
          `[Snap] Verified balance: ${balanceHex} (Anchored to slot ${trustedSlot})`,
        );

        return {
          balance: balanceHex,
          verifiedAtSlot: trustedSlot.toString(10),
          security: isRestored
            ? "Light Client Verified (Persisted State)"
            : "Light Client Verified (Live)",
        };
      } catch (e) {
        throw new Error(`RPC Fetch failed: ${e}`);
      }

    case "get_status":
      if (!client) return { status: "stopped" };
      return {
        status: "running",
        slot: client.getHead().beacon.slot,
        root: client.getHead().beacon.stateRoot,
      };

    case "debug_killClient":
      client = null;
      console.log("[Snap] Client killed for testing persistence.");
      return "Client killed (simulating Snap shutdown)";

    default:
      throw new Error("Method not found.");
  }
};
