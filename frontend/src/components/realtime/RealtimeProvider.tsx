import { createContext, useContext, type ReactNode } from "react";
import { PortalProvider } from "@portalsdk/react";
import { portal } from "../../lib/portal";
import RealtimeRoom from "./RealtimeRoom";

export type RealtimeContextValue = {
  channel: any;
  players: any[];
  status: string;
  roomId: string | null;
  playerId: string | null;
  chatMessages: any[];
  sendChat: (text: string, options?: Record<string, any>) => Promise<boolean | void>;
  roomFull: boolean;
  isRoomParticipant: boolean;
  rawPlayerCount: number;
  sessionStarted: boolean;
  startSession: () => Promise<boolean | void>;
  guideHostId?: string | null;
  authorRole?: string;
};

const RealtimeContext = createContext<RealtimeContextValue>({
  channel: null,
  players: [],
  status: "offline",
  roomId: null,
  playerId: null,
  chatMessages: [],
  sendChat: async () => {},
  roomFull: false,
  isRoomParticipant: false,
  rawPlayerCount: 0,
  sessionStarted: false,
  startSession: async () => {},
  guideHostId: null,
  authorRole: "docente",
});

export function useRealtimeRoom() {
  return useContext(RealtimeContext);
}

type RealtimeProviderProps = {
  roomId: string;
  children: ReactNode;
};

export default function RealtimeProvider({ roomId, children }: RealtimeProviderProps) {
  if (!portal) return (
    <RealtimeContext.Provider value={{
      channel: null,
      players: [],
      status: "offline",
      roomId,
      playerId: null,
      chatMessages: [],
      sendChat: async () => {},
      roomFull: false,
      isRoomParticipant: false,
      rawPlayerCount: 0,
      sessionStarted: false,
      startSession: async () => {},
    }}>
      {children}
    </RealtimeContext.Provider>
  );

  return (
    <PortalProvider client={portal}>
      <RealtimeRoom roomId={roomId}>
        {(value: RealtimeContextValue) => <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>}
      </RealtimeRoom>
    </PortalProvider>
  );
}
