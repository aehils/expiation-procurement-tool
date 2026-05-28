import { Spinner } from "@/components/ui/spinner";

export default function HomeLoading() {
  return (
    <div className="flex items-center justify-center h-full min-h-screen">
      <Spinner />
    </div>
  );
}
