interface TransportBarProps {
  index:       number;
  frameCount:  number;
  timestampUs: number;
  playing:     boolean;
  onToggle:    () => void;
  onSeek:      (index: number) => void;
}

function formatTimestamp(timestampUs: number): string {
  // Seconds within the sequence are more useful than the raw epoch value.
  const seconds = timestampUs / 1_000_000;
  return `${seconds.toFixed(2)} s`;
}

export function TransportBar({
  index,
  frameCount,
  timestampUs,
  playing,
  onToggle,
  onSeek,
}: TransportBarProps) {
  return (
    <div className="transport-bar">
      <button
        className="transport-btn"
        onClick={onToggle}
        title={playing ? 'Pause' : 'Play'}
      >
        {playing ? '❚❚' : '▶'}
      </button>

      <input
        className="transport-scrubber"
        type="range"
        min={0}
        max={Math.max(0, frameCount - 1)}
        value={index}
        onChange={e => onSeek(Number(e.target.value))}
      />

      <div className="transport-readout">
        <span className="transport-frame">
          {index + 1} / {frameCount}
        </span>
        <span className="transport-time panel-mono">{formatTimestamp(timestampUs)}</span>
      </div>
    </div>
  );
}
