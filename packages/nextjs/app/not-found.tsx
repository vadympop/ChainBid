import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-1 items-center justify-center bg-[#05070d]">
      <div className="text-center">
        <p className="m-0 text-8xl font-bold text-white/5 select-none">404</p>
        <h2 className="m-0 -mt-6 text-2xl font-semibold text-white">Page Not Found</h2>
        <p className="m-0 mb-6 mt-2 text-sm text-slate-500">The page you&apos;re looking for doesn&apos;t exist.</p>
        <Link href="/" className="btn btn-primary">
          Go Home
        </Link>
      </div>
    </div>
  );
}
