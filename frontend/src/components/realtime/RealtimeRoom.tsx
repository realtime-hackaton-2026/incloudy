import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useChannel } from "@portalsdk/react";
import { useGameState } from "../../state/gameState";
import { subscribeRealtimeActions } from "../../realtimeBus";
import { ROOM_EVENT } from "../../realtime/roomEvents";
import { getAvatarById } from "../../data/avatars";

const CHAT_EVENT = "BRUIX_CHAT";
const SESSION_EVENT = "BRUIX_SESSION_STARTED";
const PROFILE_EVENT = "BRUIX_PROFILE";
const GUIDE_EVENT = "BRUIX_GUIDE";
const LOCAL_AUTHOR_KEY = "brujula:author-id:v3";
const LOCAL_ROLE_KEY = "brujula:author-role:v1";

function getLocalAuthorId() {
  if (typeof window === "undefined") return "local-author";
  let id = window.sessionStorage.getItem(LOCAL_AUTHOR_KEY);
  if (!id) {
    id = `author-${crypto.randomUUID()}`;
    window.sessionStorage.setItem(LOCAL_AUTHOR_KEY, id);
  }
  return id;
}

function getLocalRole() {
  if (typeof window === "undefined") return "docente";
  return window.sessionStorage.getItem(LOCAL_ROLE_KEY) || "docente";
}

function eventId() {
  return crypto.randomUUID();
}

function messageKey(message: any) {
  return String(message?.id || "");
}

function participantId(participant: any) {
  return String(participant?.id || "");
}

type RealtimeRoomProps = {
  roomId: string;
  children: (value: any) => ReactNode;
};

