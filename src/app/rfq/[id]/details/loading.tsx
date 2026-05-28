import { Spinner } from "@/components/ui/spinner";

export default function RfqDetailsLoading() {
  return (
    <div className="flex items-center justify-center h-full min-h-96">
      <Spinner />
    </div>
  );
}
