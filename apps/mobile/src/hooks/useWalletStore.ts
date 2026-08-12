import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface WalletSession {
  token: string;
  address: `0x${string}`;
  chainId: number;
  issuedAt: string;
  expiresAt: string;
}

export interface LinkedWallet {
  address: `0x${string}`;
  chainId: number;
  label: string;
  addedAt: string;
  lastSignedInAt?: string;
}

/**
 * Public wallet / Passport state.
 *
 * The private key is NOT stored here. Signing material lives in
 * `src/wallet/signer.ts` + SecureStore (see keyStorage). This store only
 * keeps address, connection flags, API session, and linked-wallet metadata
 * in AsyncStorage under `aquarius-wallet-passport`.
 */
interface WalletState {
  address: `0x${string}` | null;
  isConnected: boolean;
  chainId: number | null;
  session: WalletSession | null;
  linkedWallets: LinkedWallet[];

  // Actions
  connect: (address: `0x${string}`, chainId: number) => void;
  setSession: (session: WalletSession | null) => void;
  linkWallet: (wallet: Omit<LinkedWallet, 'addedAt'> & { addedAt?: string }) => void;
  unlinkWallet: (address: `0x${string}`) => void;
  disconnect: () => void;
}

type StoredWalletState = Pick<WalletState, 'session' | 'linkedWallets'>;

const STORAGE_KEY = 'aquarius-wallet-passport';
const EMPTY_STORED_STATE: StoredWalletState = {
  session: null,
  linkedWallets: [],
};

async function readStoredWalletState(): Promise<StoredWalletState> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_STORED_STATE;

    const parsed = JSON.parse(raw) as Partial<StoredWalletState>;
    return {
      session: parsed.session ?? null,
      linkedWallets: parsed.linkedWallets ?? [],
    };
  } catch {
    return EMPTY_STORED_STATE;
  }
}

async function writeStoredWalletState(state: WalletState) {
  try {
    await AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        session: state.session,
        linkedWallets: state.linkedWallets,
      } satisfies StoredWalletState)
    );
  } catch {
    // Storage is best-effort; the in-memory wallet state remains authoritative.
  }
}

export const useWalletStore = create<WalletState>()((set, get) => {
  readStoredWalletState().then((stored) => {
    set(stored);
  });

  const persistCurrentState = () => {
    void writeStoredWalletState(get());
  };

  return {
    address: null,
    isConnected: false,
    chainId: null,
    session: null,
    linkedWallets: [],

    connect: (address, chainId) => {
      set({ address, isConnected: true, chainId });
      persistCurrentState();
    },

    setSession: (session) => {
      set({ session });
      persistCurrentState();
    },

    linkWallet: (wallet) => {
      set((state) => {
        const normalized = wallet.address.toLowerCase();
        const existing = state.linkedWallets.find(
          (linked) => linked.address.toLowerCase() === normalized
        );
        const nextWallet: LinkedWallet = {
          ...wallet,
          addedAt: existing?.addedAt ?? wallet.addedAt ?? new Date().toISOString(),
        };

        return {
          linkedWallets: [
            nextWallet,
            ...state.linkedWallets.filter(
              (linked) => linked.address.toLowerCase() !== normalized
            ),
          ],
        };
      });
      persistCurrentState();
    },

    unlinkWallet: (address) => {
      set((state) => ({
        linkedWallets: state.linkedWallets.filter(
          (linked) => linked.address.toLowerCase() !== address.toLowerCase()
        ),
      }));
      persistCurrentState();
    },

    disconnect: () => {
      set({ address: null, isConnected: false, chainId: null, session: null });
      persistCurrentState();
    },
  };
});
