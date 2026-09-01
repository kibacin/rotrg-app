"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AtSign, Bell, CalendarDays, Camera, CarFront, ChevronRight, ImagePlus, Megaphone, Send, Trash2, X } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { getCurrentUser } from "../lib/authFunctions";
import { compressImage } from "../lib/image";
import { AppPage, LoadingScreen, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type AnnouncementImage = {
  id: string;
  storage_path: string;
  sort_order: number;
  signedUrl: string | null;
};

type Announcement = {
  id: number;
  admin_id: string;
  title: string;
  content: string;
  created_at: string;
  expires_at: string;
  drivers: { full_name: string } | null;
  images: AnnouncementImage[];
};

type AnnouncementQueryRow = Omit<Announcement, "drivers" | "images"> & {
  drivers: { full_name: string } | Array<{ full_name: string }> | null;
  announcement_images: Array<Omit<AnnouncementImage, "signedUrl">> | null;
};

type PersonalNotification = {
  id: string;
  kind: "vehicle_assignment" | "schedule_change" | "chat_mention" | "chat_message";
  title: string;
  body: string;
  url: string;
  read_at: string | null;
  created_at: string;
};

async function getAnnouncements() {
  const { data, error } = await supabase
    .from("announcements")
    .select("id, admin_id, title, content, created_at, expires_at, drivers(full_name), announcement_images(id, storage_path, sort_order)")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });
  if (error) throw error;

  const rows = (data ?? []) as unknown as AnnouncementQueryRow[];
  const paths = rows.flatMap((row) => (row.announcement_images ?? []).map((image) => image.storage_path));
  const signedUrlByPath = new Map<string, string>();

  if (paths.length) {
    const { data: signedUrls, error: signedUrlError } = await supabase.storage
      .from("announcement-images")
      .createSignedUrls(paths, 60 * 60);
    if (signedUrlError) throw signedUrlError;
    for (const item of signedUrls ?? []) {
      if (item.path && item.signedUrl) signedUrlByPath.set(item.path, item.signedUrl);
    }
  }

  return rows.map((row): Announcement => ({
    id: row.id,
    admin_id: row.admin_id,
    title: row.title,
    content: row.content,
    created_at: row.created_at,
    expires_at: row.expires_at,
    drivers: Array.isArray(row.drivers) ? row.drivers[0] ?? null : row.drivers,
    images: (row.announcement_images ?? [])
      .sort((first, second) => first.sort_order - second.sort_order)
      .map((image) => ({ ...image, signedUrl: signedUrlByPath.get(image.storage_path) ?? null })),
  }));
}

function NotificationIcon({ kind }: { kind: PersonalNotification["kind"] }) {
  if (kind === "schedule_change") return <CalendarDays size={19} />;
  if (kind === "chat_mention") return <AtSign size={19} />;
  if (kind === "chat_message") return <Bell size={19} />;
  return <CarFront size={19} />;
}

