import { Link, useNavigate } from "react-router";
import clsx from "clsx";
import slug from "slug";
import { InventoryProductCard } from "~/components/public/inventory-product-card";
import BigCardShareButton from "~/components/big-card-share-button";
import { AsyncImage } from "loadable-image";

import {
  Card,
  CardBody,
  CardFooter,
  CardTitle,
} from "~/components/chekalo/Card";
import { Button, getButtonClassName } from "~/components/chekalo/Button";
import { Eye } from "lucide-react";
import { Chip } from "~/components/chekalo/Chip";
import { Fade } from "transitions-kit";
import type { InventoryMasterProduct } from "~/features/common/types/inventory-master-product";
import { useHandleClickProduct } from "~/utils/use-handle-click-product";
import { useHandleClickBrand } from "~/utils/use-handle-click-brand";

type ProductCardProps = {
  product: InventoryMasterProduct;
};

export function ProductCard({ product }: ProductCardProps) {
  return (
    <Card className="flex w-[320px] flex-col justify-between text-xs group rounded-lg mb-4">
      <CardBody className={clsx("p-0")}>
        <Header product={product} />
        <Content product={product} />
      </CardBody>
      <CardFooter className="px-0 py-2">
        <Footer product={product} />
      </CardFooter>
    </Card>
  );
}

type HeaderProps = {
  product: InventoryMasterProduct;
};

function Header({ product }: HeaderProps) {
  const eventObject = {
    productNameSlug: product.productNameSlug,
    brandNameSlug: product.brandNameSlug,
    departmentNameSlug: product.departmentNameSlug,
    categoryNameSlug: product.categoryNameSlug,
    subCategoryNameSlug: product.subCategoryNameSlug,
  };

  const handleClick = useHandleClickProduct(eventObject);

  return (
    <div className="relative flex items-center justify-center rounded-t-lg p-3 bg-ui">
      {/* <Link
        to={`/${product.productNameSlug}/p`}
        aria-label={product.productName}
      > */}
      <AsyncImage
        src={product.imgUrl}
        alt={product.productName}
        style={{
          width: 120,
          height: 120,
        }}
        Transition={Fade}
        loader={<div style={{ background: "#888" }} />}
        className="rounded-lg group-hover:scale-105 transition-all duration-700 cursor-pointer"
        onClick={handleClick}
      />

      {/* <img
          src={product.imgUrl}
          alt={product.productName}
          className="h-36 w-36 rounded-lg group-hover:scale-105 transition-all duration-700"
          loading="lazy"
        /> */}
      {/* </Link> */}
    </div>
  );
}

type ContentProps = {
  product: InventoryMasterProduct;
};

function Content({ product }: ContentProps) {
  const brandEventObject = {
    brandNameSlug: product.brandNameSlug,
  };

  const handleClickBrand = useHandleClickBrand(brandEventObject);

  return (
    <>
      <div className="relative flex flex-col gap-1 px-3 py-2 text-base">
        <div className="flex w-full">
          {/* <Link
            to={`/marca/${product.brandNameSlug}`}
            aria-label={product.brandName}
          > */}
          <span
            className="font-quicksand hover:cursor-pointer"
            onClick={handleClickBrand}
          >
            {product.brandName}
          </span>
          {/* </Link> */}
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
                key={`${product.idInventoryMasterProduct}${item.id_product}`}
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
};

function Footer({ product }: FooterProps) {
  const eventObject = {
    productNameSlug: product.productNameSlug,
    brandNameSlug: product.brandNameSlug,
    departmentNameSlug: product.departmentNameSlug,
    categoryNameSlug: product.categoryNameSlug,
    subCategoryNameSlug: product.subCategoryNameSlug,
  };

  const handleClick = useHandleClickProduct(eventObject);

  return (
    <div className="flex justify-evenly">
      <BigCardShareButton
        idInventoryMasterProduct={product.idInventoryMasterProduct}
        productNameSlug={slug(product.productNameSlug)}
        productName={product.productName}
      />

      <Button
        variant="secondary"
        size="medium"
        className={"flex items-center"}
        onPress={handleClick}
      >
        <Eye className="mr-2" size={15} />
        Detalles
      </Button>
    </div>
  );
}
