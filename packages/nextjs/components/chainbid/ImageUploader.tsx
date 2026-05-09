/* eslint-disable @next/next/no-img-element */

type ImageUploaderProps = {
  files: File[];
  onChange: (files: File[]) => void;
  disabled?: boolean;
};

export const ImageUploader = ({ files, onChange, disabled }: ImageUploaderProps) => {
  const previews = files.map(file => ({
    file,
    url: URL.createObjectURL(file),
  }));

  return (
    <div className="space-y-3">
      <label className="flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-blue-400/40 bg-blue-500/5 px-4 py-8 text-center hover:bg-blue-500/10">
        <span className="text-sm font-semibold text-blue-100">Upload 1-5 item images</span>
        <span className="mt-1 text-xs text-slate-500">PNG, JPG, GIF, or WebP. Metadata is pinned server-side.</span>
        <input
          accept="image/*"
          className="hidden"
          disabled={disabled}
          multiple
          onChange={event => onChange(Array.from(event.target.files || []).slice(0, 5))}
          type="file"
        />
      </label>

      {previews.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {previews.map(({ file, url }) => (
            <div
              key={`${file.name}-${file.size}`}
              className="overflow-hidden rounded-lg border border-white/10 bg-white/5"
            >
              <img src={url} alt={file.name} className="aspect-square w-full object-cover" />
              <div className="truncate px-2 py-1 text-xs text-slate-400">{file.name}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