export default function NotificationsPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [personalNotifications, setPersonalNotifications] = useState<PersonalNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [images, setImages] = useState<File[]>([]);
  const [optimizing, setOptimizing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const imagePreviews = useMemo(
    () => images.map((image) => URL.createObjectURL(image)),
    [images]
  );

  useEffect(
    () => () => imagePreviews.forEach((url) => URL.revokeObjectURL(url)),
    [imagePreviews]
  );

  useEffect(() => {
    let active = true;
    const loadPage = async () => {
      const { user } = await getCurrentUser();
      if (!user) return;

      const [loadedAnnouncements, profileResult, notificationsResult] = await Promise.all([
        getAnnouncements(),
        supabase.from("drivers").select("role, active").eq("id", user.id).single(),
        supabase
          .from("user_notifications")
          .select("id, kind, title, body, url, read_at, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(100),
      ]);
      if (notificationsResult.error) throw notificationsResult.error;

      if (!active) return;
      const loadedNotifications = (notificationsResult.data ?? []) as PersonalNotification[];
      setAnnouncements(loadedAnnouncements);
      setPersonalNotifications(loadedNotifications);
      setUserId(user.id);
      setIsAdmin(profileResult.data?.role === "admin");
      setLoading(false);

      if (loadedNotifications.some((notification) => !notification.read_at)) {
        void supabase
          .from("user_notifications")
          .update({ read_at: new Date().toISOString() })
          .eq("user_id", user.id)
          .is("read_at", null);
      }
    };

    void loadPage().catch((error) => {
      console.error("Could not load notifications:", error);
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, []);

  const selectImages = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!selected.length) return;
    if (selected.some((image) => !image.type.startsWith("image/"))) {
      alert("Only images can be attached to an announcement.");
      return;
    }

    setOptimizing(true);
    try {
      const remaining = Math.max(0, 3 - images.length);
      const optimized: File[] = [];
      for (const image of selected.slice(0, remaining)) {
        optimized.push(await compressImage(image, "announcement"));
      }
      setImages((current) => [...current, ...optimized].slice(0, 3));
      if (selected.length > remaining) alert("An announcement can contain up to 3 images.");
    } finally {
      setOptimizing(false);
    }
  };

  const handleAddAnnouncement = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!userId || !title.trim() || !content.trim()) return;
    setSaving(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Your session expired. Please sign in again.");

      const formData = new FormData();
      formData.set("title", title.trim());
      formData.set("content", content.trim());
      images.forEach((image) => formData.append("images", image));

      const response = await fetch("/api/announcements", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: formData,
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "The announcement could not be published");

      setAnnouncements(await getAnnouncements());
      setTitle("");
      setContent("");
      setImages([]);
      alert(`Announcement published${result.push ? ` and sent to ${result.push.sent} devices` : ""}.`);
    } catch (error) {
      alert(`Error: ${error instanceof Error ? error.message : "The announcement could not be published"}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAnnouncement = async (announcementId: number) => {
    if (!confirm("Delete this announcement and all of its images?")) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Your session expired. Please sign in again.");
      const response = await fetch("/api/announcements", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ announcementId }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "The announcement could not be deleted");
      setAnnouncements((current) => current.filter((announcement) => announcement.id !== announcementId));
    } catch (error) {
      alert(`Error: ${error instanceof Error ? error.message : "The announcement could not be deleted"}`);
    }
  };

  if (loading) return <LoadingScreen label="Loading notifications..." />;

  return (
    <AppPage>
      <PageHeader
        eyebrow="Team updates"
        title={isAdmin ? "Announcements & activity" : "Notifications"}
        description={isAdmin ? "Schedule activity, chat messages and announcements for every driver." : "Assignments, chat messages and important team updates."}
        icon={Bell}
      />

      <section>
        <div className="mb-3 flex items-center justify-between">
          <div><h2 className="font-semibold text-white">For you</h2><p className="mt-0.5 text-xs text-slate-500">{isAdmin ? "Driver schedule changes and group chat messages." : "Vehicle assignments and group chat messages."}</p></div>
          <span className="rounded-full border border-white/8 bg-white/[0.03] px-2.5 py-1 text-xs text-slate-500">{personalNotifications.length}</span>
        </div>
        {personalNotifications.length === 0 ? (
          <Card className="border border-white/8 bg-white/[0.03] py-0"><CardContent className="py-10 text-center"><Bell className="mx-auto mb-3 text-slate-700" size={32} /><p className="text-sm text-slate-500">No personal notifications yet.</p></CardContent></Card>
        ) : (
          <div className="space-y-2.5">
            {personalNotifications.map((notification) => (
              <button key={notification.id} type="button" onClick={() => router.push(notification.url || "/notifications")} className="group block w-full text-left">
                <Card className="border border-cyan-300/12 bg-gradient-to-br from-cyan-300/[0.055] to-white/[0.025] py-0 transition group-hover:border-cyan-300/25">
                  <CardContent className="flex items-start gap-3 p-4">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-cyan-300/15 bg-cyan-300/10 text-cyan-300"><NotificationIcon kind={notification.kind} /></div>
                    <div className="min-w-0 flex-1"><h3 className="text-sm font-semibold text-white">{notification.title}</h3><p className="mt-1 text-xs leading-5 text-slate-400">{notification.body}</p><time className="mt-2 block text-[10px] text-slate-600">{new Date(notification.created_at).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</time></div>
                    <ChevronRight size={17} className="mt-1 text-slate-700 group-hover:text-cyan-300" />
                  </CardContent>
                </Card>
              </button>
            ))}
          </div>
        )}
      </section>

      {isAdmin && (
        <Card className="border border-cyan-300/12 bg-gradient-to-br from-cyan-300/[0.055] to-white/[0.025] py-0">
          <CardContent className="p-4 sm:p-6">
            <div className="mb-5 flex items-center gap-3"><div className="flex size-11 items-center justify-center rounded-2xl border border-cyan-300/15 bg-cyan-300/10 text-cyan-300"><Megaphone size={21} /></div><div><p className="font-semibold text-white">New announcement</p><p className="text-xs text-slate-500">Visible for 48 hours · up to 3 images · phone push included.</p></div></div>
            <form onSubmit={handleAddAnnouncement} className="space-y-3">
              <Input placeholder="Announcement title" value={title} onChange={(event) => setTitle(event.target.value)} required maxLength={120} className="h-11 rounded-xl border-white/10 bg-black/10 px-4 text-white placeholder:text-slate-600" />
              <Textarea placeholder="Write the message drivers should receive..." value={content} onChange={(event) => setContent(event.target.value)} rows={4} required maxLength={5000} className="resize-none rounded-xl border-white/10 bg-black/10 px-4 py-3 text-white placeholder:text-slate-600" />
              <div className="rounded-2xl border border-dashed border-white/10 bg-black/10 p-3">
                <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-semibold text-white">Images</p><p className="mt-0.5 text-[10px] text-slate-600">Optional · {images.length}/3 selected</p></div><Label htmlFor="announcement-images" className="flex h-9 cursor-pointer items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-xs font-medium text-slate-300 hover:bg-white/[0.07]"><ImagePlus size={15} /> {optimizing ? "Optimizing..." : "Add images"}</Label></div>
                <Input id="announcement-images" type="file" accept="image/*" multiple disabled={saving || optimizing || images.length >= 3} onChange={(event) => void selectImages(event)} className="sr-only" />
                {imagePreviews.length > 0 && <div className="mt-3 grid grid-cols-3 gap-2">{imagePreviews.map((preview, index) => <div key={preview} className="relative aspect-square overflow-hidden rounded-xl border border-white/8"><Image src={preview} alt={`Announcement image ${index + 1}`} fill sizes="180px" unoptimized className="object-cover" /><button type="button" onClick={() => setImages((current) => current.filter((_, itemIndex) => itemIndex !== index))} aria-label={`Remove image ${index + 1}`} className="absolute right-1.5 top-1.5 flex size-7 items-center justify-center rounded-full bg-black/70 text-white hover:bg-red-500"><X size={13} /></button></div>)}</div>}
              </div>
              <Button type="submit" disabled={saving || optimizing} className="h-11 w-full rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 font-semibold text-slate-950">{saving ? "Publishing..." : <><Send size={17} /> Publish announcement</>}</Button>
            </form>
          </CardContent>
        </Card>
      )}

      <section>
        <div className="mb-3 flex items-center justify-between"><div><h2 className="font-semibold text-white">Team announcements</h2><p className="mt-0.5 text-xs text-slate-500">Each announcement disappears automatically after 48 hours.</p></div><span className="rounded-full border border-white/8 bg-white/[0.03] px-2.5 py-1 text-xs text-slate-500">{announcements.length}</span></div>
        {announcements.length === 0 ? (
          <Card className="border border-white/8 bg-white/[0.03] py-0"><CardContent className="py-16 text-center"><Bell className="mx-auto mb-3 text-slate-700" size={38} /><p className="text-sm text-slate-500">No active announcements.</p></CardContent></Card>
        ) : (
          <div className="space-y-3">
            {announcements.map((announcement) => (
              <Card key={announcement.id} className="overflow-hidden border border-white/8 bg-white/[0.03] py-0">
                {announcement.images.length > 0 && <div className={`grid gap-0.5 bg-black/20 ${announcement.images.length === 1 ? "grid-cols-1" : announcement.images.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}>{announcement.images.map((image) => image.signedUrl && <button key={image.id} type="button" onClick={() => setSelectedImage(image.signedUrl)} className="relative aspect-video min-h-32 overflow-hidden"><Image src={image.signedUrl} alt={announcement.title} fill sizes="(max-width: 640px) 100vw, 600px" unoptimized className="object-cover transition hover:scale-[1.02]" /></button>)}</div>}
                <CardContent className="p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-4"><div className="min-w-0 flex-1"><h3 className="text-base font-semibold text-white">{announcement.title}</h3><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-300">{announcement.content}</p></div>{isAdmin && <Button type="button" variant="ghost" size="icon" onClick={() => void handleDeleteAnnouncement(announcement.id)} aria-label="Delete announcement" className="shrink-0 rounded-xl text-slate-600 hover:bg-red-400/10 hover:text-red-300"><Trash2 /></Button>}</div>
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-white/7 pt-3 text-[11px] text-slate-600"><span className="flex items-center gap-2"><span className="flex size-6 items-center justify-center rounded-full bg-cyan-300/10 text-[10px] font-semibold text-cyan-300">{announcement.drivers?.full_name?.charAt(0) || "A"}</span>{announcement.drivers?.full_name || "Administrator"}</span><span className="flex items-center gap-2"><time>{new Date(announcement.created_at).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</time><span className="flex items-center gap-1 text-amber-300/65"><Camera size={11} /> expires {new Date(announcement.expires_at).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span></span></div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {selectedImage && <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/90 p-3 backdrop-blur" onClick={() => setSelectedImage(null)}><div className="relative max-h-[94vh] max-w-5xl" onClick={(event) => event.stopPropagation()}><Image src={selectedImage} alt="Announcement" width={1800} height={1400} unoptimized className="max-h-[90vh] w-auto max-w-full rounded-2xl object-contain" /><Button type="button" variant="ghost" size="icon" onClick={() => setSelectedImage(null)} className="absolute right-2 top-2 rounded-full bg-black/65 text-white"><X /></Button></div></div>}
    </AppPage>
  );
}
