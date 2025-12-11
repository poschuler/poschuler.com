import { Link } from "react-router";
import { Sparkles } from "lucide-react";
import {
  MetroIcon,
  MetroIconSmall,
  PlazaVeaIcon,
  PlazaVeaIconSmall,
  TottusIcon,
  TottusIconSmall,
  VivandaIcon,
  VivandaIconSmall,
  WongIcon,
  WongIconSmall,
} from "~/components/icons";
import { METRO, PLAZA_VEA, TOTTUS, VIVANDA, WONG } from "~/utils/constants";

type StoreIconCardHeaderProps = {
  name: string;
};

export function StoreIconCardHeader({ name }: StoreIconCardHeaderProps) {
  return (
    <>
      {name === PLAZA_VEA && (
        <div className="absolute left-0 top-0 rounded-br-lg rounded-tl-lg bg-red-500 p-1 opacity-90">
          <PlazaVeaIcon className="h-[20px] w-[69px]" />
        </div>
      )}

      {name === METRO && (
        <div className="bg-yellow-400-600 absolute left-2 top-0 rounded-br-lg rounded-tl-lg p-1 opacity-90">
          <MetroIcon className="w-8" />
        </div>
      )}

      {name === TOTTUS && (
        <div className="absolute left-0 top-0 rounded-br-lg rounded-tl-lg bg-green-600 p-1 opacity-90">
          <TottusIcon className="h-[18px] w-[69px]" />
        </div>
      )}

      {name === VIVANDA && (
        <div className="absolute left-0 top-0 rounded-br-lg rounded-tl-lg bg-white p-1 opacity-90">
          <VivandaIcon className="h-[20px] w-[69px]" />
        </div>
      )}

      {name === WONG && (
        <div className="bg-yellow-400-600 absolute left-2 top-0 rounded-br-lg rounded-tl-lg p-1 opacity-90">
          <WongIcon className="w-8" />
        </div>
      )}
    </>
  );
}

type StoreIconCardLinkProps = {
  name: string;
  isBestPrice: boolean;
};

export function StoreIconCardLink({
  name,
  isBestPrice = false,
}: StoreIconCardLinkProps) {
  return (
    <>
      {name === PLAZA_VEA && (
        <div
          className={
            "bg-red-500 p-1 opacity-90 rounded-full rainbow-border relative"
          }
        >
          <PlazaVeaIconSmall className="h-4 w-4" />
          {isBestPrice && (
            <Sparkles className="absolute size-5 -bottom-[4px] -right-[4px] fill-yellow-400 stroke-1 stroke-yellow-400" />
          )}
        </div>
      )}

      {name === METRO && (
        <div className="bg-yellow-400-600 p-1 opacity-90 relative">
          <MetroIconSmall className="h-[25px] w-[25px]" />
          {isBestPrice && (
            <Sparkles className="absolute size-5 -bottom-[1px] -right-[1px] fill-red-500 stroke-1 stroke-red-500" />
          )}
        </div>
      )}

      {name === TOTTUS && (
        <div className="bg-white p-1 opacity-90 rounded-full relative">
          <TottusIconSmall className="h-[17px] w-[17px]" />
          {isBestPrice && (
            <Sparkles className="absolute size-5 -bottom-[6px] -right-[6px] fill-red-500 stroke-1 stroke-red-500" />
          )}
        </div>
      )}

      {name === VIVANDA && (
        <div className="bg-white p-1 opacity-90 rounded-full relative">
          <VivandaIconSmall className="h-4 w-4" />
          {isBestPrice && (
            <Sparkles className="absolute size-5 -bottom-[4px] -right-[4px] fill-yellow-400 stroke-1 stroke-yellow-400" />
          )}
        </div>
      )}

      {name === WONG && (
        <div className="bg-yellow-400-600 p-1 opacity-90 relative">
          <WongIconSmall className="h-[25px] w-[25px]" />
          {isBestPrice && (
            <Sparkles className="absolute size-5 bottom-[0px] right-[0px] fill-yellow-400 stroke-1 stroke-yellow-400" />
          )}
        </div>
      )}
    </>
  );
}

