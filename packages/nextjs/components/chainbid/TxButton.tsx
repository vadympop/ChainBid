import { ComponentProps } from "react";

type TxButtonProps = ComponentProps<"button"> & {
  isLoading?: boolean;
  variant?: "primary" | "secondary";
};

const Spinner = ({ className }: { className: string }) => (
  <span className={`h-3.5 w-3.5 animate-spin rounded-full border-2 ${className}`} />
);

export const TxButton = ({
  isLoading,
  variant = "primary",
  className = "",
  children,
  disabled,
  ...props
}: TxButtonProps) => {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-xl text-sm font-semibold transition disabled:cursor-not-allowed";

  const variants = {
    primary: "bg-blue-600 px-5 py-2.5 font-bold text-white hover:bg-blue-500 disabled:opacity-50",
    secondary:
      "border border-white/10 bg-white/5 px-4 py-2 text-slate-300 hover:bg-white/10 hover:text-white disabled:opacity-40",
  };

  const spinnerClass =
    variant === "primary" ? "border-white/30 border-t-white" : "border-slate-400/30 border-t-slate-300";

  return (
    <button
      type="button"
      {...props}
      disabled={disabled || isLoading}
      className={`${base} ${variants[variant]} ${className}`}
    >
      {isLoading && <Spinner className={spinnerClass} />}
      {isLoading ? "Confirming…" : children}
    </button>
  );
};
