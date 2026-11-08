import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, expect, it, vi } from "vitest";

vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));
vi.mock("@/components/app/BuyerSignIn", () => ({
  BuyerSignIn: (props: Record<string, unknown>) => <div data-testid="buyer-portal" {...props} />,
  BuyerSignInButton: () => null,
}));
vi.mock("@/components/app/DeliveryLeadForm", () => ({
  useLeadForm: () => ({ active: false, state: "idle" }),
  LeadFields: () => null,
}));
vi.mock("@/components/ui/dialog", () => ({
  Dialog: (props: Record<string, unknown>) => <div data-testid="payment-dialog" {...props} />,
  DialogContent: () => null,
  DialogHeader: () => null,
  DialogTitle: () => null,
  DialogDescription: () => null,
  DialogTrigger: () => null,
}));

import { DeliveryPageView } from "./DeliveryPageView";

afterEach(() => vi.unstubAllGlobals());

it("opens the buyer portal when the payment-success dialog is dismissed, retaining its session", async () => {
  const token = "a".repeat(64);
  const stored = new Map<string, string>();
  vi.stubGlobal("window", { location: { hash: `#paid=${token}`, pathname: "/p/test", search: "" } });
  vi.stubGlobal("history", { replaceState: vi.fn() });
  vi.stubGlobal("localStorage", { setItem: (key: string, value: string) => stored.set(key, value) });
  let tree: ReactTestRenderer | undefined;
  await act(async () => { tree = create(<DeliveryPageView title="Paid test offer" body="" buyerSlug="test" />); });
  expect(stored.get("autodm:buyer:test")).toBe(token);
  const dialog = tree?.root.findByProps({ "data-testid": "payment-dialog" });
  expect(dialog?.props["open"]).toBe(true);
  await act(async () => { dialog?.props["onOpenChange"](false); });
  expect(tree?.root.findByProps({ "data-testid": "payment-dialog" }).props["open"]).toBe(false);
  expect(tree?.root.findByProps({ "data-testid": "buyer-portal" }).props["open"]).toBe(true);
  expect(stored.get("autodm:buyer:test")).toBe(token);
  await act(async () => { tree?.unmount(); });
});