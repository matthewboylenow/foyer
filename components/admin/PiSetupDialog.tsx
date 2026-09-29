'use client';

import { useMemo, useState } from 'react';
import { Copy, Check } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

interface PiSetupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  display: { id: string; name: string; orientation: string };
  baseUrl: string;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24);
}

/**
 * The one-command Raspberry Pi setup. Everything the installer needs is in
 * the command itself (URL, display id, rotation, hostname), so the person at
 * the TV only has to paste it.
 */
export function PiSetupDialog({ open, onOpenChange, display, baseUrl }: PiSetupDialogProps) {
  const [rotate, setRotate] = useState(display.orientation === 'landscape' ? '0' : '90');
  const [hostname, setHostname] = useState(`foyer-${slugify(display.name) || 'screen'}`);
  const [copied, setCopied] = useState(false);

  const command = useMemo(() => {
    const parts = [
      `curl -fsSL ${baseUrl}/pi/install.sh | sudo bash -s --`,
      `--url ${baseUrl}`,
      `--display ${display.id}`,
      `--rotate ${rotate}`,
    ];
    if (hostname.trim()) parts.push(`--hostname ${slugify(hostname)}`);
    parts.push('--reboot');
    return parts.join(' \\\n  ');
  }, [baseUrl, display.id, rotate, hostname]);

  function copy() {
    navigator.clipboard.writeText(command.replace(/ \\\n\s+/g, ' ')).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl bg-cream">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl text-navy">
            Set up a Raspberry Pi for “{display.name}”
          </DialogTitle>
          <DialogDescription className="text-navy/60">
            A Pi 4 or Pi 5 with the official power supply, a case with a fan, and a
            micro-HDMI cable. About $100, nothing monthly. The Pi replaces OptiSigns for
            this screen; the other screens are not affected.
          </DialogDescription>
        </DialogHeader>

        <ol className="space-y-4 text-sm text-navy/80 list-decimal pl-5">
          <li>
            <span className="font-medium text-navy">Flash the card.</span> In Raspberry Pi
            Imager choose <em>Raspberry Pi OS (64-bit)</em> with desktop. In the settings
            gear set a username and password, the parish Wi-Fi, and turn on SSH.
          </li>
          <li>
            <span className="font-medium text-navy">Plug it into the TV and boot.</span>{' '}
            Open a terminal on the Pi, or SSH in from your laptop.
          </li>
          <li>
            <span className="font-medium text-navy">Paste this command.</span> It installs
            Chromium in kiosk mode, rotates the screen, turns off blanking, installs the
            agent, and reboots.
            <div className="mt-2 grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Screen rotation</Label>
                <select
                  value={rotate}
                  onChange={(e) => setRotate(e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                >
                  <option value="90">90° — TV rotated clockwise (portrait)</option>
                  <option value="270">270° — TV rotated counter-clockwise (portrait)</option>
                  <option value="0">0° — landscape</option>
                  <option value="180">180° — upside down</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Pi hostname</Label>
                <Input value={hostname} onChange={(e) => setHostname(e.target.value)} />
              </div>
            </div>
            <div className="relative mt-3">
              <pre className="bg-navy-900 text-cream/90 text-xs rounded-lg p-3 pr-12 overflow-x-auto whitespace-pre font-mono leading-relaxed">
                {command}
              </pre>
              <button
                type="button"
                onClick={copy}
                className="absolute top-2 right-2 p-1.5 rounded-md bg-cream/10 hover:bg-cream/20 text-cream"
                title="Copy command"
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
              </button>
            </div>
          </li>
          <li>
            <span className="font-medium text-navy">Wait for the reboot.</span> Within a
            minute this card shows a Raspberry Pi badge, the Pi&apos;s temperature and IP,
            and the Reboot and Screenshot buttons light up. If the picture is rotated the
            wrong way, re-run the command with the other rotation.
          </li>
        </ol>

        <p className="text-xs text-navy/50">
          Logs on the Pi: <code className="font-mono">/tmp/foyer-kiosk.log</code> and{' '}
          <code className="font-mono">journalctl -u foyer-agent</code>. The installer is safe
          to run again.
        </p>
      </DialogContent>
    </Dialog>
  );
}
