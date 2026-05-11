import { ComponentProps } from "react";
import { ChevronDownIcon } from "@heroicons/react/24/outline";

type Option = { label: string; value: string } | string;

type StyledSelectProps = Omit<ComponentProps<"select">, "children"> & {
  options: Option[];
  placeholder?: string;
};

export const StyledSelect = ({ options, placeholder, className, ...props }: StyledSelectProps) => (
  <div className="relative">
    <select
      {...props}
      className={`appearance-none cursor-pointer rounded-xl pr-9 text-sm text-white outline-none ${className ?? ""}`}
    >
      {placeholder && (
        <option value="" className="bg-[#0a1224]">
          {placeholder}
        </option>
      )}
      {options.map(opt => {
        const val = typeof opt === "string" ? opt : opt.value;
        const label = typeof opt === "string" ? opt : opt.label;
        return (
          <option key={val} value={val} className="bg-[#0a1224]">
            {label}
          </option>
        );
      })}
    </select>
    <ChevronDownIcon className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
  </div>
);
