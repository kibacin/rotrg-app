"use client";

import { useEffect, useState } from "react";
import { Bell, Megaphone, Send, Trash2 } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { getCurrentUser } from "../lib/authFunctions";
import { AppPage, LoadingScreen, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type Announcement = {
  id: number;
  admin_id: string;
  title: string;
  content: string;
  created_at: string;
  drivers?: { full_name: string } | null;
};

async function getAnnouncements() {
  const { data, error } = await supabase
    .from("announcements")
    .select("id, admin_id, title, content, created_at, drivers(full_name)")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as unknown as Announcement[];
}

export default function NotificationsPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;

    const loadPage = async () => {
      const [{ user }, loadedAnnouncements] = await Promise.all([
        getCurrentUser(),
        getAnnouncements(),
      ]);

      if (!active) return;
      setAnnouncements(loadedAnnouncements);
      setUserId(user?.id ?? null);

      if (user) {
        const { data } = await supabase
          .from("drivers")
          .select("role")
          .eq("id", user.id)
          .single();
        if (active) setIsAdmin(data?.role === "admin");
      }

      if (active) setLoading(false);
    };

    void loadPage().catch((error) => {
      console.error("Could not load announcements:", error);
      if (active) setLoading(false);
    });

    return () => {
      active = false;
    };
  }, []);

  const handleAddAnnouncement = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!userId || !title.trim() || !content.trim()) return;

    setSaving(true);
    try {
      const announcementTitle = title.trim();
      const announcementContent = content.trim();
      const { error } = await supabase.from("announcements").insert({
        admin_id: userId,
        title: announcementTitle,
        content: announcementContent,
      });
      if (error) throw error;

      setAnnouncements(await getAnnouncements());
      setTitle("");
      setContent("");

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("No active session");

      try {
        const response = await fetch("/api/send-notification", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            title: announcementTitle,
            body: announcementContent,
            url: "/notifications",
          }),
        });

        if (response.ok) {
          const result = await response.json();
          alert(`Announcement published and sent to ${result.result?.sent ?? 0} devices.`);
        } else {
          alert("Announcement published, but phone notifications could not be sent.");
        }
      } catch (notificationError) {
        console.error("Could not send push notifications:", notificationError);
        alert("Announcement published, but phone notifications could not be sent.");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "The announcement could not be published";
      alert(`Error: ${message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAnnouncement = async (id: number) => {
    if (!confirm("Delete this announcement?")) return;

    try {
      const { error } = await supabase.from("announcements").delete().eq("id", id);
      if (error) throw error;
      setAnnouncements((current) => current.filter((announcement) => announcement.id !== id));
    } catch (error) {
      const message = error instanceof Error ? error.message : "The announcement could not be deleted";
      alert(`Error: ${message}`);
    }
  };

  if (loading) return <LoadingScreen label="Loading announcements..." />;

  return (
    <AppPage>
      <PageHeader
        eyebrow="Team updates"
        title="Announcements"
        description={isAdmin ? "Publish an update for every driver." : "Important updates from your administrator."}
        icon={Bell}
      />

      {isAdmin && (
        <Card className="border border-cyan-300/12 bg-gradient-to-br from-cyan-300/[0.055] to-white/[0.025] py-0">
          <CardContent className="p-4 sm:p-6">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-2xl border border-cyan-300/15 bg-cyan-300/10 text-cyan-300">
                <Megaphone size={21} />
              </div>
              <div>
                <p className="font-semibold text-white">New announcement</p>
                <p className="text-xs text-slate-500">This will also trigger a phone notification.</p>
              </div>
            </div>

            <form onSubmit={handleAddAnnouncement} className="space-y-3">
              <Input
                placeholder="Announcement title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                required
                maxLength={120}
                className="h-11 rounded-xl border-white/10 bg-black/10 px-4 text-white placeholder:text-slate-600 focus-visible:border-cyan-300/30 focus-visible:ring-cyan-300/10"
              />
              <Textarea
                placeholder="Write the message drivers should receive..."
                value={content}
                onChange={(event) => setContent(event.target.value)}
                rows={4}
                required
                className="resize-none rounded-xl border-white/10 bg-black/10 px-4 py-3 text-white placeholder:text-slate-600 focus-visible:border-cyan-300/30 focus-visible:ring-cyan-300/10"
              />
              <Button
                type="submit"
                disabled={saving}
                className="h-11 w-full rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 font-semibold text-slate-950 hover:from-cyan-300 hover:to-blue-400"
              >
                {saving ? (
                  <span className="flex items-center gap-2">
                    <span className="size-4 animate-spin rounded-full border-2 border-slate-900/30 border-t-slate-900" />
                    Publishing...
                  </span>
                ) : (
                  <span className="flex items-center gap-2"><Send size={17} /> Publish announcement</span>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <section>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-white">Recent updates</h2>
            <p className="mt-0.5 text-xs text-slate-500">Newest announcements appear first.</p>
          </div>
          <span className="rounded-full border border-white/8 bg-white/[0.03] px-2.5 py-1 text-xs text-slate-500">
            {announcements.length}
          </span>
        </div>

        {announcements.length === 0 ? (
          <Card className="border border-white/8 bg-white/[0.03] py-0">
            <CardContent className="py-16 text-center">
              <Bell className="mx-auto mb-3 text-slate-700" size={38} />
              <p className="text-sm text-slate-500">No announcements yet.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {announcements.map((announcement) => (
              <Card key={announcement.id} className="border border-white/8 bg-white/[0.03] py-0">
                <CardContent className="p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-base font-semibold text-white">{announcement.title}</h3>
                      <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-300">{announcement.content}</p>
                    </div>
                    {isAdmin && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => void handleDeleteAnnouncement(announcement.id)}
                        aria-label="Delete announcement"
                        className="shrink-0 rounded-xl text-slate-600 hover:bg-red-400/10 hover:text-red-300"
                      >
                        <Trash2 />
                      </Button>
                    )}
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-white/7 pt-3 text-[11px] text-slate-600">
                    <span className="flex items-center gap-2">
                      <span className="flex size-6 items-center justify-center rounded-full bg-cyan-300/10 text-[10px] font-semibold text-cyan-300">
                        {announcement.drivers?.full_name?.charAt(0) || "A"}
                      </span>
                      {announcement.drivers?.full_name || "Administrator"}
                    </span>
                    <time dateTime={announcement.created_at}>
                      {new Date(announcement.created_at).toLocaleString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </time>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </AppPage>
  );
}
