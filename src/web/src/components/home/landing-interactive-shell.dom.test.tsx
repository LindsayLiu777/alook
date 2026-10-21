import type { ReactNode } from "react"
import type { UnreadServer } from "@/lib/community/models/inbox"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, setupUser } from "@/test/react-dom-harness"
import LandingInteractiveShell from "./landing-interactive-shell"
import { DEMO_CHANNELS, DEMO_MESSAGES, DEMO_PROFILES, DEMO_SERVERS } from "./landing-interactive-shell-data"

vi.mock("@/hooks/use-mobile", () => ({ useBreakpoint: () => "desktop", useIsMobile: () => false }))
vi.mock("@/components/community/shell/community-shell-layout", () => ({ CommunityShellLayout: ({ rail, sidebar, main, userBar, overlays }: Record<string, ReactNode>) => <div>{rail}{sidebar}{main}{userBar}{overlays}</div> }))
vi.mock("@/components/community/shell/community-inbox-popover", () => ({ InboxPopover: ({ unreads, onOpenChannel }: { unreads: UnreadServer[]; onOpenChannel: (server: UnreadServer, channel: UnreadServer["channels"][number]) => void }) => <div>{unreads.flatMap((server) => server.channels.map((channel) => <button key={channel.channelId} onClick={() => onOpenChannel(server, channel)}>{channel.channelName} {channel.mentionCount}</button>))}</div> }))
vi.mock("@/components/community/shell/user-bar", () => ({ UserBar: ({ unreadCount, inbox, inboxOpen, onInboxOpenChange }: { unreadCount: number; inbox: ReactNode; inboxOpen: boolean; onInboxOpenChange: (open: boolean) => void }) => <div><span>{unreadCount} unread conversations or requests</span><button onClick={() => onInboxOpenChange(!inboxOpen)}>Inbox</button>{inboxOpen && inbox}</div> }))
vi.mock("@/components/community/messages/composer", () => ({ Composer: ({ onAcceptSend }: { onAcceptSend: (text: string) => boolean }) => <button onClick={() => onAcceptSend("A local test message")}>Send test message</button> }))
vi.mock("@/components/community/messages/message-list", () => ({ MessageList: ({ messages, unreadCount, onJumpToPresent }: { messages: { id: string; content: string }[]; unreadCount: number; onJumpToPresent: () => void }) => <div>{messages.map((message) => <p key={message.id}>{message.content}</p>)}{unreadCount > 0 && <button onClick={onJumpToPresent}>Catch up {unreadCount}</button>}</div> }))

beforeEach(() => { vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} unobserve() {} }) })
afterEach(() => vi.unstubAllGlobals())

describe("interactive landing workspace", () => {
  it("has three populated spaces and people sharing agents with different owners", () => {
    expect(DEMO_SERVERS).toHaveLength(3)
    for (const server of DEMO_SERVERS) {
      const groups = DEMO_CHANNELS[server.id]
      expect(groups.some((group) => group.private)).toBe(true)
      expect(groups.some((group) => !group.private)).toBe(true)
      expect(groups.flatMap((group) => group.channels).length).toBeGreaterThanOrEqual(8)
      for (const channel of groups.flatMap((group) => group.channels)) {
        expect(DEMO_MESSAGES[channel.id].length).toBeGreaterThanOrEqual(3)
        for (const message of DEMO_MESSAGES[channel.id]) {
          expect(DEMO_PROFILES.has(message.authorId!)).toBe(true)
          expect(message.content).not.toMatch(/[\u4e00-\u9fff]/)
        }
      }
    }
    const authors = new Set(DEMO_MESSAGES["demo-general"].map((message) => message.authorId))
    expect([...authors].filter((id) => DEMO_PROFILES.get(id!)?.kind === "human")).toHaveLength(3)
    expect(DEMO_PROFILES.get("demo-maya")?.ownerUserId).toBe("demo-shelly")
    expect(DEMO_PROFILES.get("demo-alli")?.ownerUserId).toBe("demo-gus")
  })
  it("catches up, reduces the Inbox count, and keeps local messages in their room", async () => {
    render(<LandingInteractiveShell />)
    expect(screen.getByText("3 unread conversations or requests")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Catch up 3" }))
    expect(screen.getByText("2 unread conversations or requests")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Send test message" }))
    expect(await screen.findByText("A local test message")).toBeVisible()
    fireEvent.click(screen.getByRole("button", { name: "design-review" }))
    expect(screen.queryByText("A local test message")).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "Catch up 2" }))
    expect(screen.getByText("1 unread conversations or requests")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "general" }))
    expect(screen.getByText("A local test message")).toBeVisible()
    expect(screen.queryByRole("button", { name: "Reset demo" })).toBeNull()
  })
  it("opens an Inbox room at the latest messages and clears its unread immediately", async () => {
    render(<LandingInteractiveShell />)
    await setupUser().click(screen.getByRole("button", { name: "Inbox" }))
    fireEvent.click(await screen.findByRole("button", { name: "design-review 1" }))
    expect(screen.getByText("2 unread conversations or requests")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Catch up 2" })).toBeNull()
    expect(screen.getByText(DEMO_MESSAGES["demo-design-review"].at(-1)!.content!)).toBeVisible()
  })
  it("opens Friends, My Bots and Machines as populated pages", () => {
    render(<LandingInteractiveShell />)
    fireEvent.click(screen.getAllByRole("link", { name: "Home" })[0])
    expect(screen.getByPlaceholderText("Search friends")).toBeVisible()
    expect(screen.getByRole("link", { name: "Alli" })).toHaveTextContent(/^Alli$/)
    fireEvent.click(screen.getByRole("link", { name: "My Bots" }))
    expect(screen.getByRole("heading", { name: "My Bots" })).toBeVisible()
    expect(screen.getByRole("button", { name: /Active Bots: 5/ })).toBeVisible()
    fireEvent.click(screen.getByRole("link", { name: "Machines" }))
    expect(screen.getByRole("heading", { name: "Machines" })).toBeVisible()
    expect(screen.getByText("Gus’s MacBook Pro")).toBeVisible()
  })
})
