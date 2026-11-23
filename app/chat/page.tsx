"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, AtSign, MessageCircle, Send, ShieldCheck, Trash2, Users } from "lucide-react";
import { AppPage, LoadingScreen, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { getCurrentUser } from "@/app/lib/authFunctions";
import { supabase } from "@/app/lib/supabaseClient";

type ChatUser = {
  id: string;
  full_name: string;
  role: string;
};

type ChatMessage = {
  id: string;
  author_id: string;
  body: string;
  created_at: string;
  deleted_at: string | null;
  author: { full_name: string; role: string } | null;
  mentions: string[];
};

type MessageQueryRow = {
  id: string;
  author_id: string;
  body: string;
  created_at: string;
  deleted_at: string | null;
  drivers: { full_name: string; role: string } | Array<{ full_name: string; role: string }> | null;
  chat_mentions: Array<{ mentioned_user_id: string }> | null;
};

async function getToken() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Your session expired. Please sign in again.");
  return session.access_token;
}

function normalizeMessage(row: MessageQueryRow): ChatMessage {
  return {
    id: row.id,
    author_id: row.author_id,
    body: row.body,
    created_at: row.created_at,
    deleted_at: row.deleted_at,
    author: Array.isArray(row.drivers) ? row.drivers[0] ?? null : row.drivers,
    mentions: (row.chat_mentions ?? []).map((mention) => mention.mentioned_user_id),
  };
}

