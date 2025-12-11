import { Link, useLocation, useNavigate } from "react-router";
import clsx from "clsx";
import { Eye, Heart, ListPlus, Plus, ShoppingBasket } from "lucide-react";
import { useState } from "react";
import { useTypedFetcher } from "remix-typedjson";
import slug from "slug";
import { InventoryMasterProduct } from "~/architecture/master-products/domain/InventoryMasterProduct";
import { ShoppingList } from "~/architecture/shopping-lists/domain/ShoppingList";
import { InventoryProductCard } from "~/components/app/inventory-product-card";
import {
  Card,
  CardBody,
  CardFooter,
  CardTitle,
} from "~/components/chekalo/Card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { ScrollArea } from "~/components/ui/scroll-area";
import { Separator } from "~/components/ui/separator";
import { ToastAction } from "~/components/ui/toast";
import { useToast } from "~/components/ui/use-toast";
//import pkg from 'react-lazy-load-image-component';
//const { LazyLoadImage } = pkg;
import { Chip } from "~/components/chekalo/Chip";
import { Button, getButtonClassName } from "~/components/chekalo/Button";
import { IconButton } from "~/components/chekalo/IconButton";
import BigCardShareButton from "~/components/big-card-share-button";
import { Fade } from "transitions-kit";
import { AsyncImage } from "loadable-image";
import { useServerLayoutEffect } from "~/utils/use-server-layout-effect";

type ProductCardProps = {
  product: InventoryMasterProduct;
  shoppingLists: ShoppingList[];
};

export function ProductCard({ product, shoppingLists }: ProductCardProps) {
  const changeFavoriteStateFetcher = useTypedFetcher<any>({
    key: `not-loading-changeFavoriteStateFetcher`,
  });

  const location = useLocation();
  const isFavoritePage = location.pathname === "/app/productos/favoritos";

  const isRemovingFavorite =
    changeFavoriteStateFetcher.formData?.get("_action") === "removeFavorite" &&
    changeFavoriteStateFetcher.formData?.get("idMasterProduct") ===
      product.idMasterProduct.toString() &&
    isFavoritePage;

  return (
    !isRemovingFavorite && (
      <Card className="flex w-[320px] flex-col justify-between text-xs group rounded-lg break-inside-avoid mb-4">
        <CardBody className={clsx("p-0")}>
          <Header product={product} />
          <Content product={product} />
        </CardBody>
        <CardFooter className="px-0 py-2">
          <Footer product={product} shoppingLists={shoppingLists} />
        </CardFooter>
      </Card>
    )
  );
}

type HeaderProps = {
  product: InventoryMasterProduct;
};

function Header({ product }: HeaderProps) {
  const [productState, setProductState] = useState(product);

  //eslint-disable-next-line
  const changeFavoriteStateFetcher = useTypedFetcher<any>({
    key: `not-loading-changeFavoriteStateFetcher`,
  });

  const { toast } = useToast();

  const isChangingFavoriteState =
    (changeFavoriteStateFetcher.formData?.get("_action") === "addFavorite" ||
      changeFavoriteStateFetcher.formData?.get("_action") ===
        "removeFavorite") &&
    changeFavoriteStateFetcher.formData?.get("idMasterProduct") ===
      product.idMasterProduct.toString();

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

        setProductState({
          ...productState,
          isFavorite: !productState.isFavorite,
        });
      }
    }
  }, [changeFavoriteStateFetcher, toast]);

  return (
    <div className="relative flex items-center justify-center rounded-t-lg p-3 bg-ui">
      <Link
        to={`/app/${slug(
          `${product.idMasterProduct} ${product.productName}`
        )}/p`}
        aria-label={product.productName}
      >
        {/* <img
          src={product.imgUrl}
          alt={product.productName}
          width={144}
          height={144}
          className="rounded-lg group-hover:scale-105 transition-all duration-700"
          loading="lazy"
          //effect="blur"
        /> */}

        <AsyncImage
          src={product.imgUrl}
          alt={product.productName}
          style={{
            width: 144,
            height: 144,
          }}
          Transition={Fade}
          loader={<div style={{ background: "#888" }} />}
          className="rounded-lg group-hover:scale-105 transition-all duration-700"
        />

        {/* <img
          src={product.imgUrl}
          alt={product.productName}
          className="h-36 w-36 rounded-lg group-hover:scale-105 transition-all duration-700"
        /> */}
      </Link>

      <changeFavoriteStateFetcher.Form className="absolute bottom-1 right-1">
        <IconButton
          isDisabled={isChangingFavoriteState}
          onPress={() => {
            //e.preventDefault();
            changeFavoriteStateFetcher.submit(
              {
                _action: productState.isFavorite
                  ? "removeFavorite"
                  : "addFavorite",
                idMasterProduct: productState.idMasterProduct,
              },
              { method: "post" }
            );

            setProductState({
              ...productState,
              isFavorite: !productState.isFavorite,
            });
          }}
        >
          <Heart
            className={clsx(
              `transition-all duration-700`,
              productState.isFavorite
                ? `stroke-1 stroke-red-600 fill-red-600 ${
                    !isChangingFavoriteState && ``
                  }`
                : `stroke-1 fill-transparent ${!isChangingFavoriteState && ``}`
            )}
          />
        </IconButton>
        {/* <Button
          variant={"ghost"}
          size={"icon"}
          className="group outline-none hover:bg-transparent disabled:opacity-100"
          disabled={isChangingFavoriteState}
          onClick={(e) => {
            e.preventDefault();
            changeFavoriteStateFetcher.submit(
              {
                _action: productState.isFavorite
                  ? "removeFavorite"
                  : "addFavorite",
                idMasterProduct: productState.idMasterProduct,
              },
              { method: "post" }
            );

            setProductState({
              ...productState,
              isFavorite: !productState.isFavorite,
            });
          }}
        >
          <Heart
            className={clsx(
              `size-6 transition-all duration-700`,
              productState.isFavorite
                ? `stroke-1 stroke-red-600 fill-red-600 ${!isChangingFavoriteState && ``}`
                : `stroke-1 fill-transparent ${!isChangingFavoriteState && ``}`
            )}
          />
        </Button> */}
      </changeFavoriteStateFetcher.Form>
    </div>
  );
}