export default function RealtimeRoom({ roomId, children }: RealtimeRoomProps) {
  const { state, applyRemoteAction, recordRoomInteraction } = useGameState();
  const authorId = useMemo(getLocalAuthorId, []);
  const authorRole = useMemo(getLocalRole, []);
  const [chatMessages, setChatMessages] = useState([]);
  const [sessionStarted, setSessionStarted] = useState(false);

  // IMPORTANT: keep the useChannel options to Portal's documented surface.
  // Dynamic metadata/options here can cause a reconnect/update loop.
  const channel = useChannel({ channelId: roomId || undefined, history: 100 });

  const channelRef = useRef(channel);
  const applyRemoteActionRef = useRef(applyRemoteAction);
  const studentNameRef = useRef(state.studentName);
  const authorIdRef = useRef(authorId);
  const authorRoleRef = useRef(authorRole);
  const roomParticipantRef = useRef(true);
  const processedMessageIdsRef = useRef(new Set());
  const sentGuideIdsRef = useRef(new Set());
  const previousPlayerCountRef = useRef(null);
  const previousMissionCountRef = useRef(state.completedMissions.length);
  const previousZoneRef = useRef(state.currentZone);

  channelRef.current = channel;
  applyRemoteActionRef.current = applyRemoteAction;
  studentNameRef.current = state.studentName;
  authorIdRef.current = authorId;
  authorRoleRef.current = authorRole;

  const presence = channel?.presence?.kind === "detailed" && Array.isArray(channel.presence.participants)
    ? channel.presence.participants
    : [];

  // Portal's presence id is the stable anonymous identity. Do not invent a
  // second presence id or attach mutable React state to the channel options.
  const players = useMemo(() => {
    const byId = new Map();
    presence.forEach((participant) => {
      const id = participantId(participant);
      if (!id || byId.has(id)) return;
      byId.set(id, {
        id,
        name: participant?.username || `Docente ${byId.size + 1}`,
        avatarId: participant?.metadata?.avatarId,
        avatar: getAvatarById(participant?.metadata?.avatarId).src,
        anon: participant?.anon,
      });
    });
    return [...byId.values()].sort((a, b) => a.id.localeCompare(b.id)).slice(0, 6);
  }, [presence]);

  const rawPlayerCount = useMemo(() => {
    const ids = new Set(presence.map(participantId).filter(Boolean));
    return ids.size;
  }, [presence]);

  const roomFull = rawPlayerCount > 5;
  // Portal anonymous presence means a connected browser is in the channel.
  // Membership/max-seat enforcement belongs server-side; the UI hard-stops at 5.
  const isRoomParticipant = !roomFull;
  roomParticipantRef.current = isRoomParticipant;

  const guideHostId = useMemo(() => {
    const ids = players.map((player) => player.id);
    return ids.length ? [...ids].sort()[0] : null;
  }, [players]);

  const sendPortalMessage = useCallback(async (content: any) => {
    const currentChannel = channelRef.current;
    if (!currentChannel?.send || !roomParticipantRef.current) return false;
    try {
      await currentChannel.send({ content });
      return true;
    } catch (error) {
      console.error("[BRÚJULA:portal:send]", error);
      return false;
    }
  }, []);

  const sendChat = useCallback(async (text: string, options: Record<string, any> = {}) => {
    const clean = String(text || "").trim().slice(0, 320);
    if (!clean || !roomParticipantRef.current) return false;
    const message = {
      kind: CHAT_EVENT,
      id: eventId(),
      senderId: options.senderId || authorIdRef.current,
      authorType: options.authorType || "player",
      authorName: options.authorName || studentNameRef.current || "Docente",
      role: options.role || authorRoleRef.current || "docente",
      zone: options.zone || state.currentZone || null,
      text: clean,
      createdAt: new Date().toISOString(),
    };
    const ok = await sendPortalMessage(message);
    if (ok) {
      recordRoomInteraction(message);
      setChatMessages((current) => {
        if (current.some((item) => item.id === message.id)) return current;
        return [...current, message].slice(-80);
      });
    }
    return ok;
  }, [recordRoomInteraction, sendPortalMessage, state.currentZone]);

  const sendBruix = useCallback(async (text: string, guideId: string = eventId()) => {
    if (!guideHostId || guideHostId !== players[0]?.id) return false;
    if (sentGuideIdsRef.current.has(guideId)) return false;
    sentGuideIdsRef.current.add(guideId);
    return sendChat(text, {
      senderId: `bruix-${guideId}`,
      authorType: "bruix",
      authorName: "Bruix",
      role: "bruix",
    });
  }, [guideHostId, players, sendChat]);

  const startSession = useCallback(async () => {
    if (!roomParticipantRef.current || rawPlayerCount < 2 || rawPlayerCount > 5) return false;
    if (sessionStarted) return true;
    const event = {
      kind: SESSION_EVENT,
      id: eventId(),
      senderId: authorIdRef.current,
      createdAt: new Date().toISOString(),
    };
    const ok = await sendPortalMessage(event);
    if (!ok) return false;
    setSessionStarted(true);
    await sendChat(
      "Comenzamos. Soy Bruix y voy a cuidar el proceso, no a daros las respuestas. Primera ronda: cada docente escribe en una frase qué es lo primero que observa en el caso. Leed las miradas de los demás antes de responder.",
      { senderId: `bruix-start-${event.id}`, authorType: "bruix", authorName: "Bruix" }
    );
    return true;
  }, [rawPlayerCount, sendChat, sendPortalMessage, sessionStarted]);

  // Local game actions become Portal events. This effect is intentionally
  // mounted once; the channel/send function is always read from a ref.
  useEffect(() => {
    return subscribeRealtimeActions((action) => {
      if (!roomParticipantRef.current) return;
      void sendPortalMessage({
        kind: ROOM_EVENT,
        id: eventId(),
        senderId: authorIdRef.current,
        action,
      });
    });
  }, [sendPortalMessage]);

  // Consume history/live messages. Only message ids are used for dedupe; state
  // updates happen only when a genuinely new message/event is encountered.
  useEffect(() => {
    const messages = Array.isArray(channel?.messages) ? channel.messages : [];
    const newChats = [];
    let gotSession = false;

    for (const message of messages) {
      const key = messageKey(message);
      const event = message?.content;
      if (!key || !event || processedMessageIdsRef.current.has(key)) continue;
      processedMessageIdsRef.current.add(key);

      if (event.kind === ROOM_EVENT) {
        if (event.senderId !== authorIdRef.current && event.action) {
          applyRemoteActionRef.current(event.action);
        }
      } else if (event.kind === SESSION_EVENT) {
        gotSession = true;
      } else if (event.kind === CHAT_EVENT || event.kind === PROFILE_EVENT || event.kind === GUIDE_EVENT) {
        if (event.kind === CHAT_EVENT || event.kind === GUIDE_EVENT) {
          newChats.push(event);
          recordRoomInteraction(event);
        }
      }
    }

    if (processedMessageIdsRef.current.size > 800) {
      const ids = [...processedMessageIdsRef.current].slice(-400);
      processedMessageIdsRef.current = new Set(ids);
    }

    if (gotSession) setSessionStarted((current) => current || true);

    if (newChats.length) {
      setChatMessages((current) => {
        const byId = new Map(current.map((item) => [item.id, item]));
        newChats.forEach((item) => byId.set(item.id, item));
        return [...byId.values()]
          .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
          .slice(-80);
      });
    }
  }, [channel?.messages, recordRoomInteraction]);

  // Bruix's facilitation engine. It is deliberately deterministic and shared:
  // only the elected host speaks for Bruix, so five browsers never produce five
  // competing guides.
  useEffect(() => {
    if (!sessionStarted || !guideHostId || guideHostId !== players[0]?.id) return;
    const playerMessages = chatMessages.filter((message) => message.authorType === "player");
    const uniqueAuthors = new Set(playerMessages.map((message) => message.senderId));
    const responseCount = uniqueAuthors.size;
    const threshold = Math.min(2, Math.max(2, players.length));

    if (responseCount >= threshold) {
      void sendBruix(
        "Ya tenemos varias miradas. Ahora no busquéis tener razón: buscad un patrón compartido. En una frase, decid qué observación os parece más importante y por qué. Después elegiremos juntos el siguiente paso.",
        "guide-r2"
      );
    }
  }, [chatMessages, players, sessionStarted, guideHostId, sendBruix]);

  useEffect(() => {
    const count = players.length;
    const previous = previousPlayerCountRef.current;
    if (previous === null) {
      previousPlayerCountRef.current = count;
      return;
    }
    if (count !== previous && sessionStarted) {
      if (count > previous) {
        void sendBruix(`Se incorpora otro docente. Ya somos ${count}. Ponedle al día en una frase antes de avanzar.`, `presence-in-${count}`);
      } else {
        void sendBruix(`Un docente ha salido. Ahora somos ${count}. Antes de decidir, comprobad que la mirada del equipo sigue representada.`, `presence-out-${count}-${previous}`);
      }
      previousPlayerCountRef.current = count;
    }
  }, [players.length, sendBruix, sessionStarted]);

  useEffect(() => {
    if (!sessionStarted) return;
    const count = state.completedMissions.length;
    if (count > previousMissionCountRef.current) {
      const mission = state.completedMissions[count - 1];
      void sendBruix(
        count < 5
          ? `Buen trabajo. Habéis completado «${mission}». Antes de movernos, parad un momento: ¿qué evidencia de esta estación cambia vuestra lectura del caso? Después podremos avanzar juntos.`
          : "Habéis recorrido las cinco estaciones. Ahora toca cerrar el caso: defended vuestra lectura con las evidencias que habéis reunido, no con intuiciones.",
        `mission-${mission}`
      );
    }
    previousMissionCountRef.current = count;
  }, [state.completedMissions.length, sendBruix, sessionStarted]);

  useEffect(() => {
    if (!sessionStarted || !state.currentZone || state.currentZone === previousZoneRef.current) return;
    previousZoneRef.current = state.currentZone;
    void sendBruix(
      `Llegamos a «${state.currentZone}». Primero observamos, luego contrastamos y solo después actuamos. Hablad entre vosotros antes de elegir.`,
      `zone-${state.currentZone}`
    );
  }, [state.currentZone, sendBruix, sessionStarted]);

  const value = {
    channel,
    playerId: authorId,
    players,
    status: channel?.status || "offline",
    roomId,
    chatMessages,
    sendChat,
    roomFull,
    isRoomParticipant,
    rawPlayerCount,
    sessionStarted,
    startSession,
    guideHostId,
    authorRole,
  };

  return children(value);
}
