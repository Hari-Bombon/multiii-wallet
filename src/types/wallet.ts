
export interface Token {
  id: string;
  symbol: string;
  name: string;
  balance: string;
  decimals: number;
  address: string;
  chain: string;
  logoURI: string;
  priceUSD: string;
}

export interface TransferParams {
  token: Token;
  toAddress: string;
  amount: string;
}
