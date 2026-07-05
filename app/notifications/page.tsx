"use client";

import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { getCurrentUser } from "../lib/authFunctions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

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

  // Učitaj korisnika i proveri da li je admin
  useEffect(() => {
    const fetchUser = async () => {
      const { user } = await getCurrentUser();
      if (!user) return;
      
      setUserId(user.id);
      
      // Proveri da li je admin
      const { data } = await supabase
        .from("drivers")
        .select("role")
        .eq("id", user.id)
        .single();
      
      setIsAdmin(data?.role === "admin");
    };
    fetchUser();
  }, []);

  // Učitaj obaveštenja
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

  // Dodaj novo obaveštenje (samo admin)
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

      // Osveži listu
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

  // Obriši obaveštenje (samo admin)
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

  // Formatiraj datum
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
    return <div className="p-4 text-center">⏳ Učitavanje...</div>;
  }

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-2xl font-bold">📢 Obaveštenja</h1>

      {/* Forma za dodavanje (samo admin) */}
      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">➕ Dodaj obaveštenje</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddAnnouncement} className="space-y-3">
              <Input
                placeholder="Naslov"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
              <Textarea
                placeholder="Tekst obaveštenja..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={3}
                required
              />
              <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700" disabled={saving}>
                {saving ? "⏳ Slanje..." : "📤 Objavi obaveštenje"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Lista obaveštenja */}
      <div className="space-y-3">
        {announcements.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-gray-500">
              <p>📭 Nema obaveštenja</p>
            </CardContent>
          </Card>
        ) : (
          announcements.map((announcement) => (
            <Card key={announcement.id}>
              <CardHeader className="py-3">
                <div className="flex justify-between items-start">
                  <CardTitle className="text-lg">{announcement.title}</CardTitle>
                  {isAdmin && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDeleteAnnouncement(announcement.id)}
                    >
                      🗑️
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-gray-700 whitespace-pre-wrap">{announcement.content}</p>
                <div className="mt-2 flex justify-between text-xs text-gray-400">
                  <span>
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