export default function ChatPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [users, setUsers] = useState<ChatUser[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [openError, setOpenError] = useState(false);
  const [openAttempt, setOpenAttempt] = useState(0);
  const [sending, setSending] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [cursorPosition, setCursorPosition] = useState(0);
  const [selectedMentions, setSelectedMentions] = useState<Map<string, ChatUser>>(new Map());
  const scrollRef = useRef<HTMLDivElement>(null);
  const followingRef = useRef(true);
  const [following, setFollowing] = useState(true);
  const loadVersion = useRef(0);
  const cancelLoads = useCallback(() => { loadVersion.current += 1; }, []);
  const readMarker = useRef("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const loadMessages = useCallback(async () => {
    const version = ++loadVersion.current;
    const { data, error } = await supabase
      .from("chat_messages")
      .select("id, author_id, body, created_at, deleted_at, drivers!chat_messages_author_id_fkey(full_name, role), chat_mentions(mentioned_user_id)")
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(100);
    if (version !== loadVersion.current) return;
    if (error) throw error;
    const page = ((data ?? []) as unknown as MessageQueryRow[]).reverse().map(normalizeMessage);
    const keepPlace = !followingRef.current && page.length === 100;
    setMessages((previous) => {
      // Keep the row being read mounted when a new message pushes it out of the 100-row window.
      if (!keepPlace) return page;
      const overlap = previous.findIndex((message) => message.id === page[0].id);
      return overlap > 0 ? [...previous.slice(0, overlap), ...page] : page;
    });
  }, []);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const { user } = await getCurrentUser();
      if (!user) {
        router.replace("/");
        return;
      }

      const [profileResult, usersResult] = await Promise.all([
        supabase.from("drivers").select("role, active").eq("id", user.id).maybeSingle(),
        supabase.from("drivers").select("id, full_name, role").eq("active", true).order("full_name"),
      ]);
      if (!active) return;
      if (profileResult.error) throw profileResult.error;
      if (profileResult.data?.active === false) {
        await supabase.auth.signOut();
        router.replace("/");
        return;
      }
      if (usersResult.error) throw usersResult.error;
      await loadMessages();

      if (!active) return;
      setUserId(user.id);
      setIsAdmin(profileResult.data?.role === "admin");
      setUsers((usersResult.data ?? []) as ChatUser[]);
      setLoading(false);
    };

    void load().catch((error) => {
      console.error("Could not load group chat:", error);
      if (active) { setOpenError(true); setLoading(false); }
    });
    return () => { active = false; cancelLoads(); };
  }, [cancelLoads, loadMessages, openAttempt, router]);

  useEffect(() => {
    if (!userId) return;
    const refresh = () => {
      void loadMessages().catch((error) => console.error("Could not refresh group chat:", error));
    };
    const onVisible = () => { if (!document.hidden) refresh(); };
    const channel = supabase
      .channel("company-chat")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chat_messages" },
        refresh
      )
      .subscribe((status) => { if (status === "SUBSCRIBED") refresh(); });

    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      void supabase.removeChannel(channel);
    };
  }, [loadMessages, userId]);

  const jumpToLatest = () => {
    followingRef.current = true;
    setFollowing(true);
    const list = scrollRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  };

  // The list doesn't exist until loading finishes. Scroll only the chat, before paint.
  useLayoutEffect(() => {
    const list = scrollRef.current;
    if (list && followingRef.current) list.scrollTop = list.scrollHeight;
  }, [loading, messages]);

  const hasMessages = messages.length > 0;
  useLayoutEffect(() => {
    const list = scrollRef.current;
    if (!list || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      if (followingRef.current) list.scrollTop = list.scrollHeight;
    });
    observer.observe(list);
    if (list.firstElementChild) observer.observe(list.firstElementChild);
    return () => observer.disconnect();
  }, [loading, hasMessages]);

  const newest = messages[messages.length - 1];
  useEffect(() => {
    if (loading || !following || !userId || !newest) return;
    const markVisible = async () => {
      if (document.hidden || !followingRef.current || readMarker.current === newest.id) return;
      readMarker.current = newest.id;
      try {
        const { error } = await supabase.from("chat_reads").upsert({
          user_id: userId, last_read_at: newest.created_at,
        });
        if (error) throw error;
      } catch (error) {
        if (readMarker.current === newest.id) readMarker.current = "";
        console.error("Could not update chat read state:", error);
      }
    };
    void markVisible();
    document.addEventListener("visibilitychange", markVisible);
    return () => document.removeEventListener("visibilitychange", markVisible);
  }, [following, loading, newest, userId]);

  const mentionMatch = useMemo(() => {
    const cursor = Math.min(cursorPosition, draft.length);
    const beforeCursor = draft.slice(0, cursor);
    const match = /(?:^|\s)@([^@\n]*)$/.exec(beforeCursor);
    if (!match) return null;
    return { query: match[1].trim().toLocaleLowerCase(), start: match.index + match[0].indexOf("@"), cursor };
  }, [cursorPosition, draft]);

  const mentionSuggestions = useMemo(() => {
    if (!mentionMatch) return [];
    return users
      .filter((user) => !mentionMatch.query || user.full_name.toLocaleLowerCase().includes(mentionMatch.query))
      .slice(0, 8);
  }, [mentionMatch, users]);

  const insertMention = (user: ChatUser) => {
    if (!mentionMatch) return;
    const token = `@${user.full_name} `;
    const nextDraft = `${draft.slice(0, mentionMatch.start)}${token}${draft.slice(mentionMatch.cursor)}`;
    const nextCursor = mentionMatch.start + token.length;
    setDraft(nextDraft);
    setCursorPosition(nextCursor);
    setSelectedMentions((current) => new Map(current).set(user.id, user));
    window.setTimeout(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(nextCursor, nextCursor);
    }, 0);
  };

  const sendMessage = async () => {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      const token = await getToken();
      const mentionIds = Array.from(selectedMentions.entries())
        .filter(([, user]) => body.includes(`@${user.full_name}`))
        .map(([id]) => id);
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ body, mentionIds }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "The message could not be sent");
      setDraft("");
      setCursorPosition(0);
      setSelectedMentions(new Map());
      jumpToLatest();
      await loadMessages();
    } catch (error) {
      alert(error instanceof Error ? error.message : "The message could not be sent");
    } finally {
      setSending(false);
    }
  };

  const deleteMessage = async (message: ChatMessage) => {
    if (!confirm("Remove this message from the group chat?")) return;
    setDeletingId(message.id);
    try {
      const token = await getToken();
      const response = await fetch("/api/chat", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ messageId: message.id }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "The message could not be removed");
      await loadMessages();
    } catch (error) {
      alert(error instanceof Error ? error.message : "The message could not be removed");
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) return <LoadingScreen label="Opening company chat..." />;
  if (openError) return (
    <AppPage><p role="alert">Could not load the group chat.</p>
      <Button type="button" onClick={() => {
        setOpenError(false); setLoading(true); setOpenAttempt((n) => n + 1);
      }}>Retry chat</Button>
    </AppPage>
  );

  return (
    <AppPage>
      <PageHeader
        eyebrow="Company channel"
        title="Group chat"
        description="Everyone can write here and tag drivers or administrators with @."
        icon={MessageCircle}
        actions={<span className="flex items-center gap-1.5 rounded-full border border-emerald-300/15 bg-emerald-300/[0.06] px-3 py-1.5 text-[10px] font-semibold text-emerald-300"><Users size={13} /> {users.length} members</span>}
      />

      <Card className="overflow-hidden border border-white/8 bg-white/[0.025] py-0">
        <CardContent className="p-0">
          <div className="relative">
          <div ref={scrollRef} role="region" aria-label="Chat messages" tabIndex={0}
            onScroll={(event) => {
              const list = event.currentTarget;
              const nearEnd = list.scrollHeight - list.clientHeight - list.scrollTop <= 48;
              followingRef.current = nearEnd;
              setFollowing(nearEnd);
            }}
            className="h-[min(62vh,620px)] overflow-y-auto overscroll-contain px-3 py-4 sm:px-5">
            {messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center"><MessageCircle size={38} className="mb-3 text-slate-700" /><p className="text-sm text-slate-500">No messages yet. Start the conversation.</p></div>
            ) : (
              <div className="space-y-3">
                {messages.map((message) => {
                  const own = message.author_id === userId;
                  const canDelete = own || isAdmin;
                  return (
                    <div key={message.id} className={`flex gap-2.5 ${own ? "flex-row-reverse" : ""}`}>
                      <div className={`flex size-8 shrink-0 items-center justify-center rounded-xl text-[11px] font-semibold ${message.author?.role === "admin" ? "bg-violet-300/10 text-violet-300" : "bg-cyan-300/10 text-cyan-300"}`}>{message.author?.full_name?.charAt(0) || "?"}</div>
                      <div className={`max-w-[82%] ${own ? "text-right" : ""}`}>
                        <div className={`mb-1 flex items-center gap-1.5 ${own ? "justify-end" : ""}`}><span className="text-[10px] font-semibold text-slate-400">{message.author?.full_name || "Unknown user"}</span>{message.author?.role === "admin" && <ShieldCheck size={11} className="text-violet-300" />}<time className="text-[9px] text-slate-700">{new Date(message.created_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</time></div>
                        <div className={`group relative rounded-2xl border px-3.5 py-2.5 text-left ${own ? "border-cyan-300/20 bg-cyan-300/[0.09]" : "border-white/8 bg-white/[0.04]"}`}>
                          {message.deleted_at ? <p className="text-xs italic text-slate-600">Message removed</p> : <p className="whitespace-pre-wrap break-words text-sm leading-5 text-slate-200">{message.body}</p>}
                          {!message.deleted_at && canDelete && <button type="button" disabled={deletingId !== null} onClick={() => void deleteMessage(message)} aria-label="Remove message" className="absolute -right-2 -top-2 hidden size-6 items-center justify-center rounded-full border border-white/10 bg-[#0d1521] text-slate-600 hover:text-red-300 group-hover:flex"><Trash2 size={11} /></button>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          {!following && (
            <button type="button" onClick={jumpToLatest}
              className="absolute bottom-3 right-4 z-10 flex min-h-11 items-center gap-1.5 rounded-full border border-cyan-300/30 bg-[#112536] px-4 text-xs font-semibold text-cyan-200 shadow-md">
              <ArrowDown size={16} aria-hidden="true" /> Jump to latest
            </button>
          )}
          </div>

          <div className="relative border-t border-white/8 bg-[#090f18]/90 p-3 sm:p-4">
            {mentionMatch && mentionSuggestions.length > 0 && (
              <div className="absolute inset-x-3 bottom-[calc(100%-0.25rem)] z-20 max-h-64 overflow-y-auto rounded-2xl border border-white/10 bg-[#0d1521] p-1.5 shadow-2xl sm:inset-x-4">
                {mentionSuggestions.map((user) => <button key={user.id} type="button" onClick={() => insertMention(user)} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left hover:bg-white/5"><span className={`flex size-8 items-center justify-center rounded-lg text-xs font-semibold ${user.role === "admin" ? "bg-violet-300/10 text-violet-300" : "bg-cyan-300/10 text-cyan-300"}`}>{user.full_name.charAt(0)}</span><span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold text-white">{user.full_name}</span><span className="block text-[9px] uppercase tracking-wider text-slate-600">{user.role}</span></span></button>)}
              </div>
            )}
            <div className="flex items-end gap-2">
              <div className="relative min-w-0 flex-1">
                <Textarea
                  ref={textareaRef}
                  value={draft}
                  onChange={(event) => {
                    setDraft(event.target.value);
                    setCursorPosition(event.target.selectionStart);
                  }}
                  onSelect={(event) => setCursorPosition(event.currentTarget.selectionStart)}
                  onKeyUp={(event) => setCursorPosition(event.currentTarget.selectionStart)}
                  onClick={(event) => setCursorPosition(event.currentTarget.selectionStart)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey && !mentionMatch) {
                      event.preventDefault();
                      void sendMessage();
                    }
                  }}
                  maxLength={2000}
                  rows={2}
                  placeholder="Write a message... Use @ to tag someone"
                  className="max-h-36 min-h-12 resize-none rounded-2xl border-white/10 bg-black/15 pb-7 pr-10 text-white placeholder:text-slate-600"
                />
                <span className="pointer-events-none absolute bottom-2 left-3 flex items-center gap-1 text-[9px] text-slate-700"><AtSign size={10} /> tag a person</span>
                <span className="pointer-events-none absolute bottom-2 right-3 text-[9px] text-slate-700">{draft.length}/2000</span>
              </div>
              <Button type="button" size="icon" disabled={!draft.trim() || sending} onClick={() => void sendMessage()} aria-label="Send message" className="size-12 shrink-0 rounded-2xl bg-cyan-300 text-slate-950 hover:bg-cyan-200"><Send size={19} /></Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </AppPage>
  );
}
