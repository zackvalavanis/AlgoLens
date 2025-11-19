from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List
from typing import Optional
import httpx
from collections import defaultdict

app = FastAPI(title="Algolens API")

class PaymentTransaction(BaseModel): 
  amount: int
  close_amount: Optional[int] = 0
  receiver: Optional[str] = None 


class TransactionStat(BaseModel): 
  tx_id: str
  tx_type: str
  fee: int
  sender: str
  payment_transaction: PaymentTransaction
  timestamp: int


@app.get('/')

def read_root(): 
  return {"message": "Hello, Algolens"}


def parse_transactions(data: list[dict]) -> list[TransactionStat]:
    transactions = []
    for tx in data:
        payment_tx = tx.get("payment-transaction", {})
        transactions.append(
            TransactionStat(
                tx_id=tx["id"],
                tx_type=tx["tx-type"],
                fee=tx["fee"],
                sender=tx["sender"],
                payment_transaction=PaymentTransaction(
                    amount=payment_tx.get("amount", 0),
                    close_amount=payment_tx.get("close-amount", 0),
                    receiver=payment_tx.get("receiver")
                ),
                timestamp=int(tx.get("round-time", 0))
            )
        )
    return transactions
@app.get("/transactions/latest", response_model=List[TransactionStat])
async def get_latest_transactions(limit: int = 200):
    url = f"http://mainnet-idx.4160.nodely.dev/v2/transactions?limit={limit}"
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(url)
            response.raise_for_status()
            data = response.json()["transactions"]

            # Use parse_transactions to create TransactionStat objects
            return parse_transactions(data)
    except httpx.HTTPError as e:
        raise HTTPException(status_code=500, detail=f"Error fetching transactions: {str(e)}")
    
@app.get("/wallets/top")
async def get_top_wallets(limit: int = 10, tx_fetch_limit: int = 1000):
    """
    Returns the top wallets by total transaction amount in the latest `tx_fetch_limit` transactions.
    """
    url = f"http://mainnet-idx.4160.nodely.dev/v2/transactions?limit={tx_fetch_limit}"
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(url)
            response.raise_for_status()
            data = response.json()["transactions"]

        transactions = parse_transactions(data)

        # Aggregate amounts per wallet
        wallet_totals = defaultdict(int)
        for tx in transactions:
            wallet_totals[tx.sender] += tx.payment_transaction.amount
            if tx.payment_transaction.receiver:
                wallet_totals[tx.payment_transaction.receiver] += tx.payment_transaction.amount

        # Sort and get top wallets
        top_wallets = sorted(wallet_totals.items(), key=lambda x: x[1], reverse=True)[:limit]

        return {"top_wallets": top_wallets}

    except httpx.HTTPError as e:
        raise HTTPException(status_code=500, detail=f"Error fetching transactions: {str(e)}")
    
   