/* eslint-disable @next/next/no-img-element */
import { useEffect, useMemo } from "react";

type ImageUploaderProps = {
  files: File[];
  onChange: (files: File[]) => void;
  disabled?: boolean;
};

const MAX_IMAGE_COUNT = 5;

const getFileKey = (file: File) => `${file.name}-${file.size}-${file.lastModified}`;

export const ImageUploader = ({ files, onChange, disabled }: ImageUploaderProps) => {
  const previews = useMemo(
    () =>
      files.map(file => ({
        file,
        key: getFileKey(file),
        url: URL.createObjectURL(file),
      })),
    [files],
  );

  useEffect(() => {
    return () => {
      previews.forEach(preview => URL.revokeObjectURL(preview.url));
    };
  }, [previews]);

  const addFiles = (selectedFiles: FileList | null) => {
    if (!selectedFiles) return;

    const existingKeys = new Set(files.map(getFileKey));
    const nextFiles = [...files];

    for (const file of Array.from(selectedFiles)) {
      if (nextFiles.length >= MAX_IMAGE_COUNT) break;
      const fileKey = getFileKey(file);
      if (existingKeys.has(fileKey)) continue;
      existingKeys.add(fileKey);
      nextFiles.push(file);
    }

    onChange(nextFiles);
  };

  const removeFile = (fileKey: string) => {
    onChange(files.filter(file => getFileKey(file) !== fileKey));
  };

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
          onChange={event => {
            addFiles(event.target.files);
            event.target.value = "";
          }}
          type="file"
        />
      </label>

      {previews.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {previews.map(({ file, key, url }) => (
            <div key={key} className="overflow-hidden rounded-lg border border-white/10 bg-white/5">
              <div className="relative">
                <img src={url} alt={file.name} className="aspect-square w-full object-cover" />
                <button
                  className="btn btn-circle btn-xs absolute right-1.5 top-1.5 border-white/10 bg-slate-950/80 text-white"
                  disabled={disabled}
                  onClick={() => removeFile(key)}
                  type="button"
                >
                  x
                </button>
              </div>
              <div className="truncate px-2 py-1 text-xs text-slate-400">{file.name}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
