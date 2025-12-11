import { useNavigate } from "react-router";
import { ChevronLeft } from "lucide-react";
import { Button } from "~/components/ui/button";

export function FloatGoBackNavigationButton() {
  const navigate = useNavigate();
  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="fixed bottom-4 right-4 flex h-12 w-12 items-center justify-center whitespace-nowrap rounded-full border border-input bg-background text-sm font-medium shadow-2xl ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
        onClick={() => navigate(-1)}
      >
        <ChevronLeft className="size-5" />
      </Button>
    </>
  );
}
