import { describe, expect, it } from "vitest";
import { messagingContent } from "./meta-messaging";

describe("Instagram button delivery", () => {
  it("keeps a title-less non-follower postback so its gate can run", () => {
    expect(messagingContent({ postback: { payload: "AUTOMATION_FOLLOW_CHECK:gate-1" }, timestamp: 25 })).toEqual({
      payload: "AUTOMATION_FOLLOW_CHECK:gate-1",
      body: "[button tap]",
      externalId: "postback:AUTOMATION_FOLLOW_CHECK:gate-1:25",
    });
  });
  it("keeps quick-reply payload and its visible title", () => {
    expect(messagingContent({ message: { mid: "m1", text: "Send me the link", quick_reply: { payload: "AUTOMATION_FOLLOW_CHECK:gate-1" } } })).toEqual({
      payload: "AUTOMATION_FOLLOW_CHECK:gate-1",
      body: "Send me the link",
      externalId: "m1",
    });
  });
  it("keeps untimed retries stable for deduplication", () => {
    const event = { postback: { mid: "m1", payload: "AUTOMATION_FOLLOW_CHECK:gate-1" } };
    expect(messagingContent(event).externalId).toBe(messagingContent(event).externalId);
  });
});