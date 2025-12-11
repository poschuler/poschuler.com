import clsx from "clsx";
import { Store } from "lucide-react";
import { InventoryProduct } from "~/architecture/master-products/domain/InventoryMasterProduct";
import { PlazaVeaPromoIcon, TottusPromoIcon } from "~/components/icons";
import {
  StoreIconCardHeader,
  StoreIconCardLink,
} from "~/components/common/store-icon";
import { Badge } from "~/components/ui/badge";
import { buttonVariants } from "~/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { METRO, PLAZA_VEA, TOTTUS, VIVANDA, WONG } from "~/utils/constants";
import { Chip } from "~/components/chekalo/Chip";
import { Link } from "react-router";
import { getButtonClassName } from "~/components/chekalo/Button";
import { AsyncImage } from "loadable-image";
import { Fade } from 'transitions-kit'

type InventoryProductProps = {
  idMasterProduct: string;
  inventoryProduct: InventoryProduct;
};

export function InventoryProductCard({
  inventoryProduct,
}: InventoryProductProps) {
  return (
    <Popover>
      <PopoverTrigger>
        <div
          className={clsx(
            "p-2 gap-2 border rounded-lg w-full h-full flex transition-all duration-500  items-center justify-between leading-none hover:scale-105 shadow",
            "border-muted hover:border-accent-foreground bg-transparent cursor-pointer"
          )}
        >
          <div className="flex justify-center items-center">
            <StoreIconCardLink
              name={inventoryProduct.store_name}
              isBestPrice={false}
            ></StoreIconCardLink>
          </div>
          <p className="font-normal">S/. {inventoryProduct.best_price}</p>
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-64 flex-col justify-between rounded-lg p-0 text-xs bg-subtle font-quicksand">
        <div className="relative mb-3 flex items-center justify-center rounded-t-lg p-3 bg-ui">
          {/* <img
            src={inventoryProduct.img_url}
            alt={inventoryProduct.product_name}
            width={96}
            height={96}
            className=" rounded-lg shadow-md"
            loading="lazy"
            //effect="blur"
          /> */}

          <AsyncImage
            src={inventoryProduct.img_url}
            alt={inventoryProduct.product_name}
            style={{
              width: 96,
              height: 96,
            }}
            Transition={Fade}
            loader={<div style={{ background: "#888" }} />}
            className=" rounded-lg shadow-md"
          />

          {/* <img
            src={inventoryProduct.img_url}
            alt={inventoryProduct.product_name}
            className="h-24 w-24 rounded-lg shadow-md"
          /> */}
          <StoreIconCardHeader name={inventoryProduct.store_name} />
        </div>
        <div className="">
          <div className="mb-3 space-y-1 px-2">
            <h4 className="font-semibold">{inventoryProduct.brand_name}</h4>
            <p className="font-bold tracking-tight text-balance">
              {inventoryProduct.product_name}
            </p>
          </div>
          <div className="mb-2 space-y-2">
            {inventoryProduct.promo_price && (
              <div className="flex justify-between items-center py-2 bg-ui px-2 border-t-[3px] border-t-blue-400 font-semibold">
                <div className="w-14 flex items-center gap-2">
                  Tarjeta
                  <PromoIcon storeName={inventoryProduct.store_name} />
                </div>
                <div className="flex items-center gap-2">
                  {`S/. ${inventoryProduct.promo_price}`}
                  {inventoryProduct.deal_promo_percentage &&
                    inventoryProduct.deal_promo_percentage !== "0.00" && (
                      <Chip
                        color="danger"
                        scale="sm"
                      >{`- ${inventoryProduct.deal_promo_percentage}%`}</Chip>
                    )}
                </div>
              </div>
            )}
            {inventoryProduct.sale_price && (
              <div className="flex justify-between items-center py-2 bg-ui px-2 border-t-[3px] border-t-green-400 font-semibold">
                <div className="w-14 flex items-center gap-2">Online</div>

                <div className="flex items-center gap-2  ">
                  {`S/. ${inventoryProduct.sale_price}`}
                  {inventoryProduct.deal_sale_percentage &&
                    inventoryProduct.deal_sale_percentage !== "0.00" && (
                      <Chip
                        color="danger"
                        scale="sm"
                      >{`- ${inventoryProduct.deal_sale_percentage}%`}</Chip>
                    )}
                </div>
              </div>
            )}
            {inventoryProduct.original_price && (
              <div
                className={clsx(
                  "flex justify-between items-center py-2 bg-ui px-2 border-t-[3px] border-t-orange-400 font-semibold"
                )}
              >
                <div className="w-14">Regular</div>
                {`S/. ${inventoryProduct.original_price}`}
              </div>
            )}
          </div>
          <div className="flex w-full items-center justify-center p-2">
            <Link
              to={inventoryProduct.product_url}
              className={clsx(
                getButtonClassName({ variant: "primary", size: "medium" }),
                "flex items-center"
              )}
              target="_blank"
              rel="noreferrer"
            >
              <Store className="size-4 mr-2" />
              Ver en tienda
            </Link>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

type PromoIconProps = {
  storeName: string;
};

function PromoIcon({ storeName }: PromoIconProps) {
  return (
    <>
      {storeName === PLAZA_VEA && <PlazaVeaPromoIcon className="h-3" />}

      {storeName === METRO && null}

      {storeName === TOTTUS && <TottusPromoIcon className="h-3" />}

      {storeName === VIVANDA && null}

      {storeName === WONG && null}
    </>
  );
}
