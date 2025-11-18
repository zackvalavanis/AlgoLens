from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List
import httpx

app = FastAPI(title="Algolens API")

class TransactionStat(BaseModel): 
  tx_id: str
  sender: str
  receiver: str 
  amount: int
  timestamp: int

@app.get('/')

def read_root(): 
  return {"message": "Hello, Algolens"}

@app.get("/transactions/latest", response_model=List[TransactionStat])
async def get_latest_transactions(limit: int=10):
  """
  Fetch the lastest `limit` transactions from Algorand. 
  """
  url = f"http://mainnet-idx.4160.nodely.dev/v2/transactions?limit={limit}"

  try: 
    async with httpx.AsyncClient() as client:
      response = await client.get(url)
      response.raise_for_status()
      data = response.json()["transactions"]

      transactions = [
        TransactionStat(
          tx_id=tx["id"], 
          sender=tx["sender"], 
          receiver=tx.get("receiver", ""), 
          amount=tx.get("amount", 0), 
          timestamp=int(tx.get("round-time", 0))
        )
        for tx in data
      ]
      return transactions
  except httpx.HTTPError as e: 
    raise HTTPException(status_code=500, detail=f"Error fetching transactions: {str(e)}")