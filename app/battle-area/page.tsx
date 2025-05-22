"use client";

import { usePrivy, useLogin, useLogout, useWallets } from '@privy-io/react-auth';
import { useState, useEffect, useRef } from 'react';
import { formatEther, parseEther, Hex, createWalletClient, custom, parseGwei } from 'viem';
import { monadTestnet } from 'viem/chains';
import { publicClient } from '../../utils/publicClient';
import { useMiniAppContext } from '../../hooks/use-miniapp-context';
import BattleSystem from '@/components/Game/BattleSystem';
import sdk from '@farcaster/frame-sdk';
import { useInventory } from '@/lib/InventoryContext';
import { useAccount } from 'wagmi';

// Enhanced mobile detection with extra checks
const detectMobile = () => {
  // First check user agent for common mobile patterns
  const userAgentCheck = typeof window !== 'undefined' && 
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  
  // Then check screen size as a fallback
  const screenSizeCheck = typeof window !== 'undefined' && window.innerWidth <= 768;
  
  // Check if we're in a Farcaster frame
  const inFarcasterApp = typeof window !== 'undefined' && 
    (window.location.href.includes('farcaster') || 
     window.navigator.userAgent.includes('Farcaster') ||
     sessionStorage.getItem('forceFarcasterMode') === 'true');
  
  return userAgentCheck || screenSizeCheck || inFarcasterApp;
};

// Use the enhanced detection
const isMobile = detectMobile();

// Helper functions from useMagicEdenInventory
// Get elemental name based on token ID range
const getElementalName = (tokenId: number): string => {
  if (tokenId >= 1 && tokenId <= 3250) return "Rhoxodon";
  if (tokenId >= 3251 && tokenId <= 6499) return "Nactivyx";
  if (tokenId >= 6500 && tokenId <= 7999) return "Infermor";
  if (tokenId >= 8000 && tokenId <= 9499) return "Emberith";
  if (tokenId >= 9500 && tokenId <= 10000) return "Nyxar";
  return "Unknown Elemental"; // Fallback
};

// Get elemental type based on token ID for image mapping
const getElementalType = (tokenId: number): string => {
  // Simple deterministic mapping based on token ID
  if (tokenId >= 1 && tokenId <= 3250) return "earth"; // Rhoxodon - earth
  if (tokenId >= 3251 && tokenId <= 6499) return "water"; // Nactivyx - water
  if (tokenId >= 6500 && tokenId <= 7999) return "fire"; // Infermor - fire
  if (tokenId >= 8000 && tokenId <= 9499) return "fire"; // Emberith - fire (different variant)
  if (tokenId >= 9500 && tokenId <= 10000) return "air"; // Nyxar - air
  return "fire"; // Default fallback
};

// Get rarity based on token ID range
const getRarity = (tokenId: number): string => {
  if (tokenId >= 1 && tokenId <= 3250) return "Uncommon";   // Rhoxodon - Uncommon
  if (tokenId >= 3251 && tokenId <= 6499) return "Common";   // Nactivyx - Common
  if (tokenId >= 6500 && tokenId <= 7999) return "Epic";     // Infermor - Epic
  if (tokenId >= 8000 && tokenId <= 9499) return "Legendary"; // Emberith - Legendary
  if (tokenId >= 9500 && tokenId <= 10000) return "Ultra Rare"; // Nyxar - Ultra Rare
  return "Unknown"; // Fallback
};

// Get image URL based on elemental name
const getElementalImage = (name: string): string => {
  switch (name) {
    case 'Rhoxodon':
      return '/assets/Rhoxodon.gif';
    case 'Nactivyx':
      return '/assets/Nactivyx.gif';
    case 'Infermor':
      return '/assets/Infermor.gif';
    case 'Emberith':
      return '/assets/Emberith.gif';
    case 'Nyxar':
      return '/assets/Nyxar.gif';
    default:
      return '/assets/Emberith.gif'; // Default fallback
  }
};

