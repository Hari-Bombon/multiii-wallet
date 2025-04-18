import React, { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { toast } from "@/hooks/use-toast";
import { AptosClient } from "aptos";
import { Token } from "@/types/wallet";

interface PetraWallet {
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  account: () => Promise<{ address: string }>;
  isConnected: () => Promise<boolean>;
  network: () => Promise<string>;
  signAndSubmitTransaction: (transaction: any) => Promise<{ hash: string }>;
  onAccountChange: (callback: (newAddress: string) => void) => void;
  onNetworkChange: (callback: (newNetwork: string) => void) => void;
}


interface MVMWalletConnectorProps {
  onConnectChange: () => void;
  setTokenBalances: (tokens: Token[]) => void;
}

const MVMWalletConnector: React.FC<MVMWalletConnectorProps> = ({
  onConnectChange,
  setTokenBalances,
}) => {
  const [isConnected, setIsConnected] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const client = new AptosClient("https://fullnode.devnet.aptoslabs.com");
  const [fetchingBalances, setFetchingBalances] = useState(false);

  useEffect(() => {
    const checkPetra = () => {
      const installed = typeof window.petra !== "undefined";
      setIsInstalled(installed);
      
      if (installed) {
        setupEventListeners();
        checkConnectionStatus();
      }
    };

    checkPetra();

    return () => {
    };
  }, []);

  const setupEventListeners = () => {
    if (!window.petra) return;

    window.petra.onAccountChange((newAddress: string) => {
      if (newAddress) {
        setAddress(newAddress);
        fetchTokenBalances(newAddress);
      } else {
        handleDisconnect();
      }
    });

    window.petra.onNetworkChange((newNetwork: string) => {
      console.log("Network changed to:", newNetwork);
      if (address) {
        fetchTokenBalances(address);
      }
    });
  };

  const checkConnectionStatus = async () => {
    try {
      if (!window.petra) return;
      
      const connected = await window.petra.isConnected();
      if (connected) {
        const account = await window.petra.account();
        if (account?.address) {
          setAddress(account.address);
          setIsConnected(true);
          onConnectChange();
          fetchTokenBalances(account.address);
        }
      }
    } catch (error) {
      console.error("Petra Wallet connection check failed:", error);
    }
  };

  const fetchTokenBalances = async (accountAddress: string) => {
    if (fetchingBalances) return;
    
    try {
      console.log("Fetching token balances for MVM wallet:", accountAddress);
      setFetchingBalances(true);
      
      const resources = await client.getAccountResources(accountAddress);
      console.log("Account resources:", resources);

      const coinStores = resources.filter((r: any) =>
        r.type.startsWith("0x1::coin::CoinStore<")
      );
      console.log("Found coin stores:", coinStores.length);

      const tokenBalances: Token[] = [];
      
      const otherTokens = await Promise.all(
        coinStores.map(async (resource: any) => {
          const tokenType = resource.type.match(/<(.+)>/)?.[1] ?? "";
          const balance = resource.data.coin.value;

          let symbol = "UNKNOWN";
          let name = "Unknown Token";
          let decimals = 8;

          try {
            const creatorAddr = tokenType.split("::")[0];
            const metadata = await client.getAccountResource(
              creatorAddr,
              `0x1::coin::CoinInfo<${tokenType}>`
            );
            const coinInfo = metadata.data as any;
            symbol = coinInfo.symbol ?? symbol;
            name = coinInfo.name ?? name;
            decimals = coinInfo.decimals ?? decimals;
          } catch (err) {
            console.warn(`Failed to fetch metadata for ${tokenType}:`, err);
          }

          return {
            id: tokenType,
            symbol,
            name,
            balance: (parseInt(balance) / Math.pow(10, decimals)).toString(),
            decimals,
            address: tokenType,
            chain: "mvm", 
            logoURI: "", 
            priceUSD: "0", 
          } as Token;
        })
      );
      
      tokenBalances.push(...otherTokens);
      
      console.log("Setting token balances:", tokenBalances);
      setTokenBalances(tokenBalances);
    } catch (error) {
      console.error("Error fetching token balances:", error);
      const emptyToken: Token = {
        id: "error",
        symbol: "ERR",
        name: "Error fetching tokens",
        balance: "0",
        decimals: 8,
        address: "",
        chain: "mvm",
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
      description: "Petra Wallet disconnected",
    });
  };

  const connectWallet = async () => {
    if (!isInstalled) {
      window.open("https://petra.app/", "_blank");
      return;
    }

    try {
      if (!window.petra) throw new Error("Petra Wallet not available");
      
      await window.petra.connect();
      const account = await window.petra.account();

      if (account?.address) {
        setAddress(account.address);
        setIsConnected(true);
        onConnectChange();
        
        toast({
          title: "Connected",
          description: "Petra Wallet connected successfully!",
        });
        
        await fetchTokenBalances(account.address);
      }
    } catch (error) {
      console.error("Error connecting to Petra Wallet:", error);
      toast({
        title: "Connection Failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  const disconnectWallet = async () => {
    try {
      if (window.petra) {
        await window.petra.disconnect();
      }
    } catch (error) {
      console.error("Error disconnecting from Petra Wallet:", error);
    } finally {
      handleDisconnect();
    }
  };

  return (
    <div className="flex items-center justify-between p-4 bg-white rounded-lg shadow-sm">
      <div className="flex items-center space-x-3">
        <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
        <div className="h-9 w-9 rounded-full flex items-center justify-center font-bold text-xl bg-red-900 text-white-400 shadow-md">
  P
</div>
        </div>
        <div>
          <h3 className="font-medium text-indigo-900">Petra Wallet</h3>
          {isConnected && address ? (
            <p className="text-sm text-indigo-600">
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
          className="text-sm border-indigo-200 text-indigo-800 hover:bg-indigo-50"
        >
          Disconnect
        </Button>
      ) : (
        <Button
          onClick={connectWallet}
          className="text-sm bg-indigo-600 hover:bg-indigo-700 text-white"
        >
          {isInstalled ? "Connect" : "Install Petra"}
        </Button>
      )}
    </div>
  );
};

export default MVMWalletConnector;
