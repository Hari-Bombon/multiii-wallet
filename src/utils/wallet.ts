import { ethers } from "ethers";
import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import { Token, TransferParams } from "@/types/wallet";
import { toast } from "@/hooks/use-toast";
import { AptosClient, CoinClient, Types, AptosAccount } from "aptos";
import BigNumber from "bignumber.js";

import * as BufferModule from "buffer";
if (typeof window !== "undefined") {
  window.Buffer = window.Buffer || BufferModule.Buffer;
}

interface SolanaWalletProvider {
  isConnected: boolean;
  publicKey: PublicKey;
  connect: () => Promise<{ publicKey: PublicKey }>;
  disconnect: () => Promise<void>;
  signTransaction: (transaction: Transaction) => Promise<Transaction>;
}

interface EthereumProvider {
  request: (args: { method: string; params?: any[] }) => Promise<any>;
  on: (event: string, callback: (...args: any[]) => void) => void;
  removeListener: (event: string, callback: (...args: any[]) => void) => void;
  isMetaMask?: boolean;
}

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

declare global {
  interface Window {
    ethereum?: EthereumProvider;
    solana?: SolanaWalletProvider;
    petra?: PetraWallet;
    Buffer?: any;
  }
}

const APTOS_NODE_URL = "https://fullnode.devnet.aptoslabs.com"; 
const CELO_RPC_URL = "https://alfajores-forno.celo-testnet.org";

const getEthereumProvider = (): EthereumProvider | undefined => {
  return window.ethereum;
};

const getSolanaProvider = (): SolanaWalletProvider | undefined => {
  return window.solana;
};

const getPetraWallet = (): PetraWallet | undefined => {
  return window.petra;
};

const ERC20_ABI = [
  "function transfer(address to, uint amount) returns (bool)",
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function name() view returns (string)",
];

export const getEVMBalance = async (address: string): Promise<string> => {
  try {
    const provider = new ethers.JsonRpcProvider(CELO_RPC_URL);
    const balance = await provider.getBalance(address);
    return ethers.formatEther(balance);
  } catch (error) {
    console.error("Error getting EVM balance:", error);
    return "0";
  }
};

export const getERC20Balance = async (
  contractAddress: string,
  walletAddress: string
): Promise<string> => {
  try {
    const provider = new ethers.JsonRpcProvider(CELO_RPC_URL);
    const tokenContract = new ethers.Contract(contractAddress, ERC20_ABI, provider);
    const balance = await tokenContract.balanceOf(walletAddress);
    const decimals = await tokenContract.decimals();
    return ethers.formatUnits(balance, decimals);
  } catch (error) {
    console.error("Error getting ERC20 balance:", error);
    return "0";
  }
};

export const getSolanaBalance = async (publicKey: string): Promise<number> => {
  try {
    const connection = new Connection("https://api.devnet.solana.com", "confirmed");
    const balance = await connection.getBalance(new PublicKey(publicKey));
    return balance / LAMPORTS_PER_SOL;
  } catch (error) {
    console.error("Error getting Solana balance:", error);
    return 0;
  }
};

export const getMVMTokenBalance = async (walletAddress: string): Promise<string> => {
  const client = new AptosClient(APTOS_NODE_URL);
  const coinClient = new CoinClient(client);

  try {
    const balance = await coinClient.checkBalance(walletAddress);
    return balance.toString(); 
  } catch (error) {
    console.error("Error fetching MVM balance:", error);
    return "0"; 
  }
};

export const getAllMVMTokenBalances = async (
  walletAddress: string
): Promise<Token[]> => {
  const client = new AptosClient(APTOS_NODE_URL);

  try {
    await client.getAccount(walletAddress);
  } catch (error) {
    toast({
      title: "Account Not Found",
      description: "This Aptos address does not exist on chain. Please fund it with a small amount of APT to activate.",
      variant: "destructive",
    });
    return [];
  }

  try {
    const resources = await client.getAccountResources(walletAddress);
  } catch (error) {
    console.error("Error fetching MVM token balances:", error);
    return [];
  }
};

const client = new AptosClient(APTOS_NODE_URL);

export const transferMVMToken = async (
  token: Token,
  toAddress: string,
  amount: string
): Promise<boolean> => {
  try {
    const petra = getPetraWallet();
    if (!petra) {
      toast({ title: "Error", description: "Petra wallet not installed.", variant: "destructive" });
      return false;
    }

    if (!(await petra.isConnected())) await petra.connect();

    const account = await petra.account();
    if (!account.address) {
      toast({ title: "Error", description: "Could not get Petra wallet address.", variant: "destructive" });
      return false;
    }

    let typeTag = token.address;
    if (!typeTag || !typeTag.includes("::")) typeTag = "0x1::aptos_coin::AptosCoin";

    const amountInSmallestUnit = new BigNumber(amount)
      .multipliedBy(new BigNumber(10).pow(token.decimals))
      .toFixed(0);

    const localTime = Math.floor(Date.now() / 1000);
    const ledgerInfo = await client.getLedgerInfo();
    const nodeTime = Math.floor(Number(ledgerInfo.ledger_timestamp) / 1_000_000);
    console.log("Local time (s):", localTime, "Node time (s):", nodeTime);

    const payload = {
      type: "entry_function_payload",
      function: "0x1::coin::transfer",
      type_arguments: [typeTag],
      arguments: [toAddress, amountInSmallestUnit],
    };

    const txnHash = await petra.signAndSubmitTransaction({payload});

    await client.waitForTransaction(txnHash.hash, { checkSuccess: true });

    toast({
      title: "Transfer Successful",
      description: `Transferred ${amount} ${token.symbol} to ${toAddress.slice(0, 6)}...${toAddress.slice(-4)}`,
    });
    return true;
  } catch (error) {
    toast({
      title: "Transfer Failed",
      description: error instanceof Error ? error.message : "Unknown error",
      variant: "destructive",
    });
    return false;
  }
};


