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
    const ethereum = typeof window !== "undefined" ? window.ethereum : undefined;

    if (ethereum?.isMetaMask) {
      setIsInstalled(true);
      setupEventListeners(ethereum);
      checkConnectionStatus(ethereum);
    }

    return () => {
      if (ethereum) {
        ethereum.removeListener("accountsChanged", handleAccountsChanged);
        ethereum.removeListener("chainChanged", handleChainChanged);
      }
    };
  }, []);

  const setupEventListeners = (ethereum: EthereumProvider) => {
    ethereum.on("accountsChanged", handleAccountsChanged);
    ethereum.on("chainChanged", handleChainChanged);
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

  const checkConnectionStatus = async (ethereum: EthereumProvider) => {
    try {
      const accounts = await ethereum.request({ method: "eth_accounts" });
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
      setFetchingBalances(true);
      const ethereum = window.ethereum;
      if (!ethereum?.request) throw new Error("Ethereum provider not available");

      const chainIdHex = await ethereum.request({ method: "eth_chainId" });
      const chainId = parseInt(chainIdHex, 16);

      const provider = new ethers.JsonRpcProvider(
        chainId === 44787
          ? "https://alfajores-forno.celo-testnet.org"
          : "https://eth-mainnet.g.alchemy.com/v2/demo"
      );

      const nativeBalance = await provider.getBalance(accountAddress);

      const nativeToken: Token = {
        id: "native",
        symbol: chainId === 44787 ? "CELO" : "ETH",
        name: chainId === 44787 ? "Celo" : "Ethereum",
        balance: ethers.formatEther(nativeBalance),
        decimals: 18,
        address: "native",
        chain: "evm",
        logoURI: "",
        priceUSD: "0",
      };

      setTokenBalances([nativeToken]);
    } catch (error) {
      console.error("Error fetching EVM token balances:", error);

      const errorToken: Token = {
        id: "error",
        symbol: "ERR",
        name: "Error fetching tokens",
        balance: "0",
        decimals: 18,
        address: "",
        chain: "evm",
        logoURI: "",
        priceUSD: "0",
      };

      setTokenBalances([errorToken]);
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
    const ethereum = typeof window !== "undefined" ? window.ethereum : undefined;

    if (!ethereum?.isMetaMask || !ethereum.request) {
      window.open("https://metamask.io/download/", "_blank");
      return;
    }

    try {
      const accounts = await ethereum.request({ method: "eth_requestAccounts" });

      if (accounts.length > 0) {
        setAddress(accounts[0]);
        setIsConnected(true);
        onConnectChange();

        toast({
          title: "Connected",
          description: "MetaMask connected successfully!",
        });

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


interface EthereumProvider {
  isMetaMask?: boolean;
  request: (args: { method: string; params?: any[] }) => Promise<any>;
  on: (event: string, callback: (...args: any[]) => void) => void;
  removeListener: (event: string, callback: (...args: any[]) => void) => void;
}

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

export default EVMWalletConnector;