type ContentProps = {
  product: InventoryMasterProduct;
};

function Content({ product }: ContentProps) {
  return (
    <>
      <div className="relative flex flex-col gap-1 px-3 py-2 text-base">
        <div className="flex w-full">
          <span className="font-quicksand">{product.brandName}</span>
        </div>
        <CardTitle className="font-quicksand font-semibold">
          {product.productName}
        </CardTitle>
      </div>
      <div className="bg-ui py-[5px] px-6 space-y-1 text-sm">
        <div className="flex justify-center gap-2 items-center font-quicksand font-semibold">
          Mejor precio&nbsp;:&nbsp;
          <span className="font-bold">S./ {`${product.bestPrice}`}</span>
        </div>

        {product.bestPricePercentage &&
          product.bestPricePercentage !== "0.00" && (
            <div className="flex justify-center gap-2 items-center font-quicksand">
              <Chip
                color="danger"
                scale="md"
              >{`- ${product.bestPricePercentage}%`}</Chip>
            </div>
          )}
      </div>

      <div className={clsx("flex flex-col pt-2 font-light")}>
        <div className="px-3">
          <div className="flex pb-1 font-quicksand font-semibold text-base">
            Cheka las opciones:
          </div>
        </div>

        <div className="flex flex-wrap gap-2 px-2 pb-2 justify-evenly">
          {product.inventoryProducts.map((item) => {
            return (
              <InventoryProductCard
                key={`${product.idMasterProduct}${item.id_product}`}
                idMasterProduct={product.idInventoryMasterProduct}
                inventoryProduct={item}
              />
            );
          })}
        </div>
      </div>
    </>
  );
}

type FooterProps = {
  product: InventoryMasterProduct;
  shoppingLists: ShoppingList[];
};

function Footer({ product, shoppingLists }: FooterProps) {
  const navigate = useNavigate();
  const { toast } = useToast();

  const addToShoppingListFetcher = useTypedFetcher<any>({
    key: `not-loading-addToShoppingListFetcher`,
  });

  const [popoverOpen, setPopoverOpen] = useState(false);

  return (
    <div className="flex justify-evenly">
      <BigCardShareButton
        idMasterProduct={product.idMasterProduct}
        productName={product.productName}
      />
      <Link
        className={clsx(
          getButtonClassName({ variant: "github", size: "medium" }),
          "flex items-center"
        )}
        to={`/app/${slug(
          `${product.idMasterProduct} ${product.productName}`
        )}/p`}
        aria-label={product.productName}
      >
        <Eye className="mr-2" size={15} />
        Detalles
      </Link>

      {shoppingLists.length == 0 && (
        <Button
          variant={"google"}
          className={"flex items-center justify-center"}
          onPress={() => {
            toast({
              title: "No tienes listas de compras.",
              action: (
                <ToastAction
                  altText="Ir a mis listas"
                  onClick={() => {
                    navigate("/app/shopping-lists");
                  }}
                >
                  <ShoppingBasket className="size-4 mr-2" /> Tus listas
                </ToastAction>
              ),
              variant: "default",
            });
          }}
        >
          <ListPlus className="size-4" />
        </Button>
      )}

      {shoppingLists.length > 0 && (
        <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
          <PopoverTrigger asChild>
            <Button
              variant={"google"}
              className={"flex items-center justify-center"}
            >
              <ListPlus className="size-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-52 bg-subtle">
            <ScrollArea className="h-32">
              <div className="">
                <h4 className="mb-4 text-xs font-medium leading-none">
                  Agregar a lista
                </h4>
                {shoppingLists.map((item) => (
                  <div
                    key={`${
                      product.idInventoryMasterProduct
                    }${item.idShoppingList.toString()}`}
                  >
                    <div className="flex flex-row justify-between items-center">
                      <div className="text-xs">{item.name}</div>

                      <IconButton
                        color="neutral"
                        variant="contained"
                        onPress={() => {
                          addToShoppingListFetcher.submit(
                            {
                              _action: "addToShoppingList",
                              idShoppingList:
                                item.idShoppingList?.toString() ?? "-1",
                              idMasterProduct:
                                product.idMasterProduct?.toString() ?? "-1",
                            },
                            { method: "post" }
                          );
                          setPopoverOpen(false);
                        }}
                      >
                        <Plus className="size-4" />
                      </IconButton>

                      {/* <Button size={"icon"} variant={"ghost"} onClick={() => {
                        addToShoppingListFetcher.submit(
                          {
                            _action: "addToShoppingList",
                            idShoppingList:
                              item.idShoppingList?.toString() ?? "-1",
                            idMasterProduct:
                              product.idMasterProduct?.toString() ??
                              "-1",
                          },
                          { method: "post" }
                        );
                        setPopoverOpen(false);
                      }}>

                      </Button> */}
                    </div>
                    <Separator className="my-1" />
                  </div>
                ))}
              </div>
            </ScrollArea>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