type StoreIconTitleProps = {
  idStore: number;
  name: string;
};

export function StoreIconTitle({ idStore, name }: StoreIconTitleProps) {
  return (
    <Link to={`/productos?idStore[]=${idStore}`} prefetch="intent">
      {name === PLAZA_VEA && (
        <PlazaVeaIcon className="h-10 w-28 rounded-md bg-red-500 px-2 py-1" />
      )}

      {name === METRO && <MetroIcon className="h-16 w-16" />}

      {name === TOTTUS && (
        <TottusIcon className="h-10 w-28 rounded-md bg-green-600 px-1 py-1" />
      )}

      {name === VIVANDA && (
        <VivandaIcon className="h-10 w-28 rounded-md bg-white px-1" />
      )}

      {name === WONG && <WongIcon className="h-16 w-16" />}
    </Link>
  );
}

type StoreIconFilterProps = {
  name: string;
};

export function StoreIconFilter({ name }: StoreIconFilterProps) {
  return (
    <>
      {name === PLAZA_VEA && (
        <PlazaVeaIcon className="h-6 w-20 rounded-md bg-red-500 px-2" />
      )}

      {name === METRO && <MetroIcon className="h-26 w-8 p-[1px]" />}

      {name === TOTTUS && (
        <TottusIcon className="h-6 w-20 rounded-md bg-green-600 p-1" />
      )}

      {name === VIVANDA && (
        <VivandaIcon className="h-6 w-20 rounded-md bg-white px-1" />
      )}

      {name === WONG && <WongIcon className="h-26 w-8 p-[1px]" />}
    </>
  );
}

type StoreIconSearchProps = {
  name: string;
};

export function StoreIconSearch({ name }: StoreIconSearchProps) {
  return (
    <>
      {name === PLAZA_VEA && (
        <div className="rounded bg-red-500 opacity-90">
          <PlazaVeaIcon className="w-10 p-0.5" />
        </div>
      )}

      {name === METRO && <MetroIcon className="w-5 p-[1px]" />}

      {name === TOTTUS && (
        <div className="rounded bg-green-600 opacity-90">
          <TottusIcon className="h-[14px] w-10 rounded-md bg-green-600 p-0.5" />
        </div>
      )}

      {name === VIVANDA && (
        <div className="rounded bg-white opacity-90">
          <VivandaIcon className="w-10 p-0.5" />
        </div>
      )}

      {name === WONG && <WongIcon className="w-5 p-[1px]" />}
    </>
  );
}

type StoreIconProductProps = {
  name: string;
};

export function StoreIconProduct({ name }: StoreIconProductProps) {
  return (
    <>
      {name === PLAZA_VEA && (
        <div className="flex h-7 items-center justify-center rounded bg-red-500 opacity-90">
          <PlazaVeaIcon className="w-[75px] p-0.5" />
        </div>
      )}

      {name === METRO && <MetroIcon className="w-10 p-[1px]" />}

      {name === TOTTUS && (
        <div className="flex h-7 items-center justify-center rounded bg-green-600 opacity-90">
          <TottusIcon className="w-20 rounded-md bg-green-600 p-0.5" />
        </div>
      )}

      {name === VIVANDA && (
        <div className="flex h-7 items-center justify-center rounded bg-white opacity-90">
          <VivandaIcon className="w-[75px] p-0.5" />
        </div>
      )}

      {name === WONG && <WongIcon className="w-10 p-[1px]" />}
    </>
  );
}

type StoreIconPageProps = {
  name: string;
};

