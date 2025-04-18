import React, { useState } from "react";
import MVMWalletConnector from "@/components/MVMWalletConnector";
import EVMWalletConnector from "@/components/EVMWalletConnector";
import SVMWalletConnector from "@/components/SVMWalletConnector";
import { Token, TransferParams } from "@/types/wallet";
import { Button } from "@/components/ui/button";
import { transferTokens } from "@/utils/wallet";
import { toast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const chainColors = {
  mvm: "from-indigo-500 to-indigo-800 text-indigo-100 border-indigo-400",
  evm: "from-orange-500 to-orange-800 text-orange-100 border-orange-400",
  svm: "from-purple-500 to-fuchsia-900 text-fuchsia-100 border-purple-400",
  default: "from-zinc-700 to-zinc-900 text-zinc-100 border-zinc-500",
};

const chainDisplayNames: Record<string, string> = {
  evm: "Ethereum",
  svm: "Solana",
  mvm: "Aptos",
};

const Index = () => {
  const [allTokens, setAllTokens] = useState<Token[]>([]);
  const [selectedToken, setSelectedToken] = useState<Token | null>(null);
  const [toAddress, setToAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [isTransferDialogOpen, setIsTransferDialogOpen] = useState(false);

  const handleSetTokenBalances = (tokens: Token[], chain: string) => {
    setAllTokens((prev) => {
      const filtered = prev.filter((token) => token.chain !== chain);
      return [...filtered, ...tokens];
    });
  };

  const handleTransfer = (token: Token) => {
    setSelectedToken(token);
    setToAddress("");
    setAmount("");
    setIsTransferDialogOpen(true);
  };

  const handleSubmitTransfer = async () => {
    if (!selectedToken || !toAddress || !amount) {
      toast({
        title: "Error",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }

    const params: TransferParams = {
      token: selectedToken,
      toAddress,
      amount,
    };

    const success = await transferTokens(params);
    if (success) {
      toast({
        title: "Success",
        description: `${selectedToken.symbol} sent successfully!`,
      });
      setIsTransferDialogOpen(false);
    }
  };

  const getChainClass = (chain: string) => {
    return chainColors[chain as keyof typeof chainColors] || chainColors.default;
  };

  return (
    <div className="min-h-screen bg-gradient-to-tl from-zinc-900 via-zinc-950 to-black text-zinc-100 p-6">
      <div className="max-w-6xl mx-auto space-y-10">
        <header className="text-center">
          <h1 className="text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-fuchsia-500 to-orange-400 drop-shadow-lg">
            Multi-Chain Wallet Explorer
          </h1>
          <p className="text-zinc-400 mt-4 text-lg">
            Connect and manage your tokens seamlessly across chains.
          </p>
        </header>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-indigo-200">Connect Wallets</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="glass-card">
              <MVMWalletConnector
                onConnectChange={() => {}}
                setTokenBalances={(tokens) =>
                  handleSetTokenBalances(tokens, "mvm")
                }
              />
            </div>
            <div className="glass-card">
              <EVMWalletConnector
                onConnectChange={() => {}}
                setTokenBalances={(tokens) =>
                  handleSetTokenBalances(tokens, "evm")
                }
              />
            </div>
            <div className="glass-card">
              <SVMWalletConnector
                onConnectChange={() => {}}
                setTokenBalances={(tokens) =>
                  handleSetTokenBalances(tokens, "svm")
                }
              />
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-indigo-200 mb-4">
            Your Tokens
          </h2>
          {allTokens.length > 0 ? (
            <div className="overflow-x-auto rounded-xl backdrop-blur bg-zinc-900/70 shadow-2xl ring-1 ring-zinc-800">
              <table className="min-w-full text-zinc-200">
                <thead>
                  <tr>
                    <th className="px-6 py-3 text-left font-medium text-indigo-300">Token</th>
                    <th className="px-6 py-3 text-left font-medium text-zinc-400">Balance</th>
                    <th className="px-6 py-3 text-left font-medium text-zinc-400">Chain</th>
                    <th className="px-6 py-3 text-right font-medium text-zinc-400">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {allTokens.map((token) => (
                    <tr
                      key={`${token.chain}-${token.id}`}
                      className="border-t border-zinc-800 hover:bg-zinc-800/60 transition"
                    >
                      <td className="px-6 py-4 flex items-center space-x-3">
                        {token.logoURI ? (
                          <img
                            src={token.logoURI}
                            alt={token.symbol}
                            className="h-9 w-9 rounded-full shadow-md ring-2 ring-indigo-400/30 bg-zinc-800"
                          />
                        ) : (
                          <div className="h-9 w-9 rounded-full flex items-center justify-center font-bold text-xl bg-indigo-900 text-indigo-400 shadow-md">
                            {token.symbol.charAt(0)}
                          </div>
                        )}
                        <div>
                          <div className="font-bold text-zinc-50 text-lg">
                            {token.symbol}
                          </div>
                          <div className="text-sm text-zinc-400">
                            {token.name}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">{token.balance}</td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-3 py-1 text-xs font-semibold rounded-full border bg-gradient-to-r shadow ${getChainClass(
                            token.chain
                          )} uppercase drop-shadow`}
                        >
                          {chainDisplayNames[token.chain] || token.chain}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Button
                          variant="secondary"
                          size="sm"
                          className="bg-gradient-to-r from-indigo-600 to-fuchsia-700 hover:from-indigo-700 hover:to-fuchsia-800 text-white rounded-lg shadow-md px-4"
                          onClick={() => handleTransfer(token)}
                        >
                          Send
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="bg-zinc-900/70 p-8 rounded-xl shadow-xl flex flex-col items-center">
              <span className="text-indigo-300 mb-2 text-4xl">🔑</span>
              <span className="text-zinc-400">
                Connect a wallet to view your tokens
              </span>
            </div>
          )}
        </section>
      </div>

      {/* Transfer dialog */}
      <Dialog open={isTransferDialogOpen} onOpenChange={setIsTransferDialogOpen}>
        <DialogContent className="sm:max-w-md dark:bg-zinc-900 dark:text-zinc-200 bg-zinc-900 border-zinc-700 rounded-2xl shadow-2xl">
          <DialogHeader>
            <DialogTitle>
              <span className="font-mono text-indigo-300">
                Send {selectedToken?.symbol}
              </span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-3">
            <div>
              <Label htmlFor="address" className="text-zinc-400">Recipient Address</Label>
              <Input
                id="address"
                className="mt-1 bg-zinc-800 border-zinc-600 focus:ring-indigo-500 focus:border-indigo-600 text-zinc-100"
                value={toAddress}
                onChange={(e) => setToAddress(e.target.value)}
                placeholder="Enter recipient address"
                autoFocus
              />
            </div>
            <div>
              <Label htmlFor="amount" className="text-zinc-400">Amount</Label>
              <Input
                id="amount"
                type="number"
                className="mt-1 bg-zinc-800 border-zinc-600 focus:ring-indigo-500 focus:border-indigo-600 text-zinc-100"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={`Amount in ${selectedToken?.symbol || ""}`}
              />
            </div>
            <Button
              onClick={handleSubmitTransfer}
              className="w-full bg-gradient-to-r from-indigo-500 via-fuchsia-600 to-orange-500 hover:opacity-90 text-white font-semibold rounded-lg shadow-xl py-2 transition"
            >
              Send {selectedToken?.symbol}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Index;