export default function BattleAreaPage() {
  console.log("BattleAreaPage rendering, isMobile:", isMobile);
  
  // Privy hooks
  const { user, authenticated, ready } = usePrivy();
  const { ready: walletsReady, wallets } = useWallets();
  const { login } = useLogin();
  const { logout } = useLogout();
  
  // Farcaster context (for mobile)
  const farcasterContext = useMiniAppContext();

  // Get the main wallet address from wagmi
  const { address: mainWalletAddress } = useAccount();

  // UI state
  const [balance, setBalance] = useState<string | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [embeddedWalletAddress, setEmbeddedWalletAddress] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [txHash, setTxHash] = useState("");
  
  // Environment state
  const [useFarcaster, setUseFarcaster] = useState(false);
  const [isWalletInitialized, setIsWalletInitialized] = useState(true);
  const [authStatusMessage, setAuthStatusMessage] = useState<string>("Ready to battle!");
  
  // Wallet refs
  const walletClient = useRef<any>(null);
  const userNonce = useRef<number>(0);
  const userBalance = useRef<bigint>(BigInt(0));

  // Get user inventory from the shared context
  const { inventory, isLoading: isInventoryLoading, refreshInventory, globalInventory, setMainWalletAddress, setTestInventory } = useInventory();
  
  // Direct NFT fetching for battle area
  const [directInventory, setDirectInventory] = useState<any[]>([]);
  const [isDirectFetching, setIsDirectFetching] = useState<boolean>(false);
  
  // Directly fetch NFTs from the API
  const fetchDirectNFTs = async (walletAddress: string) => {
    if (!walletAddress) return;
    
    // IMPORTANT: For testing, we can force a specific wallet address
    // This ensures we always use the main wallet that owns the NFTs
    const MAIN_WALLET = "0x51F5c253BFFd38EAb69450C7Cad623a28b82A4E4";
    const addressToUse = MAIN_WALLET; // Always use the main wallet address
    
    setIsDirectFetching(true);
    try {
      console.log(`Battle area: Directly fetching NFTs for main wallet ${addressToUse}`);
      const response = await fetch('/api/getMagicEdenTokens', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store',
          'Pragma': 'no-cache'
        },
        body: JSON.stringify({ 
          walletAddress: addressToUse,
          timestamp: Date.now()
        }),
      });
      
      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }
      
      const data = await response.json();
      const tokenIds = data.tokens || [];
      
      console.log(`Battle area: Found ${tokenIds.length} tokens from API`);
      
      if (tokenIds.length > 0) {
        // Convert token IDs to inventory items
        const items = tokenIds.map((tokenId: number) => {
          const name = getElementalName(tokenId);
          const elementType = getElementalType(tokenId);
          const rarity = getRarity(tokenId);
          
          return {
            id: tokenId.toString(),
            tokenId: tokenId.toString(),
            name,
            image: getElementalImage(name),
            description: `A ${rarity.toLowerCase()} elemental with unique abilities.`,
            rarity,
            collectionName: 'Elementals Adventure',
            elementType
          };
        });
        
        console.log(`Battle area: Created ${items.length} inventory items`);
        console.log("First few items:", items.slice(0, 3));
        
        setDirectInventory(items);
        
        // Also update the global inventory in the context
        setTestInventory(items);
      } else {
        console.log("No tokens found, setting empty inventory");
        setDirectInventory([]);
      }
    } catch (error) {
      console.error("Error fetching NFTs directly:", error);
    } finally {
      setIsDirectFetching(false);
    }
  };

  // Fetch wallet balance
  const fetchWalletBalance = async (walletAddress: string) => {
    if (!walletAddress) {
      console.log("Can't fetch balance - no wallet address");
      return;
    }
    
    console.log("Fetching balance for wallet:", walletAddress);
    try {
      const balance = await publicClient.getBalance({ 
        address: walletAddress as Hex 
      });
      userBalance.current = balance;
      const formattedBalance = formatEther(balance);
      setBalance(`${formattedBalance} MONAD`);
      console.log(`Fetched balance for ${walletAddress}: ${formattedBalance}`);
    } catch (error) {
      console.error("Failed to fetch balance:", error);
    }
  };

  // Debug Effect: Log important state for debugging
  useEffect(() => {
    console.log("AUTH DEBUG", { 
      ready, 
      authenticated, 
      hasUser: !!user,
      userDetails: user ? {
        id: user.id,
        hasLinkedAccounts: user.linkedAccounts?.length > 0,
        accountTypes: user.linkedAccounts?.map(a => a.type),
        hasEmbeddedWallet: !!user.wallet
      } : null,
      walletsReady,
      walletsAvailable: wallets?.length,
      walletTypes: wallets?.map(w => w.walletClientType)
    });
    
    if (user && user.linkedAccounts?.length > 0) {
      const walletAccounts = user.linkedAccounts.filter(a => a.type === 'wallet');
      console.log("Wallet accounts in user:", walletAccounts);
    }
  }, [ready, authenticated, user, walletsReady, wallets]);

  // Log inventory when it changes
  useEffect(() => {
    console.log("BattleArea: Using shared inventory:", {
      inventoryLoaded: !isInventoryLoading,
      inventoryCount: inventory?.length || 0,
      globalInventoryCount: globalInventory?.length || 0,
      firstFewItems: inventory?.slice(0, 3) || []
    });
  }, [inventory, isInventoryLoading, globalInventory]);

  // We no longer need to update the inventory context with embedded wallet address
  // as we'll use the global inventory that's already loaded in the main game
  useEffect(() => {
    // Simple approach - just refresh the inventory once when the component loads
    console.log("Battle area loaded - refreshing inventory data");
    refreshInventory();
    
    // We don't need to set the main wallet address anymore as we're using
    // the address from useAccount() directly in the context
    
    // Log the inventory data for debugging
    console.log("Current inventory items:", inventory.length);
  }, [refreshInventory, inventory.length]);

  // Effect to fetch NFTs directly from the API
  useEffect(() => {
    // Always fetch using the direct fetch method
    // This will use the hardcoded main wallet address
    console.log("Fetching NFTs directly on component mount");
    fetchDirectNFTs("any-address-will-work"); // The address gets replaced with the main wallet in the function
  }, []);

  // Set Farcaster flag (mobile vs desktop)
  useEffect(() => {
    // We'll use the same wallet setup logic regardless of device type
    // This ensures desktop and mobile work exactly the same
    console.log("Device detection:", isMobile ? "Mobile" : "Desktop");
    // Still set the Farcaster flag for UI consistency
    setUseFarcaster(isMobile);
  }, []);

  // Login Effect: Ensure user is logged in
  useEffect(() => {
    if (ready && !authenticated) {
      setAuthStatusMessage("Please login to continue");
      console.log("User not authenticated, ready to login");
    } else if (ready && authenticated) {
      setAuthStatusMessage("Authenticated, loading wallet...");
      console.log("User authenticated, checking for wallet now");
    }
  }, [ready, authenticated]);

  // Extract embedded wallet - use the same approach for both desktop and mobile
  useEffect(() => {
    console.log("Checking for embedded wallet, user exists:", !!user);
    
    if (!user) {
      setEmbeddedWalletAddress("");
      setAuthStatusMessage("No user found");
      return;
    }
    
    // Add a small delay to allow Privy to fully initialize the embedded wallet
    const extractWalletWithDelay = setTimeout(() => {
      try {
        // First check if user.wallet is defined
        if (user.wallet?.address) {
          console.log("Found wallet in user.wallet:", user.wallet.address);
          setEmbeddedWalletAddress(user.wallet.address);
          fetchWalletBalance(user.wallet.address);
          setAuthStatusMessage("Using wallet from user.wallet");
          return;
        }
        
        // If not, try linkedAccounts
        const privyWallets = user.linkedAccounts.filter(
          (account) =>
            account.type === "wallet" &&
            account.walletClientType === "privy"
        );
        
        console.log("Found wallets in linkedAccounts:", privyWallets.length);
        
        if (privyWallets.length > 0 && (privyWallets[0] as any).address) {
          const walletAddress = (privyWallets[0] as any).address;
          console.log("Using wallet from linkedAccounts:", walletAddress);
          setEmbeddedWalletAddress(walletAddress);
          fetchWalletBalance(walletAddress);
          setAuthStatusMessage("Using wallet from linkedAccounts");
        } else {
          // As a fallback, check the wallets array directly
          if (walletsReady && wallets && wallets.length > 0) {
            const privyWallet = wallets.find(w => w.walletClientType === 'privy');
            if (privyWallet) {
              console.log("Found wallet in wallets array:", privyWallet.address);
              setEmbeddedWalletAddress(privyWallet.address);
              fetchWalletBalance(privyWallet.address);
              setAuthStatusMessage("Using wallet from wallets array");
            }
            
            // If no Privy wallet found, try to use any wallet as a fallback
            if (wallets[0]) {
              console.log("No Privy wallet found, using fallback wallet:", wallets[0].address);
              setEmbeddedWalletAddress(wallets[0].address);
              fetchWalletBalance(wallets[0].address);
              setAuthStatusMessage("Using fallback wallet");
            }
          }
          
          setEmbeddedWalletAddress("");
          setAuthStatusMessage("No wallet found in user accounts. Please try refreshing the page.");
        }
      } catch (err) {
        console.error("Error extracting Privy wallet:", err);
        setEmbeddedWalletAddress("");
        setAuthStatusMessage(`Error: ${err instanceof Error ? err.message : 'Unknown wallet error'}`);
      }
    }, 1500); // 1.5 second delay to allow Privy to fully initialize
    
    // Cleanup function to cancel the timeout if the component unmounts
    return () => clearTimeout(extractWalletWithDelay);
  }, [user, wallets, walletsReady]);
  
  // Setup wallet client from wallets array - use same approach for both platforms
  useEffect(() => {
    console.log("Setup wallet client effect running, wallets ready:", walletsReady, "wallets:", wallets?.length);
    
    if (!walletsReady) {
      console.log("Wallets not ready yet");
      return;
    }
    
    if (!wallets || wallets.length === 0) {
      console.log("No wallets available yet");
      setAuthStatusMessage("No wallets available. Waiting for wallet connection...");
      return;
    }
    
    let retryCount = 0;
    const maxRetries = 3;
    
    async function setupWalletClient() {
      try {
        // First find the embedded Privy wallet
        const availableWallets = wallets.map(w => ({
          type: w.walletClientType,
          address: w.address,
          chain: w.chainId
        }));
        console.log("Available wallets:", JSON.stringify(availableWallets));
        
        // Look for Privy wallet in the wallets array
        const userWallet = wallets.find(w => w.walletClientType === 'privy');
        if (!userWallet) {
          console.log("No Privy wallet found in wallets array");
          setAuthStatusMessage("No Privy wallet found. Trying again...");
          
          // Retry logic for wallet initialization
          if (retryCount < maxRetries) {
            retryCount++;
            console.log(`Retrying wallet setup (${retryCount}/${maxRetries})...`);
            setTimeout(setupWalletClient, 2000);
            return;
          } else {
            setAuthStatusMessage("Could not find Privy wallet after multiple attempts. Please refresh the page.");
            return;
          }
        }
        
        console.log("Setting up wallet for address:", userWallet.address);
        setEmbeddedWalletAddress(userWallet.address);
        
        try {
          // Get the Ethereum provider from the wallet
          const ethereumProvider = await userWallet.getEthereumProvider();
          console.log("Got ethereum provider:", !!ethereumProvider);
          
          if (!ethereumProvider) {
            throw new Error("Ethereum provider is null or undefined");
          }
          
          // Create a wallet client with viem
          const provider = createWalletClient({
            chain: monadTestnet,
            transport: custom(ethereumProvider)
          });
          
          console.log("Wallet client created successfully");
          walletClient.current = provider;
          setIsWalletInitialized(true);
          setAuthStatusMessage("Wallet ready");
          
          // Get initial nonce and balance
          if (userWallet.address) {
            fetchWalletBalance(userWallet.address);
            try {
              userNonce.current = await publicClient.getTransactionCount({ 
                address: userWallet.address as Hex 
              });
              console.log("Got nonce:", userNonce.current);
            } catch (nonceError) {
              console.error("Failed to get nonce:", nonceError);
            }
          }
        } catch (providerError) {
          console.error("Failed to get ethereum provider:", providerError);
          setAuthStatusMessage(`Provider error: ${providerError instanceof Error ? providerError.message : 'Unknown'}`);
          
          // Retry logic for provider initialization
          if (retryCount < maxRetries) {
            retryCount++;
            console.log(`Retrying provider setup (${retryCount}/${maxRetries})...`);
            setTimeout(setupWalletClient, 2000);
          } else {
            setAuthStatusMessage("Could not initialize wallet after multiple attempts. Please refresh the page.");
          }
        }
      } catch (error) {
        console.error("Failed to set up wallet client:", error);
        setIsWalletInitialized(false);
        setAuthStatusMessage(`Setup failed: ${error instanceof Error ? error.message : 'Unknown'}`);
        
        // Retry logic for general setup errors
        if (retryCount < maxRetries) {
          retryCount++;
          console.log(`Retrying after error (${retryCount}/${maxRetries})...`);
          setTimeout(setupWalletClient, 2000);
        }
      }
    }
    
    setupWalletClient();
  }, [walletsReady, wallets]);

  // Fetch real balance
  const getBalance = async () => {
    if (!embeddedWalletAddress) {
      showToastMessage('No wallet address found');
      return;
    }
    
    setIsLoading(true);
    try {
      console.log("Getting balance for:", embeddedWalletAddress);
      // Always fetch real balance from the blockchain
      const balance = await publicClient.getBalance({ 
        address: embeddedWalletAddress as Hex 
      });
      userBalance.current = balance;
      const formattedBalance = formatEther(balance);
      setBalance(`${formattedBalance} MONAD`);
      
      console.log(`Wallet address: ${embeddedWalletAddress}`);
      console.log(`Current balance: ${formattedBalance}`);
      
      showToastMessage('Balance fetched successfully!');
    } catch (error) {
      console.error("Failed to fetch balance:", error);
      showToastMessage('Failed to fetch balance');
    } finally {
      setIsLoading(false);
    }
  };

  // Show toast message
  const showToastMessage = (message: string) => {
    setToastMessage(message);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  // Handle transaction completion
  const handleBattleComplete = (hash: string) => {
    setTxHash(hash);
    // Update balance after transaction
    setTimeout(() => getBalance(), 2000);
  };

  // Handle login button click
  const handleLogin = () => {
    console.log("Login button clicked");
    login();
  };

  // Load balance on mount if we have a wallet address
  useEffect(() => {
    if (authenticated && embeddedWalletAddress) {
      console.log("Loading initial balance for wallet:", embeddedWalletAddress);
      getBalance();
    }
  }, [authenticated, embeddedWalletAddress]);

  // Show loading state if needed
  if (!ready && !useFarcaster) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div>Loading Privy authentication...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center pt-8 pb-16 bg-black text-white">
      <h1 className="text-5xl font-bold mb-4 font-pixel">Battle Arena</h1>
      <p className="text-yellow-400 text-sm mb-6 max-w-lg text-center">
        Choose an Elemental by rarity to battle. You'll have a time window based on your NFTs, but pressing the Attack button completes the battle instantly!
      </p>
      
      {!authenticated ? (
        <div className="flex flex-col items-center bg-gray-900 rounded-lg p-6 shadow-lg max-w-md mx-auto">
          <p className="text-xl font-pixel text-yellow-400 mb-4">Login to Battle</p>
          <p className="text-sm text-gray-300 mb-6 text-center">
            Connect your wallet to access the Battle Arena and fight with your Elementals
          </p>
          <button
            className="ro-button text-lg px-6 py-3 bg-blue-600"
            onClick={handleLogin}
          >
            Connect Wallet
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center w-full">
          {/* Wallet Info Section */}
          <div className="w-full max-w-md mx-auto mb-4 bg-gray-900 rounded-lg p-4">
            <div className="mb-1 text-yellow-500 text-xs font-mono">{authStatusMessage}</div>
            
            {/* Transaction Wallet Display */}
            <div className="flex items-center mb-2">
              <div className="text-green-500 font-mono truncate flex-1">
                Wallet: {embeddedWalletAddress ? embeddedWalletAddress.substring(0, 8) + '...' + embeddedWalletAddress.substring(embeddedWalletAddress.length - 6) : 'Loading wallet...'}
              </div>
              <button 
                className="ml-2 px-2 py-1 bg-gray-700 rounded hover:bg-gray-600 text-xs"
                onClick={() => {
                  if (embeddedWalletAddress) {
                    navigator.clipboard.writeText(embeddedWalletAddress);
                    showToastMessage('Wallet address copied to clipboard!');
                  }
                }}
                title="Copy wallet address"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                </svg>
              </button>
            </div>
            
            {balance && (
              <div className="mb-2 text-yellow-400 font-mono">Balance: {balance}</div>
            )}
            
            <div className="flex justify-between">
              <button 
                className="ro-button-small bg-blue-600 hover:bg-blue-700"
                onClick={getBalance}
                disabled={isLoading}
              >
                Refresh Balance
              </button>
              <button 
                className="ro-button-small bg-green-600 hover:bg-green-700"
                onClick={() => {
                  refreshInventory();
                  showToastMessage('Refreshing inventory...');
                }}
                disabled={isInventoryLoading}
              >
                Refresh Inventory
              </button>
              <button
                className="ro-button-small bg-purple-600 hover:bg-purple-700 ml-1"
                onClick={() => {
                  // Always use the direct fetch method with any address
                  // (it will use the hardcoded main wallet address)
                  fetchDirectNFTs("any-address-will-work");
                  showToastMessage('Refreshing NFT data from main wallet...');
                }}
                disabled={isDirectFetching}
              >
                Force Refresh NFTs
              </button>
              <button 
                className="ro-button-secondary" 
                onClick={logout}
              >
                Logout
              </button>
            </div>
            
            {/* Inventory Loading Notice */}
            <div className="mt-2 text-xs text-yellow-400 bg-gray-800 p-2 rounded text-center">
              Inventory may load slowly. Keep clicking refresh if it doesn't show up yet.
            </div>
          </div>
          
          {/* Transaction Hash Display */}
          {txHash && (
            <div className="w-full max-w-md mx-auto mb-4 bg-green-900 p-3 rounded-md">
              <p className="font-bold text-sm">Transaction sent:</p>
              <p className="text-xs truncate">{txHash}</p>
              <a 
                href={`https://testnet.monadexplorer.com/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 underline text-sm"
              >
                View on Explorer
              </a>
            </div>
          )}
          
          {/* Battle System Component */}
          {isWalletInitialized ? (
            <>
              <BattleSystem
                walletAddress={embeddedWalletAddress}
                walletClient={walletClient.current}
                inventory={directInventory.length > 0 ? directInventory : inventory}
                onShowToast={showToastMessage}
                onBattleComplete={handleBattleComplete}
              />
            </>
          ) : (
            <div className="text-center p-6 bg-gray-900 rounded-lg max-w-md w-full">
              <p className="text-yellow-400 mb-2 font-bold">Wallet Initialization</p>
              <p className="text-sm text-gray-300 mb-3">{authStatusMessage}</p>
              
              <div className="flex flex-col gap-2 mt-4">
                <button 
                  onClick={() => window.location.reload()}
                  className="ro-button-small bg-green-600 hover:bg-green-700"
                >
                  Refresh Page
                </button>
                
                <div className="text-xs text-gray-400 mt-2 mb-2">
                  <p>Trouble with the embedded wallet?</p>
                  <p>You may need to clear your browser cache or try a different browser.</p>
                </div>
                
                <button
                  onClick={() => {
                    setIsWalletInitialized(true);
                    setAuthStatusMessage("Manual wallet mode - Some features may be limited");
                  }}
                  className="ro-button-small bg-red-600 hover:bg-red-700"
                >
                  Force Battle Mode (Limited)
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* Toast Notification */}
      {showToast && (
        <div className="fixed bottom-4 right-4 bg-green-700 text-white px-4 py-2 rounded-md shadow-lg">
          {toastMessage}
        </div>
      )}
    </div>
  );
} 