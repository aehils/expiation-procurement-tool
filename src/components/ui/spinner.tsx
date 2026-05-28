export function Spinner() {
  return (
    <div
      className="animate-spin"
      style={{
        width: 34,
        height: 34,
        borderRadius: "50%",
        border: "3px solid hsl(var(--muted))",
        borderTopColor: "hsl(var(--primary))",
        animationDuration: "1.1s",
      }}
    />
  );
}