export function StoreIconPage({ name }: StoreIconPageProps) {
  return (
    <>
      {name === PLAZA_VEA && (
        <div className="absolute left-0 top-0 rounded-br-lg rounded-tl-xl bg-red-500 p-1 opacity-90">
          <PlazaVeaIcon className="h-6 w-20 p-[1px]" />
        </div>
      )}

      {name === METRO && (
        <div className="bg-yellow-400-600 absolute left-0 top-0 rounded-br-lg rounded-tl-xl p-1 opacity-90">
          <MetroIcon className="h-26 w-12 p-[1px]" />
        </div>
      )}

      {name === TOTTUS && (
        <div className="absolute left-0 top-0 rounded-br-lg rounded-tl-xl bg-green-600 p-1 opacity-90">
          <TottusIcon className="h-6 w-20 p-[1px]" />
        </div>
      )}

      {name === VIVANDA && (
        <div className="absolute left-0 top-0 rounded-br-lg rounded-tl-xl bg-white p-1 opacity-90">
          <VivandaIcon className="h-6 w-20 p-[1px]" />
        </div>
      )}

      {name === WONG && <WongIcon className="h-26 w-12 p-[1px]" />}
    </>
  );
}

type StoreIconProductLinkProps = {
  name: string;
};

export function StoreIconLinkProduct({ name }: StoreIconProductLinkProps) {
  return (
    <>
      {name === PLAZA_VEA && (
        <div className="flex h-7 items-center justify-center rounded bg-red-500 opacity-90">
          <PlazaVeaIcon className="w-[75px] p-0.5" />
        </div>
      )}

      {name === METRO && <MetroIcon className="w-10 p-[1px]" />}

      {name === TOTTUS && (
        <div className="flex h-7 items-center justify-center rounded bg-green-600 opacity-90">
          <TottusIcon className="w-20 rounded-md bg-green-600 p-0.5" />
        </div>
      )}

      {name === VIVANDA && (
        <div className="flex h-7 items-center justify-center rounded bg-white opacity-90">
          <VivandaIcon className="w-[75px] p-0.5" />
        </div>
      )}

      {name === WONG && <WongIcon className="w-10 p-[1px]" />}
    </>
  );
}

export function StoreIconShoppingListProduct({ name }: StoreIconSearchProps) {
  return (
    <>
      {name === PLAZA_VEA && (
        <div className="bg-red-500 p-0.5 opacity-90 rounded-full">
          <PlazaVeaIconSmall className="h-4 w-4 p-[1px]" />
        </div>
      )}

      {name === METRO && (
        <div className="bg-yellow-400-600 opacity-90">
          <MetroIconSmall className="h-5 w-5 p-[1px]" />
        </div>
      )}

      {name === TOTTUS && (
        <div className="bg-white p-0.5 opacity-90 rounded-full">
          <TottusIconSmall className="h-[15px] w-[15px]" />
        </div>
      )}

      {name === VIVANDA && (
        <div className="bg-white p-0.5 opacity-90 rounded-full">
          <VivandaIconSmall className="h-4 w-4 p-[1px]" />
        </div>
      )}

      {name === WONG && (
        <div className="bg-yellow-400-600 opacity-90">
          <WongIconSmall className="h-5 w-5 p-[1px]" />
        </div>
      )}
    </>
  );
}

type StoreIconPriceDateProps = {
  idStore: number;
  name: string;
};

export function StoreIconPriceDate({ idStore, name }: StoreIconPriceDateProps) {
  return (
    <Link to={`/productos?idStore[]=${idStore}`} prefetch="intent">
      {name === PLAZA_VEA && (
        <PlazaVeaIcon className="h-5 w-14 rounded-md bg-red-500 px-2 py-1" />
      )}

      {name === METRO && <MetroIcon className="h-6 w-6" />}

      {name === TOTTUS && (
        <TottusIcon className="h-5 w-14 rounded-md bg-green-600 px-1 py-1" />
      )}

      {name === VIVANDA && (
        <VivandaIcon className="h-5 w-14 rounded-md bg-white px-[2px]" />
      )}

      {name === WONG && <WongIcon className="h-6 w-6" />}
    </Link>
  );
}
