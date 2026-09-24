import { describe, expect, it } from "vitest";
import {
  followGateId,
  isMessagingEventType,
  messagingContent,
  normalizeMessagingEvent,
} from "./meta-messaging";

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
  it("unwraps taps delivered through changes[].value", () => {
    const event = normalizeMessagingEvent({
      field: "messaging_postbacks",
      value: {
        sender: { id: "contact-1" },
        postback: { payload: "AUTOMATION_FOLLOW_CHECK:gate-1" },
        timestamp: 42,
      },
    });
    expect(event.sender?.id).toBe("contact-1");
    expect(messagingContent(event)).toMatchObject({
      payload: "AUTOMATION_FOLLOW_CHECK:gate-1",
      body: "[button tap]",
    });
  });
  it("normalizes scalar ids used by Instagram change events", () => {
    const event = normalizeMessagingEvent({
      value: {
        sender_id: "contact-2",
        recipient_id: "account-1",
        message: {
          mid: "m2",
          text: "Send me the link",
          quick_reply: { payload: "AUTOMATION_FOLLOW_CHECK:gate-2" },
        },
      },
    });
    expect(event.sender?.id).toBe("contact-2");
    expect(event.recipient?.id).toBe("account-1");
    expect(messagingContent(event).payload).toBe("AUTOMATION_FOLLOW_CHECK:gate-2");
  });
  it("recognizes singular, plural, postback, and standby event fields", () => {
    expect(isMessagingEventType("instagram.message")).toBe(true);
    expect(isMessagingEventType("instagram.messages")).toBe(true);
    expect(isMessagingEventType("instagram.messaging_postbacks")).toBe(true);
    expect(isMessagingEventType("page.standby")).toBe(true);
    expect(isMessagingEventType("instagram.comments")).toBe(false);
  });

  it("extracts only a non-empty follow gate id", () => {
    expect(followGateId("AUTOMATION_FOLLOW_CHECK:gate-1")).toBe("gate-1");
    expect(followGateId("AUTOMATION_FOLLOW_CHECK:  ")).toBeNull();
    expect(followGateId("OTHER:gate-1")).toBeNull();
  });
});