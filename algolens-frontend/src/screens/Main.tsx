import { useState, useEffect } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from "recharts";
import { Activity, TrendingUp, Clock } from "lucide-react";

interface PaymentTransaction {
  amount: number;
}

interface Transaction {
  id: string;
  payment_transaction: PaymentTransaction;
  timestamp: string;
}

export function Main() {
  const [buckets, setBuckets] = useState<{ [minuteKey: string]: number }>({});
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [totalVolume, setTotalVolume] = useState(0);
  const MAX_MINUTES = 10;

  const handleLiveTransactions = async () => {
    try {
      const res = await fetch("http://127.0.0.1:8000/transactions/live");
      const data = await res.json();

      if (!data.recent_transactions) return;

      setBuckets(prevBuckets => {
        const newBuckets = { ...prevBuckets };

        data.recent_transactions.forEach((tx: Transaction) => {
          const timestampStr = tx.timestamp.replace(' UTC', '');
          const date = new Date(timestampStr + 'Z');

          if (isNaN(date.getTime())) return;

          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          const hours = String(date.getHours()).padStart(2, '0');
          const minutes = String(date.getMinutes()).padStart(2, '0');
          const minuteKey = `${year}-${month}-${day}T${hours}:${minutes}`;

          newBuckets[minuteKey] = (newBuckets[minuteKey] || 0) + tx.payment_transaction.amount;
        });

        // Clean up old buckets
        const now = new Date();
        const cutoffTime = new Date(now.getTime() - MAX_MINUTES * 60000);
        const year = cutoffTime.getFullYear();
        const month = String(cutoffTime.getMonth() + 1).padStart(2, '0');
        const day = String(cutoffTime.getDate()).padStart(2, '0');
        const hours = String(cutoffTime.getHours()).padStart(2, '0');
        const minutes = String(cutoffTime.getMinutes()).padStart(2, '0');
        const cutoffKey = `${year}-${month}-${day}T${hours}:${minutes}`;

        Object.keys(newBuckets).forEach(key => {
          if (key < cutoffKey) delete newBuckets[key];
        });

        return newBuckets;
      });

      setLastUpdate(new Date());
      setIsLoading(false);
    } catch (err) {
      console.error("Error fetching transactions:", err);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    handleLiveTransactions();
    const interval = setInterval(handleLiveTransactions, 5000);
    return () => clearInterval(interval);
  }, []);

  const generateChartData = () => {
    const now = new Date();
    const minutes: string[] = [];

    for (let i = MAX_MINUTES - 1; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 60000);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const hours = String(d.getHours()).padStart(2, '0');
      const mins = String(d.getMinutes()).padStart(2, '0');
      minutes.push(`${year}-${month}-${day}T${hours}:${mins}`);
    }

    return minutes.map(minuteKey => {
      const [datePart, timePart] = minuteKey.split('T');
      const [year, month, day] = datePart.split('-');
      const [hours, mins] = timePart.split(':');
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hours), parseInt(mins));

      const amount = buckets[minuteKey] || 0;

      return {
        minuteKey,
        time: date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        amount,
      };
    });
  };

  const chartData = generateChartData();

  useEffect(() => {
    const total = Object.values(buckets).reduce((sum, val) => sum + val, 0);
    setTotalVolume(total);
  }, [buckets]);

  const formatAmount = (value: number) => {
    if (value >= 1000000000) return `${(value / 1000000000).toFixed(2)}B`;
    if (value >= 1000000) return `${(value / 1000000).toFixed(2)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(2)}K`;
    return value.toString();
  };

  const maxAmount = Math.max(...chartData.map(d => d.amount), 0);
  const activeMinutes = chartData.filter(d => d.amount > 0).length;

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
      padding: "40px 20px",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    }}>
      <div style={{
        maxWidth: "1400px",
        margin: "0 auto"
      }}>
        {/* Header */}
        <div style={{
          textAlign: "center",
          marginBottom: "40px",
          color: "white"
        }}>
          <div style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "12px",
            marginBottom: "12px"
          }}>
            <Activity size={36} />
            <h1 style={{
              fontSize: "36px",
              fontWeight: "700",
              margin: 0,
              letterSpacing: "-0.5px"
            }}>
              Algorand Network Monitor
            </h1>
          </div>
          <p style={{
            fontSize: "16px",
            opacity: 0.9,
            margin: 0
          }}>
            Real-time transaction volume tracking
          </p>
        </div>

        {/* Stats Cards */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
          gap: "20px",
          marginBottom: "30px"
        }}>
          <div style={{
            background: "rgba(255, 255, 255, 0.95)",
            borderRadius: "16px",
            padding: "24px",
            boxShadow: "0 10px 40px rgba(0,0,0,0.1)"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
              <TrendingUp size={24} style={{ color: "#667eea" }} />
              <span style={{ fontSize: "14px", color: "#64748b", fontWeight: "600" }}>
                TOTAL VOLUME
              </span>
            </div>
            <div style={{ fontSize: "28px", fontWeight: "700", color: "#1e293b" }}>
              {formatAmount(totalVolume)} ALGO
            </div>
            <div style={{ fontSize: "13px", color: "#64748b", marginTop: "4px" }}>
              Last {MAX_MINUTES} minutes
            </div>
          </div>

          <div style={{
            background: "rgba(255, 255, 255, 0.95)",
            borderRadius: "16px",
            padding: "24px",
            boxShadow: "0 10px 40px rgba(0,0,0,0.1)"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
              <Activity size={24} style={{ color: "#667eea" }} />
              <span style={{ fontSize: "14px", color: "#64748b", fontWeight: "600" }}>
                PEAK VOLUME
              </span>
            </div>
            <div style={{ fontSize: "28px", fontWeight: "700", color: "#1e293b" }}>
              {formatAmount(maxAmount)} ALGO
            </div>
            <div style={{ fontSize: "13px", color: "#64748b", marginTop: "4px" }}>
              Per minute maximum
            </div>
          </div>

          <div style={{
            background: "rgba(255, 255, 255, 0.95)",
            borderRadius: "16px",
            padding: "24px",
            boxShadow: "0 10px 40px rgba(0,0,0,0.1)"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
              <Clock size={24} style={{ color: "#667eea" }} />
              <span style={{ fontSize: "14px", color: "#64748b", fontWeight: "600" }}>
                LAST UPDATE
              </span>
            </div>
            <div style={{ fontSize: "28px", fontWeight: "700", color: "#1e293b" }}>
              {lastUpdate ? lastUpdate.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit"
              }) : "--:--:--"}
            </div>
            <div style={{ fontSize: "13px", color: "#64748b", marginTop: "4px" }}>
              {activeMinutes} active {activeMinutes === 1 ? 'minute' : 'minutes'}
            </div>
          </div>
        </div>

        {/* Chart Card */}
        <div style={{
          background: "rgba(255, 255, 255, 0.95)",
          borderRadius: "16px",
          padding: "32px",
          boxShadow: "0 10px 40px rgba(0,0,0,0.1)"
        }}>
          <h2 style={{
            fontSize: "20px",
            fontWeight: "700",
            color: "#1e293b",
            marginTop: 0,
            marginBottom: "24px"
          }}>
            Transaction Volume Timeline
          </h2>

          {isLoading ? (
            <div style={{
              height: "400px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#64748b"
            }}>
              <div>
                <Activity size={48} style={{ animation: "pulse 2s infinite" }} />
                <p style={{ marginTop: "16px", fontSize: "16px" }}>Loading data...</p>
              </div>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={400}>
              <LineChart
                data={chartData}
                margin={{ top: 10, right: 30, left: 20, bottom: 40 }}
              >
                <defs>
                  <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#667eea" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#667eea" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="time"
                  angle={-45}
                  textAnchor="end"
                  height={80}
                  tick={{ fill: "#64748b", fontSize: 12 }}
                  stroke="#cbd5e1"
                />
                <YAxis
                  width={100}
                  tick={{ fill: "#64748b", fontSize: 12 }}
                  stroke="#cbd5e1"
                  tickFormatter={(value) => {
                    if (value >= 1000000000) return `${(value / 1000000000).toFixed(1)}B`;
                    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
                    if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
                    return value.toString();
                  }}
                />
                <Tooltip
                  contentStyle={{
                    background: "#1e293b",
                    border: "none",
                    borderRadius: "8px",
                    padding: "12px",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.15)"
                  }}
                  labelStyle={{ color: "#e2e8f0", fontWeight: "600", marginBottom: "4px" }}
                  itemStyle={{ color: "#fff" }}
                  formatter={(value: number) => [
                    `${formatAmount(value)} ALGO`,
                    "Volume"
                  ]}
                />
                <Line
                  type="monotone"
                  dataKey="amount"
                  stroke="#667eea"
                  strokeWidth={3}
                  dot={{ fill: "#667eea", r: 4 }}
                  activeDot={{ r: 6, fill: "#764ba2" }}
                  fill="url(#colorAmount)"
                />
              </LineChart>
            </ResponsiveContainer>
          )}

          <div style={{
            marginTop: "24px",
            paddingTop: "24px",
            borderTop: "1px solid #e2e8f0",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: "13px",
            color: "#64748b"
          }}>
            <span>Updates every 5 seconds</span>
            <span>{Object.keys(buckets).length} time bucket{Object.keys(buckets).length !== 1 ? 's' : ''} tracked</span>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          textAlign: "center",
          marginTop: "40px",
          color: "rgba(255,255,255,0.7)",
          fontSize: "14px"
        }}>
          <p>Powered by Algorand Blockchain • Real-time Data</p>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}