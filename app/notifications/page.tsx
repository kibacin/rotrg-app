"use client";

import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { getCurrentUser } from "../lib/authFunctions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Bell, Send, Trash2, Megaphone } from "lucide-react";

type Announcement = {
  id: number;
  admin_id: string;
  title: string;
  content: string;
  created_at: string;
  drivers?: {
    full_name: string;
  };
};

export default function NotificationsPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchUser = async () => {
      const { user } = await getCurrentUser();
      if (!user) return;
      
      setUserId(user.id);
      
      const { data } = await supabase
        .from("drivers")
        .select("role")
        .eq("id", user.id)
        .single();
      
      setIsAdmin(data?.role === "admin");
    };
    fetchUser();
  }, []);

  useEffect(() => {
    const fetchAnnouncements = async () => {
      setLoading(true);
      
      const { data, error } = await supabase
        .from("announcements")
        .select(`
          *,
          drivers (full_name)
        `)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Greška:", error);
      } else {
        setAnnouncements(data || []);
      }
      setLoading(false);
    };

    fetchAnnouncements();
  }, []);

  const handleAddAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !title || !content) return;

    setSaving(true);
    try {
      const { error } = await supabase.from("announcements").insert({
        admin_id: userId,
        title,
        content,
      });

      if (error) throw error;

      const { data } = await supabase
        .from("announcements")
        .select(`
          *,
          drivers (full_name)
        `)
        .order("created_at", { ascending: false });

      if (data) setAnnouncements(data);
      
      setTitle("");
      setContent("");
      alert("✅ Obaveštenje je dodato!");

    } catch (error: any) {
      alert("Greška: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAnnouncement = async (id: number) => {
    if (!confirm("Da li sigurno želiš da obrišeš ovo obaveštenje?")) return;

    try {
      const { error } = await supabase
        .from("announcements")
        .delete()
        .eq("id", id);

      if (error) throw error;

      setAnnouncements(announcements.filter(a => a.id !== id));
    } catch (error: any) {
      alert("Greška: " + error.message);
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("sr-RS", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] p-4 text-center text-slate-400">
        <span className="inline-block animate-spin mr-2">⏳</span> Učitavanje obaveštenja...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] p-4 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Bell className="text-blue-500" size={28} />
          Obaveštenja
        </h1>
        <p className="text-slate-400 text-sm">Važne poruke od admina</p>
      </div>

      {isAdmin && (
        <Card className="border-0 bg-[#12121a]/90 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-white text-lg flex items-center gap-2">
              <Megaphone size={20} className="text-blue-500" />
              Dodaj obaveštenje
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddAnnouncement} className="space-y-3">
              <Input
                placeholder="Naslov"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="bg-[#1a1a24]/80 border-slate-700/50 text-white placeholder:text-slate-500 focus:ring-blue-600 focus:border-blue-600"
              />
              <Textarea
                placeholder="Tekst obaveštenja..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={3}
                required
                className="bg-[#1a1a24]/80 border-slate-700/50 text-white placeholder:text-slate-500 focus:ring-blue-600 focus:border-blue-600 resize-none"
              />
              <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white transition-all shadow-lg shadow-blue-600/20" disabled={saving}>
                {saving ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Slanje...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Send size={18} />
                    Objavi obaveštenje
                  </span>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {announcements.length === 0 ? (
          <Card className="border-0 bg-[#12121a]/90 backdrop-blur-xl">
            <CardContent className="py-12 text-center text-slate-400">
              <Bell className="mx-auto mb-3 text-slate-600" size={48} />
              <p>Nema obaveštenja</p>
            </CardContent>
          </Card>
        ) : (
          announcements.map((announcement) => (
            <Card key={announcement.id} className="border-0 bg-[#12121a]/90 backdrop-blur-xl">
              <CardHeader className="py-3">
                <div className="flex justify-between items-start">
                  <CardTitle className="text-white text-lg">{announcement.title}</CardTitle>
                  {isAdmin && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteAnnouncement(announcement.id)}
                      className="text-slate-500 hover:text-red-400 hover:bg-red-500/10"
                    >
                      <Trash2 size={16} />
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-slate-300 whitespace-pre-wrap">{announcement.content}</p>
                <div className="mt-3 flex justify-between items-center text-xs text-slate-500 border-t border-slate-800 pt-3">
                  <span className="flex items-center gap-1">
                    <span className="w-5 h-5 rounded-full bg-blue-600/20 text-blue-400 flex items-center justify-center text-[10px]">
                      {announcement.drivers?.full_name?.charAt(0) || "A"}
                    </span>
                    {announcement.drivers?.full_name || "Nepoznati admin"}
                  </span>
                  <span>{formatDate(announcement.created_at)}</span>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}