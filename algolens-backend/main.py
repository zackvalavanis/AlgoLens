from fastapi import FastAPI
from pydantic import BaseModel
from typing import Optional, List
from collections import defaultdict, deque
import httpx
import asyncio
from datetime import datetime
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Algolens Live Tracker")

origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -------------------------------
# Models
# -------------------------------
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
    round: int  # Add round for incremental fetching

# -------------------------------
# In-memory sliding window
# -------------------------------
MAX_TX_WINDOW = 1000
recent_txs = deque(maxlen=MAX_TX_WINDOW)
wallet_activity = defaultdict(int)
lock = asyncio.Lock()

# For duplicate detection
seen_tx_ids = set()

# Track last round seen
last_round = 0

# -------------------------------
# Parse transaction JSON → Pydantic model
# -------------------------------
def parse_transactions(data: List[dict]) -> List[TransactionStat]:
    txs = []
    for tx in data:
        payment_tx = tx.get("payment-transaction", {})

        txs.append(
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
                timestamp=int(tx.get("round-time", 0)),
                round=tx.get("confirmed-round", 0)
            )
        )
    return txs

# -------------------------------
# Background polling task
# -------------------------------
async def update_wallet_activity():
    global last_round
    async with httpx.AsyncClient(timeout=10) as client:
        while True:
            try:
                # Fetch only transactions after last_round
                url = f"https://mainnet-idx.4160.nodely.dev/v2/transactions?limit=200&min-round={last_round+1}"
                response = await client.get(url)
                response.raise_for_status()
                json_data = response.json()
                raw_txs = json_data.get("transactions", [])

                new_txs = parse_transactions(raw_txs)
                if not new_txs:
                    await asyncio.sleep(5)
                    continue

                async with lock:
                    for tx in new_txs:
                        if tx.tx_id in seen_tx_ids:
                            continue

                        # Append new transaction
                        recent_txs.append(tx)
                        seen_tx_ids.add(tx.tx_id)

                        # Update sender and receiver activity
                        wallet_activity[tx.sender] += 1
                        if tx.payment_transaction.receiver:
                            wallet_activity[tx.payment_transaction.receiver] += 1

                        # Handle eviction from deque
                        if len(recent_txs) == recent_txs.maxlen:
                            oldest = recent_txs[0]
                            seen_tx_ids.discard(oldest.tx_id)
                            if wallet_activity[oldest.sender] > 0:
                                wallet_activity[oldest.sender] -= 1
                            if oldest.payment_transaction.receiver and wallet_activity[oldest.payment_transaction.receiver] > 0:
                                wallet_activity[oldest.payment_transaction.receiver] -= 1

                    # Update last_round to the highest round seen
                    last_round = max(tx.round for tx in new_txs if tx.round > 0)

            except Exception as e:
                print("Error updating wallet activity:", e)

            await asyncio.sleep(5)

# -------------------------------
# Utility
# -------------------------------
def format_timestamp(ts: int):
    return datetime.utcfromtimestamp(ts).strftime("%Y-%m-%d %H:%M:%S")

# -------------------------------
# Startup hook
# -------------------------------
@app.on_event("startup")
async def startup_event():
    asyncio.create_task(update_wallet_activity())

# -------------------------------
# Root endpoint
# -------------------------------
@app.get("/")
def root():
    return {"message": "Algolens Live Tracker running"}

# -------------------------------
# API endpoint for top wallets
# -------------------------------
@app.get("/wallets/live")
async def get_live_wallets(limit: int = 10):
    async with lock:
        sorted_wallets = sorted(wallet_activity.items(), key=lambda x: x[1], reverse=True)[:limit]
        formatted = [{"rank": i + 1, "wallet": wallet, "transaction_count": count} for i, (wallet, count) in enumerate(sorted_wallets)]
    return {"most_active_wallets": formatted}

@app.get("/transactions/live")
async def get_live_transactions(limit: int = 50): 
    async with lock: 
        tx_list = list(recent_txs)[-limit:]
        tx_list.reverse()
    return {"recent_transactions": [tx.dict() for tx in tx_list]}
