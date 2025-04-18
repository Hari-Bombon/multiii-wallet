import React, { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { toast } from "@/hooks/use-toast";
import { PublicKey, Connection, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { Token } from "@/types/wallet";

interface PhantomWallet {
  isPhantom?: boolean;
  connect: () => Promise<{ publicKey: PublicKey }>;
  disconnect: () => Promise<void>;
  on: (event: string, callback: (...args: any[]) => void) => void;
  off: (event: string, callback: (...args: any[]) => void) => void;
  isConnected: boolean;
  publicKey: PublicKey;
}

interface SVMWalletConnectorProps {
  onConnectChange: () => void;
  setTokenBalances: (tokens: Token[]) => void;
}

const SVMWalletConnector: React.FC<SVMWalletConnectorProps> = ({
  onConnectChange,
  setTokenBalances,
}) => {
  const [isConnected, setIsConnected] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [fetchingBalances, setFetchingBalances] = useState(false);

  const getPhantomWallet = (): PhantomWallet | undefined => {
    if (typeof window !== "undefined" && "solana" in window) {
      const provider = window.solana as unknown as PhantomWallet;
      if (provider.isPhantom) return provider;
    }
    return undefined;
  };

  useEffect(() => {
    const checkPhantom = () => {
      const phantom = getPhantomWallet();
      setIsInstalled(!!phantom);

      if (phantom) {
        setupEventListeners(phantom);
        checkConnectionStatus(phantom);
      }
    };

    checkPhantom();

    return () => {
      const phantom = getPhantomWallet();
      if (phantom) {
        try {
          phantom.off("disconnect", handleDisconnect);
          phantom.off("accountChanged", handleAccountChanged);
        } catch (error) {
          console.error("Error removing Phantom event listeners:", error);
        }
      }
    };
  }, []);

  const setupEventListeners = (phantom: PhantomWallet) => {
    try {
      phantom.on("disconnect", handleDisconnect);
      phantom.on("accountChanged", handleAccountChanged);
    } catch (error) {
      console.error("Error setting up Phantom event listeners:", error);
    }
  };

  const handleAccountChanged = (publicKey: PublicKey | null) => {
    if (publicKey) {
      const newAddress = publicKey.toString();
      setAddress(newAddress);
      fetchTokenBalances(newAddress);
    } else {
      handleDisconnect();
    }
  };

  const checkConnectionStatus = async (phantom: PhantomWallet) => {
    try {
      if (phantom.isConnected && phantom.publicKey) {
        const publicKey = phantom.publicKey.toString();
        setAddress(publicKey);
        setIsConnected(true);
        onConnectChange();
        fetchTokenBalances(publicKey);
      }
    } catch (error) {
      console.error("Phantom wallet connection check failed:", error);
    }
  };

  const fetchTokenBalances = async (publicKeyStr: string) => {
    if (fetchingBalances) return;

    try {
      console.log("Fetching token balances for Solana wallet:", publicKeyStr);
      setFetchingBalances(true);

      const connection = new Connection("https://api.devnet.solana.com", "confirmed");
      const publicKey = new PublicKey(publicKeyStr);

      const balance = await connection.getBalance(publicKey);
      const solToken: Token = {
        id: "SOL",
        symbol: "SOL",
        name: "Solana",
        balance: (balance / LAMPORTS_PER_SOL).toString(),
        decimals: 9,
        address: "native",
        chain: "svm",
        logoURI: "",
        priceUSD: "0"
      };

     
      console.log("Setting Solana token balances:", [solToken]);
      setTokenBalances([solToken]);
    } catch (error) {
      console.error("Error fetching Solana token balances:", error);
      const emptyToken: Token = {
        id: "error",
        symbol: "ERR",
        name: "Error fetching tokens",
        balance: "0",
        decimals: 9,
        address: "",
        chain: "svm",
        logoURI: "",
        priceUSD: "0"
      };
      setTokenBalances([emptyToken]);
    } finally {
      setFetchingBalances(false);
    }
  };

  const handleDisconnect = () => {
    setAddress(null);
    setIsConnected(false);
    onConnectChange();
    setTokenBalances([]);

    toast({
      title: "Disconnected",
      description: "Phantom wallet disconnected",
    });
  };

  const connectWallet = async () => {
    if (!isInstalled) {
      window.open("https://phantom.app/", "_blank");
      return;
    }

    try {
      const phantom = getPhantomWallet();
      if (!phantom) throw new Error("Phantom wallet not available");

      const response = await phantom.connect();
      const address = response.publicKey.toString();

      setAddress(address);
      setIsConnected(true);
      onConnectChange();

      toast({
        title: "Connected",
        description: "Phantom wallet connected successfully!",
      });

      await fetchTokenBalances(address);
    } catch (error) {
      console.error("Error connecting to Phantom wallet:", error);
      toast({
        title: "Connection Failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  const disconnectWallet = async () => {
    try {
      const phantom = getPhantomWallet();
      if (phantom) {
        await phantom.disconnect();
      }
    } catch (error) {
      console.error("Error disconnecting from Phantom wallet:", error);
    } finally {
      handleDisconnect();
    }
  };

  return (
    <div className="flex items-center justify-between p-4 bg-white rounded-lg shadow-sm">
      <div className="flex items-center space-x-3">
        <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
        <div className="h-9 w-9 rounded-full flex items-center justify-center font-bold text-xl bg-purple-600 text-white shadow-md">
  P
</div>
        </div>
        <div>
          <h3 className="font-medium text-purple-900">Phantom Wallet</h3>
          {isConnected && address ? (
            <p className="text-sm text-purple-600">
              {address.slice(0, 6)}...{address.slice(-4)}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">Not connected</p>
          )}
        </div>
      </div>

      {isConnected ? (
        <Button
          variant="outline"
          onClick={disconnectWallet}
          className="text-sm border-purple-200 text-purple-800 hover:bg-purple-50"
        >
          Disconnect
        </Button>
      ) : (
        <Button
          onClick={connectWallet}
          className="text-sm bg-purple-600 hover:bg-purple-700 text-white"
        >
          {isInstalled ? "Connect" : "Install Phantom"}
        </Button>
      )}
    </div>
  );
};

export default SVMWalletConnector;
