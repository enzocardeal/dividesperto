type AvatarProps = {
  name: string;
  url: string | null;
};

const BASE = "size-8 shrink-0 rounded-full border-2 border-white bg-neutral-200";

function initials(name: string) {
  const words = name.trim().split(/\s+/);
  const letters = words.length > 1 ? [words[0], words[words.length - 1]] : words;
  return letters.map((word) => [...word][0] ?? "").join("").toUpperCase();
}

export function Avatar({ name, url }: AvatarProps) {
  if (url) {
    return <img src={url} alt={name} referrerPolicy="no-referrer" className={`${BASE} object-cover`} />;
  }
  return (
    <span
      role="img"
      aria-label={name}
      className={`${BASE} flex items-center justify-center text-xs font-semibold text-neutral-700`}
    >
      {initials(name)}
    </span>
  );
}
