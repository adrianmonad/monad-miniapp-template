import { useMiniAppContext } from "@/hooks/use-miniapp-context";
import { parseEther } from "viem";
import { monadTestnet } from "viem/chains";
import {
  useAccount,
  useConnect,
  useDisconnect,
  useSendTransaction,
  useSwitchChain,
} from "wagmi";
import { farcasterFrame } from "@farcaster/frame-wagmi-connector";

export function WalletActions() {
  const { isEthProviderAvailable } = useMiniAppContext();
  const { isConnected, address, chainId } = useAccount();
  const { disconnect } = useDisconnect();
  const { data: hash, sendTransaction } = useSendTransaction();
  const { switchChain } = useSwitchChain();
  const { connect } = useConnect();

  async function sendTransactionHandler() {
    sendTransaction({
      to: "0x7f748f154B6D180D35fA12460C7E4C631e28A9d7",
      value: parseEther("1"),
    });
  }

  return (
    <div className="w-full max-w-md mx-auto p-4 bg-[var(--ro-panel-bg)] rounded-lg shadow-lg border-2 border-[var(--ro-gold)] font-pixel text-[var(--ro-gold)]">
      <h2 className="text-lg font-pixel mb-4 text-center text-[var(--ro-gold)]">WALLET STATUS</h2>
      <div className="flex flex-col gap-3 items-center">
        {isConnected ? (
          <>
            <div className="w-full flex flex-col gap-2 items-center">
              <div className="w-full flex flex-row justify-between items-center">
                <span className="text-xs text-[var(--ro-gold)]">Wallet:</span>
                <span className="font-mono text-xs text-[var(--ro-gold)]">{address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "-"}</span>
              </div>
              <div className="w-full flex flex-row justify-between items-center">
                <span className="text-xs text-[var(--ro-gold)]">Chain ID:</span>
                <span className="font-mono text-xs text-[var(--ro-gold)]">{chainId || "-"}</span>
              </div>
            </div>
            <button
              className="w-full mt-4 py-2 rounded bg-red-700 hover:bg-red-600 text-white font-pixel border-2 border-red-900 shadow-md transition-all"
              onClick={() => disconnect()}
            >
              Disconnect Wallet
            </button>
          </>
        ) : (
          isEthProviderAvailable ? (
            <button
              className="game-button w-full py-2 text-sm"
              onClick={() => connect({ connector: farcasterFrame() })}
            >
              Connect Wallet
            </button>
          ) : (
            <p className="text-sm text-center text-[var(--ro-gold)] py-2 border border-[var(--ro-gold)]/30 rounded-lg bg-[var(--ro-panel-dark)] p-3 shadow-inner">
              Wallet connection only via Warpcast
            </p>
          )
        )}
      </div>
    </div>
  );
}