export const transferERC20 = async (
  tokenAddress: string,
  toAddress: string,
  amount: string
): Promise<boolean> => {
  try {
    const ethereum = getEthereumProvider();
    if (!ethereum) {
      toast({
        title: "Error",
        description: "No Ethereum wallet found. Please install MetaMask.",
        variant: "destructive",
      });
      return false;
    }

    try {
      await ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0xaef3" }],
      });
    } catch (switchError: any) {
      if (switchError.code === 4902) {
        try {
          await ethereum.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: "0xaef3",
                chainName: "Celo Alfajores Testnet",
                nativeCurrency: {
                  name: "CELO",
                  symbol: "CELO",
                  decimals: 18,
                },
                rpcUrls: [CELO_RPC_URL],
                blockExplorerUrls: ["https://alfajores.celoscan.io/"],
              },
            ],
          });

          await ethereum.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: "0xaef3" }],
          });
        } catch (addError) {
          toast({
            title: "Network Error",
            description: "Could not switch to Celo Alfajores network",
            variant: "destructive",
          });
          return false;
        }
      } else {
        toast({
          title: "Network Error",
          description: "Please switch to Celo Alfajores manually.",
          variant: "destructive",
        });
        return false;
      }
    }

    const provider = new ethers.BrowserProvider(ethereum);
    const signer = await provider.getSigner();

    if (tokenAddress && tokenAddress !== "native") {
      const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, signer);
      const decimals = await tokenContract.decimals();
      const amountInWei = ethers.parseUnits(amount, decimals);
      const tx = await tokenContract.transfer(toAddress, amountInWei);
      await tx.wait();
    } else {
      const amountInWei = ethers.parseEther(amount);
      const tx = await signer.sendTransaction({ to: toAddress, value: amountInWei });
      await tx.wait();
    }

    toast({
      title: "Transfer Successful",
      description: `Transferred ${amount} to ${toAddress.slice(0, 6)}...${toAddress.slice(
        -4
      )}`,
    });

    return true;
  } catch (error) {
    toast({
      title: "Transfer Failed",
      description: error instanceof Error ? error.message : "Unknown error",
      variant: "destructive",
    });
    return false;
  }
};

// Function for Solana transfer
export const transferSOL = async (
  toAddress: string,
  amount: string
): Promise<boolean> => {
  try {
    const solana = getSolanaProvider();
    if (!solana) {
      toast({
        title: "Error",
        description: "No Solana wallet found. Please install Phantom.",
        variant: "destructive",
      });
      return false;
    }

    if (!solana.isConnected) {
      await solana.connect();
    }

    const connection = new Connection("https://api.devnet.solana.com", "confirmed");
    const publicKey = solana.publicKey;

    const currentBalance = await connection.getBalance(publicKey);
    const transferAmount = parseFloat(amount) * LAMPORTS_PER_SOL;

    if (currentBalance < transferAmount) {
      toast({
        title: "Insufficient Balance",
        description: `You need at least ${amount} SOL.`,
        variant: "destructive",
      });
      return false;
    }

    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: publicKey,
        toPubkey: new PublicKey(toAddress),
        lamports: transferAmount,
      })
    );

    transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    transaction.feePayer = publicKey;

    const signedTx = await solana.signTransaction(transaction);
    const signature = await connection.sendRawTransaction(signedTx.serialize());
    await connection.confirmTransaction(signature, "confirmed");

    toast({
      title: "Transfer Successful",
      description: `Transferred ${amount} SOL to ${toAddress.slice(0, 6)}...${toAddress.slice(
        -4
      )}`,
    });

    return true;
  } catch (error) {
    toast({
      title: "Transfer Failed",
      description: error instanceof Error ? error.message : "Unknown error",
      variant: "destructive",
    });
    return false;
  }
};


export const transferTokens = async (params: TransferParams): Promise<boolean> => {
  const { token, toAddress, amount } = params;

  switch (token.chain) {
    case "evm":
      return transferERC20(token.address || "native", toAddress, amount);
    case "svm":
      return transferSOL(toAddress, amount);
    case "mvm":
      return transferMVMToken(token, toAddress, amount);
    default:
      toast({
        title: "Error",
        description: "Unsupported chain",
        variant: "destructive",
      });
      return false;
  }
};