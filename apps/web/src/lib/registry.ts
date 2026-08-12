/**
 * Client for the community announcement registry (social metadata layer).
 * The chain announces existence; the registry carries visibility, pitch,
 * and seeking-members status. Fails soft — the app works without the API.
 */

export interface CommunityAnnouncement {
  address: string;
  name: string;
  visibility: 'public' | 'unlisted';
  seekingMembers: boolean;
  pitch: string;
  founder: string;
  announcedAt: number;
}

export type Registry = Record<string, CommunityAnnouncement>;

export async function fetchRegistry(): Promise<Registry> {
  try {
    const res = await fetch('/api/communities/registry');
    if (!res.ok) return {};
    const data = (await res.json()) as { registry: Registry };
    return data.registry ?? {};
  } catch {
    return {};
  }
}

export async function announceCommunity(
  ann: Omit<CommunityAnnouncement, 'announcedAt'>
): Promise<boolean> {
  try {
    const res = await fetch('/api/communities/announce', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ann),
    });
    return res.ok;
  } catch {
    return false;
  }
}
