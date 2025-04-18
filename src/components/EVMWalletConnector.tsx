
import React, { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { toast } from "@/hooks/use-toast";
import { ethers } from "ethers";
import { Token } from "@/types/wallet";

interface EVMWalletConnectorProps {
  onConnectChange: () => void;
  setTokenBalances: (tokens: Token[]) => void;
}

const EVMWalletConnector: React.FC<EVMWalletConnectorProps> = ({
  onConnectChange,
  setTokenBalances,
}) => {
  const [isConnected, setIsConnected] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [fetchingBalances, setFetchingBalances] = useState(false);

  useEffect(() => {
    const checkMetaMask = () => {
      const installed = typeof window.ethereum !== "undefined";
      setIsInstalled(installed);
      
      if (installed) {
        setupEventListeners();
        checkConnectionStatus();
      }
    };

    checkMetaMask();

    return () => {
      if (window.ethereum) {
        window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
        window.ethereum.removeListener("chainChanged", handleChainChanged);
      }
    };
  }, []);

  const setupEventListeners = () => {
    if (!window.ethereum) return;

    window.ethereum.on("accountsChanged", handleAccountsChanged);
    window.ethereum.on("chainChanged", handleChainChanged);
  };

  const handleAccountsChanged = (accounts: string[]) => {
    if (accounts.length > 0) {
      setAddress(accounts[0]);
      fetchTokenBalances(accounts[0]);
    } else {
      handleDisconnect();
    }
  };

  const handleChainChanged = () => {
    if (address) {
      fetchTokenBalances(address);
    }
  };

  const checkConnectionStatus = async () => {
    try {
      if (!window.ethereum) return;
      
      const accounts = await window.ethereum.request({ method: "eth_accounts" });
      if (accounts.length > 0) {
        setAddress(accounts[0]);
        setIsConnected(true);
        onConnectChange();
        fetchTokenBalances(accounts[0]);
      }
    } catch (error) {
      console.error("MetaMask connection check failed:", error);
    }
  };

  const fetchTokenBalances = async (accountAddress: string) => {
    if (fetchingBalances) return;
    
    try {
      console.log("Fetching token balances for EVM wallet:", accountAddress);
      setFetchingBalances(true);
      
      // Get network ID
      const chainId = await window.ethereum.request({ method: "eth_chainId" });
      console.log("Current chain ID:", chainId);
      
      // Create provider
      const provider = new ethers.JsonRpcProvider(
        chainId === "0xaef3" 
          ? "https://alfajores-forno.celo-testnet.org" 
          : "https://eth-mainnet.g.alchemy.com/v2/demo"
      );
      
      // Get native token balance
      const nativeBalance = await provider.getBalance(accountAddress);
      const nativeToken: Token = {
        id: "native",
        symbol: chainId === "0xaef3" ? "CELO" : "ETH",
        name: chainId === "0xaef3" ? "Celo" : "Ethereum",
        balance: ethers.formatEther(nativeBalance),
        decimals: 18,
        address: "native",
        chain: "evm",
        logoURI: "",
        priceUSD: "0"
      };
      
      // For this example, we'll just use the native token
      // In a full implementation, you would fetch ERC20 tokens as well
      
      console.log("Setting EVM token balances:", [nativeToken]);
      setTokenBalances([nativeToken]);
    } catch (error) {
      console.error("Error fetching EVM token balances:", error);
      // Create at least one empty token to verify the fetching code was run
      const emptyToken: Token = {
        id: "error",
        symbol: "ERR",
        name: "Error fetching tokens",
        balance: "0",
        decimals: 18,
        address: "",
        chain: "ethereum",
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
      description: "MetaMask disconnected",
    });
  };

  const connectWallet = async () => {
    if (!isInstalled) {
      window.open("https://metamask.io/download/", "_blank");
      return;
    }

    try {
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      
      if (accounts.length > 0) {
        setAddress(accounts[0]);
        setIsConnected(true);
        onConnectChange();
        
        toast({
          title: "Connected",
          description: "MetaMask connected successfully!",
        });
        
        // Fetch balances after successful connection toast
        await fetchTokenBalances(accounts[0]);
      }
    } catch (error) {
      console.error("Error connecting to MetaMask:", error);
      toast({
        title: "Connection Failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="flex items-center justify-between p-4 bg-white rounded-lg shadow-sm">
      <div className="flex items-center space-x-3">
        <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
        <div className="h-9 w-9 rounded-full flex items-center justify-center font-bold text-xl bg-orange-600 text-white shadow-md">
  M
</div>
        </div>
        <div>
          <h3 className="font-medium text-orange-900">MetaMask</h3>
          {isConnected && address ? (
            <p className="text-sm text-orange-600">
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
          onClick={handleDisconnect}
          className="text-sm border-orange-200 text-orange-800 hover:bg-orange-50"
        >
          Disconnect
        </Button>
      ) : (
        <Button
          onClick={connectWallet}
          className="text-sm bg-orange-600 hover:bg-orange-700 text-white"
        >
          {isInstalled ? "Connect" : "Install MetaMask"}
        </Button>
      )}
    </div>
  );
};

// Add these interfaces for TypeScript support
declare global {
  interface Window {
    ethereum?: {
      isMetaMask?: boolean;
      request: (args: { method: string; params?: any[] }) => Promise<any>;
      on: (event: string, callback: (...args: any[]) => void) => void;
      removeListener: (event: string, callback: (...args: any[]) => void) => void;
    };
  }
}

export default EVMWalletConnector;
