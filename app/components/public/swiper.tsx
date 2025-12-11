import { useLocation } from "react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { lazy, Suspense } from "react";
import { Theme, useTheme } from "remix-themes";
import { InventoryMasterProduct } from "~/architecture/master-products/domain/InventoryMasterProduct";
import { SkeletonProductCard } from "~/components/public/skeleton-product-card";

const LazyProduct = lazy(() => import("~/components/public/product-card").then((module) => ({ default: module.ProductCard })));

type SwiperProps = {
    products: InventoryMasterProduct[];
    index: number;
}

export default function Swiper({ products, index }: SwiperProps) {
    const [theme] = useTheme();
    const location = useLocation();

    return (
        <div className={`relative`} key={location.key}>
            <swiper-container
                navigation="true"
                pagination="true"
                navigation-next-el={`.custom-next-button-${index}`}
                navigation-prev-el={`.custom-prev-button-${index}`}
                //swiper-pagination=".swiper-pagination"
                //pagination-dynamic-bullets="true"
                //pagination-clickable="true"
                //pagination-dynamic-bullets="true"
                virtual="true"
                style={
                    {
                        "--swiper-pagination-bullet-inactive-color": theme === Theme.DARK ? "#fff" : "#000",
                        "--swiper-pagination-bullet-size": "9px",
                    }
                }
                breakpoints={
                    JSON.stringify({
                        900: {
                            slidesPerView: 2,
                            spaceBetween: 5,
                        },

                        1200: {
                            slidesPerView: 3,
                            spaceBetween: 5,
                        },
                        1500: {
                            slidesPerView: 4,
                            spaceBetween: 5,
                        },
                        1800: {
                            slidesPerView: 5,
                            spaceBetween: 5,
                        },
                        2100: {
                            slidesPerView: 6,
                            spaceBetween: 5,
                        }
                    })}
            >
                {
                    products.map((product) => (

                        <swiper-slide
                            key={product.idMasterProduct}
                            style={{
                                display: "flex",
                                justifyContent: "center",
                            }}
                        >
                            <Suspense fallback={<SkeletonProductCard />} >
                                <LazyProduct
                                    product={product}
                                />
                            </Suspense>
                        </swiper-slide>

                    ))
                }

                <div slot="container-end" className="bg-transparent h-12"></div>

            </swiper-container>



            <div className={`nav-btn custom-prev-button text-primary hover:bg-transparent hover:text-primary custom-prev-button-${index}`} >
                <ChevronLeft className="h-8 w-8" />
            </div>

            <div className={`nav-btn custom-next-button text-primary hover:bg-transparent hover:text-primary custom-next-button-${index}`}>
                <ChevronRight className="h-8 w-8" />
            </div>
        </div >


    )
}


export function SwiperSkeleton() {
    return (
        <div
            className="grid grid-cols-1 min-[900px]:grid-cols-2 min-[1200px]:grid-cols-3 min-[1500px]:grid-cols-4 min-[1800px]:grid-cols-5 min-[2100px]:grid-cols-6 content-evenly items-center justify-evenly justify-items-center">
            <SkeletonProductCard />
            <SkeletonProductCard className="hidden min-[900px]:flex" />
            <SkeletonProductCard className="hidden min-[1200px]:flex" />
            <SkeletonProductCard className="hidden min-[1500px]:flex" />
            <SkeletonProductCard className="hidden min-[1800px]:flex" />
            <SkeletonProductCard className="hidden min-[2100px]:flex" />
        </div>
    )
}