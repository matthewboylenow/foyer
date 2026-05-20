'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Copy, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import type { Display } from '@/lib/db/schema';

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).then(
    () => toast.success('URL copied'),
    () => toast.error('Could not copy'),
  );
}

const BASE_URL =
  typeof window !== 'undefined'
    ? window.location.origin
    : process.env.NEXT_PUBLIC_APP_URL ?? '';

interface DisplayManagerProps {
  displays: Display[];
}

export function DisplayManager({ displays: initial }: DisplayManagerProps) {
  const [displays, setDisplays] = useState(initial);
  const [newName, setNewName] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [adding, setAdding] = useState(false);
  const [showForm, setShowForm] = useState(false);

  async function addDisplay() {
    if (!newName.trim()) return;
    setAdding(true);
    try {
      const res = await fetch('/api/displays', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName, location: newLocation }),
      });
      if (!res.ok) throw new Error('Failed');
      const created: Display = await res.json();
      setDisplays((prev) => [...prev, created]);
      setNewName('');
      setNewLocation('');
      setShowForm(false);
      toast.success('Display added');
    } catch {
      toast.error("Couldn't add display");
    } finally {
      setAdding(false);
    }
  }

  async function toggleActive(id: string, current: boolean) {
    setDisplays((prev) => prev.map((d) => (d.id === id ? { ...d, active: !current } : d)));
    try {
      await fetch(`/api/displays/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !current }),
      });
    } catch {
      setDisplays((prev) => prev.map((d) => (d.id === id ? { ...d, active: current } : d)));
      toast.error("Couldn't update display");
    }
  }

  async function deleteDisplay(id: string) {
    if (!confirm('Delete this display? OptiSigns will need to be reconfigured.')) return;
    try {
      await fetch(`/api/displays/${id}`, { method: 'DELETE' });
      setDisplays((prev) => prev.filter((d) => d.id !== id));
      toast.success('Display deleted');
    } catch {
      toast.error("Couldn't delete display");
    }
  }

  return (
    <div className="space-y-4">
      {displays.map((d) => {
        const url = `${BASE_URL}/display/${d.id}`;
        return (
          <div key={d.id} className="border border-border rounded-lg p-4 bg-white">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-navy">{d.name}</p>
                {d.location && <p className="text-sm text-muted-foreground">{d.location}</p>}
                <div className="flex items-center gap-2 mt-2">
                  <code className="text-xs bg-muted px-2 py-1 rounded truncate flex-1">{url}</code>
                  <button
                    onClick={() => copyToClipboard(url)}
                    className="p-1.5 hover:bg-muted rounded"
                    title="Copy URL"
                  >
                    <Copy size={14} />
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <Switch checked={d.active} onCheckedChange={() => toggleActive(d.id, d.active)} />
                <button
                  onClick={() => deleteDisplay(d.id)}
                  className="p-1.5 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          </div>
        );
      })}

      {showForm ? (
        <div className="border border-border rounded-lg p-4 bg-muted/30 space-y-3">
          <h3 className="font-medium text-sm">Add display</h3>
          <Input
            placeholder="Name (e.g. Lobby)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addDisplay()}
          />
          <Input
            placeholder="Location (optional)"
            value={newLocation}
            onChange={(e) => setNewLocation(e.target.value)}
          />
          <div className="flex gap-2">
            <Button onClick={addDisplay} disabled={adding} className="bg-rust text-cream">
              {adding ? 'Adding…' : 'Add'}
            </Button>
            <Button variant="ghost" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" onClick={() => setShowForm(true)} className="gap-2">
          <Plus size={16} />
          Add display
        </Button>
      )}
    </div>
  );
}
