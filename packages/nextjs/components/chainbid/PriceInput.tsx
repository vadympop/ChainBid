import { chainBidFieldClass } from "~~/utils/chainbid/styles";

type PriceInputProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  hint?: string;
};

export const PriceInput = ({ label, value, onChange, placeholder = "0.1", disabled, hint }: PriceInputProps) => (
  <label className="form-control w-full">
    <span className="label-text text-slate-300">{label}</span>
    <div className="join w-full">
      <input
        className={`input join-item input-bordered w-full border-white/10 bg-slate-950/70 text-white placeholder:text-slate-600 ${chainBidFieldClass}`}
        disabled={disabled}
        inputMode="decimal"
        min="0"
        onChange={event => onChange(event.target.value)}
        placeholder={placeholder}
        step="any"
        type="number"
        value={value}
      />
      <span className="join-item flex items-center border border-white/10 bg-white/5 px-4 text-sm font-semibold text-slate-300">
        ETH
      </span>
    </div>
    {hint && <span className="label-text-alt mt-1 text-slate-500">{hint}</span>}
  </label>
);
