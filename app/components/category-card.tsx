import { Heart } from "lucide-react";
import { useState } from "react";
import { useTypedFetcher } from "remix-typedjson";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { useToast } from "~/components/ui/use-toast";
import { cn } from "~/lib/utils";
import { useServerLayoutEffect } from "~/utils/misc";

export type CategoryCardType = {
  idMasterCategory: number;
  name: string;
  isFavorite: boolean;
};

type CategoryCardProps = {
  category: CategoryCardType;
  className?: string;
};

export function AppCategoryCard({ category }: CategoryCardProps) {
  const changeFavoriteStateFetcher = useTypedFetcher<any>();
  const [categoryState, setCategoryState] = useState(category);
  const { toast } = useToast();

  const isChangingFavoriteState =
    (changeFavoriteStateFetcher.formData?.get("_action") ===
      "addFavoriteMasterCategory" ||
      changeFavoriteStateFetcher.formData?.get("_action") ===
      "removeFavoriteMasterCategory") &&
    changeFavoriteStateFetcher.formData?.get("idMasterCategory") ===
    category.idMasterCategory.toString();

  useServerLayoutEffect(() => {
    if (changeFavoriteStateFetcher.state === "idle") {
      if (
        changeFavoriteStateFetcher?.data?.error &&
        changeFavoriteStateFetcher?.data?.toast
      ) {
        toast({
          variant: "destructive",
          title: "Algo salió mal.",
          description: changeFavoriteStateFetcher.data?.error?.message,
        });

        setCategoryState({
          ...categoryState,
          isFavorite: !categoryState.isFavorite,
        });
      }
    }
  }, [changeFavoriteStateFetcher, toast]);

  return (
    <Card
      className={cn(
        "flex w-[200px] flex-col justify-between rounded-md shadow-lg",
        "cursor-pointer transition-all duration-500",

        "group",
        "hover:scale-110 hover:border-primary",
        "dark:border-2",
      )}
      onClick={(e) => {
        changeFavoriteStateFetcher.submit(
          {
            _action: categoryState.isFavorite
              ? "removeFavoriteMasterCategory"
              : "addFavoriteMasterCategory",
            idMasterCategory: categoryState.idMasterCategory,
          },
          { method: "post" },
        );

        setCategoryState({
          ...categoryState,
          isFavorite: !categoryState.isFavorite,
        });
      }}
    >
      {/* <CardHeader>
        <CardTitle>Nombre Categoría</CardTitle>
      </CardHeader> */}

      <CardContent className={cn("p-0")}>
        <div className="relative flex items-center justify-center space-x-4 p-5 pb-6">
          <p className="text-center text-sm font-medium capitalize leading-none transition-all duration-300 group-hover:text-primary">
            {category.name.toLowerCase()}
          </p>

          <Button
            variant={"secondary"}
            size={"icon"}
            disabled={isChangingFavoriteState}
            className={cn(
              `absolute -bottom-[13px] left-[70px]`,
              `size-7 rounded-full`,
              `shadow-sm shadow-muted-foreground dark:shadow-none`,
              `transition-all duration-300`,
              //"group-hover:bg-background",
              "group-hover:border-[2px]",
              "disabled:opacity-100",
              //`group-hover:border-primary`,
            )}
          >
            <Heart
              className={cn(
                `size-4 fill-transparent transition-all duration-700`,
                categoryState.isFavorite
                  ? //? `fill-red-700 ${!isChangingFavoriteState && `group-hover:fill-transparent`}`
                  `fill-red-700 ${!isChangingFavoriteState && ``}`
                  : //: `fill-transparent ${!isChangingFavoriteState && `group-hover:fill-red-700`}`,
                  `fill-transparent ${!isChangingFavoriteState && ``}`,
              )}
            />
          </Button>
        </div>

        {/* <div className="relative flex items-center justify-center rounded-t-xl">
          <img
            src={`https://img.freepik.com/foto-gratis/productos-lacteos-mesa-madera_144627-42474.jpg?size=626&ext=jpg`}
            alt={"img"}
            className="h-48 w-48 rounded-lg shadow-md"
          />
        </div>

        <div className="relative flex flex-col p-2">
          <div className="flex items-center justify-end">
            <Button
              variant={"ghost"}
              size={"icon"}
              className="group outline-none hover:bg-transparent disabled:opacity-100"
            >
              <Heart className={cn(`size-6 transition-colors duration-200 `)} />
            </Button>
          </div>
        </div> */}
      </CardContent>
    </Card>
  );
}
