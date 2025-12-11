import { useMediaQuery } from "usehooks-ts";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "~/components/ui/pagination";
import { type PageMetaDto } from "~/types/pagination.type";
import { useBuildSearchParams } from "~/utils/use-build-search-params";

type ProductPaginationProps = {
  page: PageMetaDto;
};

export function ProductPagination({ page }: ProductPaginationProps) {
  const buildSearchParams = useBuildSearchParams();
  const isDesktop = useMediaQuery("(min-width: 768px)");

  if (page.pageCount <= 1) return null;

  return (
    <>
      <Pagination>
        <PaginationContent>
          {page.hasPreviousPage && (
            <PaginationItem>
              <PaginationPrevious
                to={buildSearchParams("page", `${page.page - 1}`)}
                prefetch={isDesktop ? "intent" : "viewport"}
              />
            </PaginationItem>
          )}

          {page.page > 10 && (
            <PaginationItem className="hidden lg:inline">
              <PaginationLink
                to={buildSearchParams("page", `${page.page - 10}`)}
                prefetch={isDesktop ? "intent" : "viewport"}
              >
                {page.page - 10}
              </PaginationLink>
            </PaginationItem>
          )}

          {page.page > 5 && (
            <PaginationItem className="hidden lg:inline">
              <PaginationEllipsis />
            </PaginationItem>
          )}

          {page.page > 1 && (
            <PaginationItem>
              <PaginationLink
                to={buildSearchParams("page", `${page.page - 1}`)}
                prefetch={isDesktop ? "intent" : "viewport"}
              >
                {page.page - 1}
              </PaginationLink>
            </PaginationItem>
          )}

          <PaginationItem>
            <PaginationLink
              to={buildSearchParams("page", `${page.page}`)}
              isActive
            >
              {page.page}
            </PaginationLink>
          </PaginationItem>

          {page.page < page.pageCount && (
            <PaginationItem>
              <PaginationLink
                to={buildSearchParams("page", `${page.page + 1}`)}
                prefetch={isDesktop ? "intent" : "viewport"}
              >
                {page.page + 1}
              </PaginationLink>
            </PaginationItem>
          )}

          {page.pageCount - page.page > 5 && (
            <PaginationItem className="hidden lg:inline">
              <PaginationEllipsis />
            </PaginationItem>
          )}

          {page.page + 10 <= page.pageCount && (
            <PaginationItem className="hidden lg:inline">
              <PaginationLink
                to={buildSearchParams("page", `${page.page + 10}`)}
                prefetch={isDesktop ? "intent" : "viewport"}
              >
                {page.page + 10}
              </PaginationLink>
            </PaginationItem>
          )}

          {page.hasNextPage && (
            <PaginationItem>
              <PaginationNext
                to={buildSearchParams("page", `${page.page + 1}`)}
                prefetch={isDesktop ? "intent" : "viewport"}
              />
            </PaginationItem>
          )}
        </PaginationContent>
      </Pagination>
    </>
  );
}
