import clsx from "clsx";
import { Card, CardContent, CardFooter, CardTitle } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";

type SkeletonProductCardProps = {
  className?: string;
};

export function SkeletonProductCard({ className }: SkeletonProductCardProps) {
  return (
    <Card className={clsx("flex h-[550px] w-[320px] flex-col justify-between text-xs group rounded-lg", className)}>
      <CardContent className={clsx("p-0")}>
        <Header />
        <Content />
      </CardContent>
      <CardFooter className="flex flex-col px-2 pb-2 pt-0">
        <Footer />
      </CardFooter>
    </Card>
  );
}

function Header() {
  return (
    <div className="relative flex items-center justify-center rounded-t-lg p-3 bg-muted/40">
      <Skeleton className="h-36 w-36 rounded-lg group-hover:scale-105 transition-all duration-700" />
    </div>
  );
}

function Content() {
  return (
    <>
      <div className="relative flex flex-col gap-1 px-3 py-2 h-[70px]">
        <div className="flex w-full">
          <Skeleton className="w-1/2 h-4" />
        </div>
        <CardTitle className="line-clamp-2 leading-4">
          <Skeleton className="w-3/4 h-4" />
        </CardTitle>
      </div>
      <div className="bg-muted py-[10px] px-6 border-t-[3px] border-t-accent-foreground group-hover:border-t-primary transition-all duration-700 space-y-1">
        <div className="flex justify-center gap-2 items-center">
          <Skeleton className="w-1/2 h-4" />
        </div>
      </div>

      <div className={clsx("flex flex-col pt-2 font-light")}>

        <div className="px-3">
          <Skeleton className="w-full h-4" />
        </div>

        <div className="grid grid-cols-3 gap-2 px-2 py-1 mt-1">
          <Skeleton className="w-full h-20" />
          <Skeleton className="w-full h-20" />
          <Skeleton className="w-full h-20" />
          <Skeleton className="w-full h-20" />
          <Skeleton className="w-full h-20" />
          <Skeleton className="w-full h-20" />
        </div>
      </div>
    </>
  );
}

function Footer() {

  return (
    <div className="flex w-full items-center justify-between space-x-2">
      <Skeleton className="w-full h-14" />
    </div >
  );
}
