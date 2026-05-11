/* eslint-disable @next/next/no-img-element */
type ImageThumbnailGridProps = {
  images: string[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  className?: string;
};

export const ImageThumbnailGrid = ({ images, selectedIndex, onSelect, className = "" }: ImageThumbnailGridProps) => {
  if (images.length <= 1) return null;
  return (
    <div className={`grid grid-cols-5 gap-2 ${className}`}>
      {images.map((img, i) => (
        <button
          key={img}
          type="button"
          aria-label={`Show image ${i + 1}`}
          onClick={() => onSelect(i)}
          className={`aspect-square overflow-hidden rounded-xl border transition ${
            selectedIndex === i ? "border-blue-400" : "border-white/10 hover:border-white/30"
          }`}
        >
          <img src={img} alt={`Image ${i + 1}`} className="h-full w-full object-cover" />
        </button>
      ))}
    </div>
  );
};
