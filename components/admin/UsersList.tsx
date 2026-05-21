'use client';

import { useState } from 'react';
import { TimeAgo } from './TimeAgo';
import { Trash2, ShieldCheck, User as UserIcon, Plus } from 'lucide-react';
import { toast } from '@/lib/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface Row {
  id: string;
  email: string;
  role: string;
  addedBy: string | null;
  createdAt: string;
}

interface Props {
  users: Row[];
  allowedDomain: string | null;
}

export function UsersList({ users: initial, allowedDomain }: Props) {
  const [users, setUsers] = useState(initial);
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<'editor' | 'owner'>('editor');
  const [inviting, setInviting] = useState(false);

  async function invite() {
    const e = newEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
      toast.error('That email looks invalid');
      return;
    }
    setInviting(true);
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: e, role: newRole }),
      });
      if (!res.ok) throw new Error(await res.text());
      const created: Row = await res.json();
      // Avoid duplicate if the user was already in the list.
      setUsers((prev) => (prev.find((u) => u.id === created.id) ? prev : [...prev, created]));
      setNewEmail('');
      setNewRole('editor');
      toast.success(`${e} invited`);
    } catch (err) {
      toast.error(`Couldn't invite: ${err instanceof Error ? err.message : 'unknown'}`);
    } finally {
      setInviting(false);
    }
  }

  async function setRole(id: string, role: 'owner' | 'editor') {
    const prev = users;
    setUsers((u) => u.map((x) => (x.id === id ? { ...x, role } : x)));
    try {
      const res = await fetch(`/api/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success(`Role updated to ${role}`);
    } catch (err) {
      setUsers(prev);
      toast.error(`Couldn't update: ${err instanceof Error ? err.message : 'unknown'}`);
    }
  }

  async function remove(id: string, email: string) {
    if (!confirm(`Remove ${email}? They'll lose access immediately.`)) return;
    try {
      const res = await fetch(`/api/users/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'Failed' }));
        throw new Error(body.error ?? 'Failed');
      }
      setUsers((prev) => prev.filter((u) => u.id !== id));
      toast.success(`${email} removed`);
    } catch (err) {
      toast.error(`Couldn't remove: ${err instanceof Error ? err.message : 'unknown'}`);
    }
  }

  return (
    <div className="space-y-6">
      {allowedDomain && (
        <div className="rounded-lg border border-navy/10 bg-cream px-4 py-3 text-sm">
          <div className="text-[10px] uppercase tracking-widest text-navy/45 font-medium mb-1">
            Staff domain
          </div>
          <div className="text-navy">
            Anyone with an{' '}
            <code className="font-mono bg-navy/5 px-1.5 py-0.5 rounded text-[12px]">
              @{allowedDomain}
            </code>{' '}
            address can sign in without an invite.
          </div>
        </div>
      )}

      {/* User list */}
      <div className="rounded-xl border border-navy/10 bg-cream overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-navy/[0.03] border-b border-navy/10">
            <tr>
              <th className="px-4 py-2.5 text-left font-medium text-navy/55 uppercase tracking-widest text-[10px]">
                Email
              </th>
              <th className="px-4 py-2.5 text-left font-medium text-navy/55 uppercase tracking-widest text-[10px]">
                Role
              </th>
              <th className="px-4 py-2.5 text-left font-medium text-navy/55 uppercase tracking-widest text-[10px]">
                Added
              </th>
              <th className="w-12 px-4 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-navy/5">
            {users.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-navy/45 italic">
                  No invited users yet.
                </td>
              </tr>
            ) : (
              users.map((u) => {
                const isOwner = u.role === 'owner';
                return (
                  <tr key={u.id} className="hover:bg-navy/[0.02]">
                    <td className="px-4 py-3 text-navy font-medium">{u.email}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setRole(u.id, isOwner ? 'editor' : 'owner')}
                        className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium ${
                          isOwner
                            ? 'bg-gold/15 text-gold hover:bg-gold/25'
                            : 'bg-navy/5 text-navy/70 hover:bg-navy/10'
                        }`}
                        title={`Click to make ${isOwner ? 'editor' : 'owner'}`}
                      >
                        {isOwner ? <ShieldCheck size={12} /> : <UserIcon size={12} />}
                        {u.role}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-navy/55 text-xs">
                      <TimeAgo date={u.createdAt} />
                      {u.addedBy && (
                        <div className="text-navy/40 text-[10px]">by {u.addedBy}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => remove(u.id, u.email)}
                        className="p-1.5 text-navy/40 hover:text-rust rounded-md hover:bg-navy/5"
                        aria-label="Remove"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Invite form */}
      <div className="rounded-xl border border-dashed border-navy/20 bg-cream/50 p-5 space-y-3">
        <div className="text-[10px] uppercase tracking-widest text-navy/45 font-medium">
          Invite someone
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="person@parish.org"
            className="flex-1 min-w-[220px]"
            onKeyDown={(e) => e.key === 'Enter' && invite()}
            type="email"
            spellCheck={false}
          />
          <select
            value={newRole}
            onChange={(e) => setNewRole(e.target.value as 'owner' | 'editor')}
            className="h-9 rounded-md border border-navy/15 bg-cream px-3 py-1 text-sm"
          >
            <option value="editor">Editor</option>
            <option value="owner">Owner</option>
          </select>
          <Button
            onClick={invite}
            disabled={inviting || !newEmail.trim()}
            className="bg-rust hover:bg-rust-700 text-cream gap-1.5"
          >
            <Plus size={14} />
            {inviting ? 'Inviting…' : 'Invite'}
          </Button>
        </div>
        <p className="text-xs text-navy/55">
          Owners can manage users; editors can edit slides and settings but not the user list.
        </p>
      </div>
    </div>
  );
}
