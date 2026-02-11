import { Buffer as BufferPolyfill } from "buffer";
import processPolyfill from "process";

// Safe global resolution
const globalObject =
  typeof globalThis !== "undefined"
    ? globalThis
    : typeof self !== "undefined"
      ? self
      : typeof window !== "undefined"
        ? window
        : typeof global !== "undefined"
          ? global
          : Function("return this")();

// @ts-ignore
if (!globalObject.Buffer) {
  // @ts-ignore
  globalObject.Buffer = BufferPolyfill;
}

// @ts-ignore
if (!globalObject.process) {
  // @ts-ignore
  globalObject.process = processPolyfill;
}

const proc = globalObject.process;

// Ensure versions exists
// @ts-ignore
if (!proc.versions) {
  // @ts-ignore
  proc.versions = { node: "18.0.0" };
}

// @ts-ignore
if (!proc.version) {
  // @ts-ignore
  proc.version = "v18.0.0";
}

// @ts-ignore
if (!proc.browser) {
  // @ts-ignore
  proc.browser = true;
}

// @ts-ignore
if (!proc.env) {
  // @ts-ignore
  proc.env = { NODE_ENV: "production", DEBUG: "false" };
}

console.log("Polyfills loaded.");
// @ts-ignore
console.log("Buffer available:", typeof globalObject.Buffer !== "undefined");
// @ts-ignore
console.log("Buffer is function:", typeof globalObject.Buffer === "function");
console.log("process available:", typeof globalObject.process !== "undefined");
