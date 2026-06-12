import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { publicClient } from '../lib/clients';
import { contracts } from '../lib/chains';
import { communityFactoryAbi } from '../lib/abis';
import { fetchRegistry } from '../lib/registry';
import { useChainBus } from '../state/chainBus';
import { useBlueStore } from '../state/blueStore';
import { useWalletStore } from '../state/walletStore';

/**
 * Network watcher — how everyone "sees" a community get founded.
 *
 * Every device polls the CommunityFactory for CommunityDeployed events.
 * When a new world lands on-chain:
 *   1. the chain bus version bumps (open explorers refetch and re-render)
 *   2. the announcement registry is consulted for visibility + pitch
 *   3. if it's public (and founded by someone else), Blue announces it
 *      with a "Visit" chip — the network notices in near-real-time.
 *
 * Polling rides the same RPC the rest of the app uses, so it works on
 * localhost, adb-reverse tunnels, and LAN IPs alike.
 */
export function useCommunityWatcher() {
  const navigate = useNavigate();
  const bus = useChainBus();
  const blue = useBlueStore();
  const myAddress = useWalletStore((s) => s.address);
  const started = useRef(false);

  useEffect(() => {
    if (started.current || !contracts?.communityFactory) return;
    started.current = true;

    // initial registry load
    fetchRegistry().then(bus.setRegistry);

    const unwatch = publicClient.watchContractEvent({
      address: contracts.communityFactory,
      abi: communityFactoryAbi,
      eventName: 'CommunityDeployed',
      pollingInterval: 3_000,
      onLogs: async (logs) => {
        // something new on-chain → refresh registry + signal data hooks
        const registry = await fetchRegistry();
        bus.setRegistry(registry);
        bus.bump();

        for (const log of logs) {
          const args = log.args as {
            communityAddress?: `0x${string}`;
            name?: string;
            founders?: readonly `0x${string}`[];
          };
          const addr = args.communityAddress?.toLowerCase();
          const name = args.name ?? 'Unnamed';
          if (!addr) continue;

          const founders = (args.founders ?? []).map((f) => f.toLowerCase());
          const mine = myAddress && founders.includes(myAddress.toLowerCase());
          if (mine) continue; // founder gets the Success ceremony instead

          const ann = registry[addr];
          if (ann && ann.visibility === 'unlisted') continue; // quiet founding

          const pitch = ann?.pitch ? ` Their pitch: “${ann.pitch}”` : '';
          const seeking = ann?.seekingMembers
            ? ' They are seeking members.'
            : '';
          blue.interrupt(
            `📡 A new world just appeared on the network: ${name.toUpperCase()}.${seeking}${pitch}`,
            {
              chips: [
                {
                  label: `Visit ${name}`,
                  action: `visit:${addr}`,
                },
                { label: 'Explore all', action: 'go-explorer' },
              ],
            }
          );
        }
      },
    });

    return () => {
      unwatch();
      started.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myAddress]);

  // expose nothing — this is a background sense organ
  void navigate;
}
