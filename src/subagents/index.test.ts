import { describe, it, expect } from "vitest";
import { buildSubagentRegistry } from "./index.js";
import type { SubagentRegistry } from "./index.js";
import type { SubagentDefinition } from "./types.js";

describe("buildSubagentRegistry", () => {
  it("returns an object (SubagentRegistry)", () => {
    const registry = buildSubagentRegistry({ gatewayUrl: "ws://localhost:18789" });
    expect(typeof registry).toBe("object");
  });

  it("registry contains 'default' agent with name 'openclaw-gateway'", () => {
    const registry = buildSubagentRegistry({ gatewayUrl: "ws://localhost:18789" });
    expect(registry.default).toBeDefined();
    expect(registry.default.name).toBe("openclaw-gateway");
    expect(typeof registry.default.handle).toBe("function");
  });

  it("SubagentRegistry values conform to SubagentDefinition interface", () => {
    const mockAgent: SubagentDefinition = {
      name: "test",
      description: "Test agent",
      handle: async () => "hello",
    };
    const registry: SubagentRegistry = { test: mockAgent };
    expect(registry.test.name).toBe("test");
    expect(typeof registry.test.handle).toBe("function");
  });
});
