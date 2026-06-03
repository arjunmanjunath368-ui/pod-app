export default function Avatar({
  url,
  initials,
  color,
  size = 40,
  className = "",
}: {
  url?: string | null;
  initials: string;
  color: string;
  size?: number;
  className?: string;
}) {
  if (url) {
    return (
      <img
        src={url}
        alt=""
        className={`shrink-0 rounded-full object-cover ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full font-semibold text-white ${className}`}
      style={{
        width: size,
        height: size,
        backgroundColor: color,
        fontSize: Math.round(size * 0.36),
      }}
    >
      {initials}
    </div>
  );
}
