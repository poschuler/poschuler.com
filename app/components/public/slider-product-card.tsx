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

type SliderProductCardProps = {
  product: InventoryMasterProduct;
};

export function SliderProductCard({ product }: SliderProductCardProps) {
  return (
    <Card className="w-[250px] h-[310px] text-xs group rounded-lg">
      <CardBody className={clsx("p-0 flex flex-col h-full")}>
        <Header product={product} />
        <Content product={product} />
      </CardBody>
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

  const eventObject = {
    productNameSlug: product.productNameSlug,
    brandNameSlug: product.brandNameSlug,
    departmentNameSlug: product.departmentNameSlug,
    categoryNameSlug: product.categoryNameSlug,
    subCategoryNameSlug: product.subCategoryNameSlug,
  };

  const handleProductClick = useHandleClickProduct(eventObject);

  return (
    <>
      <div className="px-3 py-2 text-base flex-grow">
        <span
          className="font-quicksand hover:cursor-pointer hover:font-semibold transition-all duration-300"
          onClick={handleClickBrand}
        >
          {product.brandName}
        </span>
        <CardTitle
          className="font-quicksand font-semibold line-clamp-2 hover:cursor-pointer hover:font-bold transition-all duration-300"
          onClick={handleProductClick}
        >
          {product.productName}
        </CardTitle>
      </div>
      <div className="bg-ui py-1.5 px-6 space-y-2 text-sm min-h-15 flex flex-col justify-center">
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
