import { describe, it, expect } from "vitest";
import { resolveThreadTs } from "./reply.js";

describe("resolveThreadTs", () => {
  it("returns thread_ts when message is in a thread", () => {
    expect(resolveThreadTs({ thread_ts: "111.222", ts: "333.444" })).toBe(
      "111.222",
    );
  });

  it("returns ts when message is top-level (no thread_ts)", () => {
    expect(resolveThreadTs({ ts: "333.444" })).toBe("333.444");
  });

  it("returns ts when thread_ts is undefined", () => {
    expect(resolveThreadTs({ thread_ts: undefined, ts: "333.444" })).toBe(
      "333.444",
    );
  });
});
