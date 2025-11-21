import { useState, useEffect } from "react"
import { Line, LineChart, XAxis, YAxis, Tooltip } from 'recharts'



interface PaymentTransaction {
  amount: number
}

interface Transaction {
  id: number
  fee: number
  payment_transaction: PaymentTransaction
  timestamp: number
}


export function Main() {
  const [transactionData, setTransactionData] = useState<Transaction[]>([])

  const handleLiveTransactions = async () => {
    try {
      const response = await fetch('http://127.0.0.1:8000/transactions/live');
      const data = await response.json();

      // convert timestamp to readable time
      const formatted = data.recent_transactions.map((tx: Transaction) => ({
        ...tx,
        time: new Date(tx.timestamp * 1000).toLocaleTimeString(), // convert Unix sec → JS Date
      }));

      setTransactionData(formatted);
    } catch (error) {
      console.error("There's an error", error);
    }
  };

  useEffect(() => {
    handleLiveTransactions();

    const interval = setInterval(() => {
      handleLiveTransactions();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div>
      <LineChart width={600} height={300} data={transactionData}>
        <Line type="monotone" dataKey="payment_transaction.amount" stroke="#8884d8" />
        <XAxis dataKey="time" />
        <YAxis dataKey="payment_transaction.amount" width="auto" label={{ value: 'UV', position: 'insideLeft', angle: -90 }} />
      </LineChart>
    </div>
  )
}



// const interval = setInterval(() => {
//   handleLiveTransactions()
// }, 100000)

// return () => clearInterval(interval)