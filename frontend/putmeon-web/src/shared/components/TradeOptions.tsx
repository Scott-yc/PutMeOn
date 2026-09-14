import { trades } from '../../domain/trades';

export default function TradeOptions() {
  return (
    <>
      {trades.map((trade) => (
        <option key={trade} value={trade}>
          {trade}
        </option>
      ))}
    </>
  );
}
