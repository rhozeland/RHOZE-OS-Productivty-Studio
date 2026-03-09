interface SmartboardBackgroundProps {
  color: string | null;
  url: string | null;
  blur: number;
  opacity: number;
  children: React.ReactNode;
  className?: string;
}

const SmartboardBackground = ({
  color,
  url,
  blur,
  opacity,
  children,
  className = "",
}: SmartboardBackgroundProps) => {
  const hasBackground = color || url;

  return (
    <div className={`relative ${className}`} style={{ background: !url && color ? color : undefined }}>
      {url && (
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: `url(${url})`,
            filter: `blur(${blur}px)`,
            opacity: opacity / 100,
          }}
        />
      )}
      <div className="relative z-10">{children}</div>
    </div>
  );
};

export default SmartboardBackground;
