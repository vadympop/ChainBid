import React from "react";
import { Toast, ToastPosition, toast } from "react-hot-toast";
import { XMarkIcon } from "@heroicons/react/20/solid";
import {
  CheckCircleIcon,
  ExclamationCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
} from "@heroicons/react/24/solid";

type NotificationProps = {
  content: React.ReactNode;
  status: "success" | "info" | "loading" | "error" | "warning";
  duration?: number;
  icon?: string;
  position?: ToastPosition;
};

type NotificationOptions = {
  duration?: number;
  icon?: string;
  position?: ToastPosition;
};

const ENUM_STATUSES = {
  success: <CheckCircleIcon className="w-5 shrink-0 text-emerald-400" />,
  loading: <span className="w-5 h-5 shrink-0 animate-spin rounded-full border-2 border-white/20 border-t-white" />,
  error: <ExclamationCircleIcon className="w-5 shrink-0 text-red-400" />,
  info: <InformationCircleIcon className="w-5 shrink-0 text-blue-400" />,
  warning: <ExclamationTriangleIcon className="w-5 shrink-0 text-amber-400" />,
};

const DEFAULT_DURATION = 3000;
const DEFAULT_POSITION: ToastPosition = "top-center";

/**
 * Custom Notification
 */
const Notification = ({
  content,
  status,
  duration = DEFAULT_DURATION,
  icon,
  position = DEFAULT_POSITION,
}: NotificationProps) => {
  return toast.custom(
    (t: Toast) => (
      <div
        className={`relative flex w-full max-w-sm items-start gap-3 rounded-xl border border-white/10 bg-[#0d1829] px-4 py-3 shadow-lg transform-gpu transition-all duration-500 ease-in-out
        ${
          position.substring(0, 3) === "top"
            ? `hover:translate-y-1 ${t.visible ? "top-0" : "-top-96"}`
            : `hover:-translate-y-1 ${t.visible ? "bottom-0" : "-bottom-96"}`
        }`}
      >
        <div className="mt-0.5 shrink-0">{icon ? icon : ENUM_STATUSES[status]}</div>
        <div className="min-w-0 flex-1 overflow-x-hidden break-words whitespace-pre-line text-sm text-slate-200">
          {content}
        </div>
        <button className="shrink-0 text-slate-500 transition hover:text-white" onClick={() => toast.remove(t.id)}>
          <XMarkIcon className="w-4" />
        </button>
      </div>
    ),
    {
      duration: status === "loading" ? Infinity : duration,
      position,
    },
  );
};

export const notification = {
  success: (content: React.ReactNode, options?: NotificationOptions) => {
    return Notification({ content, status: "success", ...options });
  },
  info: (content: React.ReactNode, options?: NotificationOptions) => {
    return Notification({ content, status: "info", ...options });
  },
  warning: (content: React.ReactNode, options?: NotificationOptions) => {
    return Notification({ content, status: "warning", ...options });
  },
  error: (content: React.ReactNode, options?: NotificationOptions) => {
    return Notification({ content, status: "error", ...options });
  },
  loading: (content: React.ReactNode, options?: NotificationOptions) => {
    return Notification({ content, status: "loading", ...options });
  },
  remove: (toastId: string) => {
    toast.remove(toastId);
  },
};
